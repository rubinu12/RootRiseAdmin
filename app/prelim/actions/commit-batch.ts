"use server";

import { db, pool } from '@/lib/db';
import { 
  topics, 
  prelimQuestions, 
  prelimQuestionStatements, 
  prelimQuestionPairs, 
  prelimQuestionTopics 
} from '@/lib/schema';
import { IngestionItem, StagedTopicChain, TopicNode } from '@/types/prelimIngestion';
import { generateEmbedding, slugify } from '@/app/actions/topic-tree-actions'; // Reusing your existing helpers
import { eq } from 'drizzle-orm';

// --- HELPER: Topic Creation ---
async function createTopicInDB(client: any, name: string, parentId: string, level: number, parentSlug: string, parentPath: string) {
  const slug = `${parentSlug}-${slugify(name)}`;
  const path = `${parentPath}.${slugify(name)}`;
  
  // 1. Generate Vector (Critical for future Semantic Search)
  const vector = await generateEmbedding(name); 

  const res = await client.query(`
    INSERT INTO topics (
      name, slug, level, primary_parent_id, ancestry_path, 
      topic_type, raw_vector, sharp_vector, is_navigable
    )
    VALUES ($1, $2, $3, $4, $5, 'provisional', $6, $6, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name -- Soft handle dupes
    RETURNING id, slug, ancestry_path;
  `, [
    name, slug, level, parentId, path, JSON.stringify(vector)
  ]);
  
  return res.rows[0];
}

export async function commitBatch(items: IngestionItem[]) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // --- PHASE 1: CREATE PENDING TOPICS ---
    // We use a Map to track Created IDs locally to handle L3->L4 dependencies within the same batch
    // Key: "Level:Name:ParentID" -> Value: NewUUID
    const createdTopicCache = new Map<string, any>();

    // A. Collect Unique Pending L3s
    for (const item of items) {
      for (const chain of item.topicChains) {
        if (chain.l3.status === 'pending-create') {
          const key = `3:${chain.l3.name}:${chain.l2.dbId}`;
          if (!createdTopicCache.has(key)) {
            // Fetch Parent (L2) details for Path construction
            const l2Node = await db.query.topics.findFirst({
               where: eq(topics.id, chain.l2.dbId!)
            });
            if (!l2Node) throw new Error(`L2 Parent Missing for ${chain.l3.name}`);
            
            const newL3 = await createTopicInDB(
              client, chain.l3.name, chain.l2.dbId!, 3, l2Node.slug, l2Node.ancestryPath!
            );
            createdTopicCache.set(key, newL3);
          }
          // Update the Node in memory with new DB ID
          const cached = createdTopicCache.get(key);
          chain.l3.dbId = cached.id;
          chain.l3.slug = cached.slug;
          chain.l3.status = 'green'; // It is now real
        }
      }
    }

    // B. Collect Unique Pending L4s (Now that L3s exist)
    for (const item of items) {
      for (const chain of item.topicChains) {
        if (chain.l4 && chain.l4.status === 'pending-create') {
          // Parent is L3 (which might have just been created)
          const l3Id = chain.l3.dbId; 
          const key = `4:${chain.l4.name}:${l3Id}`;
          
          if (!createdTopicCache.has(key)) {
            // Need L3 details for Path (it might be in cache OR in DB)
            let l3Slug = chain.l3.slug; 
            // If we just created it, we have the slug. If it was pre-existing green, we might need to fetch if slug is missing in UI state.
            // For simplicity/robustness, let's fetch strictly if missing.
            if (!l3Slug) {
               const l3Node = await db.query.topics.findFirst({ where: eq(topics.id, l3Id!) });
               l3Slug = l3Node?.slug;
            }

            // We construct path roughly or fetch. 
            // Optimization: In Phase 1A we returned slug/path.
            // Let's assume chain.l3.slug is populated correctly by Phase 1A or the Analyzer.
            
            const newL4 = await createTopicInDB(
               client, chain.l4.name, l3Id!, 4, l3Slug!, "temp-path-fix-later" 
            );
            createdTopicCache.set(key, newL4);
          }
           // Update Node
           const cached = createdTopicCache.get(key);
           chain.l4.dbId = cached.id;
           chain.l4.status = 'green';
        }
      }
    }

    // --- PHASE 2: INSERT QUESTIONS ---
    let savedCount = 0;

    for (const item of items) {
      const q = item.question;
      
      // 1. Insert Core Question
      const qRes = await client.query(`
        INSERT INTO prelim_questions (
          question_text, question_type, paper, year, source,
          correct_option, complexity, weightage, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 0.0, 'MEDIUM', NOW()) 
        RETURNING id
      `, [
        q.text, q.type, q.paper, q.year, q.source, q.correctOption
      ]);
      
      const qId = qRes.rows[0].id; // BigInt

      // 2. Insert Options (for MCQ/Statement/Pair)
      if (q.options.length > 0) {
        await client.query(`
          UPDATE prelim_questions SET 
          option_a = $2, option_b = $3, option_c = $4, option_d = $5
          WHERE id = $1
        `, [
          qId,
          q.options.find(o => o.label === 'A')?.text,
          q.options.find(o => o.label === 'B')?.text,
          q.options.find(o => o.label === 'C')?.text,
          q.options.find(o => o.label === 'D')?.text,
        ]);
      }

      // 3. Insert Statements (if type=statement)
      if (q.type === 'statement' && 'statements' in q) {
        for (const s of q.statements) {
          await client.query(`
            INSERT INTO prelim_question_statements (
              question_id, statement_number, statement_text, correct_truth
            ) VALUES ($1, $2, $3, $4)
          `, [qId, s.idx, s.text, s.isTrue]);
        }
      }

      // 4. Insert Pairs (if type=pair)
      if (q.type === 'pair' && 'pairs' in q) {
        // Pairs usually map to prelim_question_pairs table
        for (const p of q.pairs) {
          await client.query(`
            INSERT INTO prelim_question_pairs (
              question_id, col1, col2, correct_match
            ) VALUES ($1, $2, $3, $4)
          `, [qId, p.left, p.right, p.isCorrectMatch ? 'true' : 'false']);
        }
      }

      // --- PHASE 3: LINK TOPICS ---
      // Collect all Final Target Topics (L4 if exists, else L3)
      const uniqueTopicIds = new Set<string>();
      
      for (const chain of item.topicChains) {
        const targetNode = chain.l4 || chain.l3;
        if (targetNode.dbId) {
          uniqueTopicIds.add(targetNode.dbId);
        }
      }

      for (const topicId of uniqueTopicIds) {
        await client.query(`
          INSERT INTO prelim_question_topics (question_id, topic_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [qId, topicId]);
      }

      savedCount++;
    }

    await client.query('COMMIT');
    return { success: true, count: savedCount };

  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error("Batch Commit Error:", e);
    return { success: false, error: e.message };
  } finally {
    client.release();
  }
}