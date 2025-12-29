"use server";

import { db, pool } from '@/lib/db';
import { 
  topics, 
  prelimQuestions, 
  prelimQuestionStatements, 
  prelimQuestionTopics 
} from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { eq, and, sql, or, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004';

const clientOptions = { apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`, fallback: true };
const predictionClient = new v1.PredictionServiceClient(clientOptions);

async function generateEmbedding(text: string): Promise<number[]> {
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const [response] = await predictionClient.predict({
    endpoint,
    instances: [instance!],
    parameters: helpers.toValue({ autoTruncate: true })!,
  });
  const result = helpers.fromValue(response.predictions![0] as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

/**
 * PREVIEW BATCH: STRICT THRESHOLD ENFORCEMENT
 */
export async function previewBatchIngestion(rawJson: string) {
  try {
    const batch = JSON.parse(rawJson);
    const stagedData = [];
    let itemCounter = 0; 

    for (const item of batch) {
      itemCounter++;
      const q = item.question;
      const meta = item.meta;
      const topicsArray = item.topics || [];
      const primaryTopic = topicsArray[0];

      const questionPayload = {
        id: `staged-${Date.now()}-${itemCounter}-${Math.floor(Math.random() * 1000)}`, 
        questionText: q.question_text,
        subject: primaryTopic?.subject || "Unknown",
        paper: meta.paper,
        year: meta.year,
        type: meta.question_type,
        correctOption: q.correct_option,
        correctAnswerText: q.options.find((o: any) => o.label === q.correct_option)?.text || "",
        statements: q.statements.map((s: any) => ({
          statementText: s.text,
          correctTruth: s.is_statement_true
        })),
        options: q.options.reduce((acc: any, curr: any) => {
          acc[curr.label] = curr.text;
          return acc;
        }, {}),
        suggestedL3: primaryTopic?.anchor || "",
        suggestedL4: primaryTopic?.detailed || "",
        allTopics: topicsArray 
      };

      if (!primaryTopic) {
        stagedData.push({ ...questionPayload, hasError: true, errorMessage: "No topics provided." });
        continue;
      }

      const l2Node = await db.query.topics.findFirst({
        where: and(eq(topics.level, 2), eq(topics.name, primaryTopic.subject))
      });

      if (!l2Node) {
        stagedData.push({ ...questionPayload, hasError: true, errorMessage: `L2 Subject "${primaryTopic.subject}" missing.` });
        continue;
      }

      // TIER 1: EXACT MATCH (PRIORITIZING DETAILED LEVEL 4)
      const exactMatch = await db.query.topics.findFirst({
        where: and(
            or(eq(topics.level, 3), eq(topics.level, 4)),
            ilike(topics.ancestryPath, `%${primaryTopic.anchor}%`)
        )
      });

      if (exactMatch) {
        // Path Cleaning: Removes gs2.Polity > to show L3 > L4
        const cleanPath = exactMatch.ancestryPath?.replace(/^[^>]+ > [^>]+ > /i, '').toUpperCase();
        stagedData.push({
          ...questionPayload,
          l2Id: l2Node.id,
          topicId: exactMatch.id,
          linkedPath: cleanPath || exactMatch.name.toUpperCase(),
          aiMatchScore: 1.0,
          isBranchGrowthNeeded: false,
          hasError: false
        });
        continue;
      }

      // TIER 2: SEMANTIC SCAN WITH STRICT 0.95 REJECTION
      const vector = await generateEmbedding(q.question_text);
      const res = await pool.query(`
        SELECT id, name, ancestry_path, (1 - (embedding <=> $1)) as similarity
        FROM topics
        WHERE ancestry_path ILIKE $2 AND level IN (3, 4)
        ORDER BY similarity DESC LIMIT 1
      `, [JSON.stringify(vector), `%${primaryTopic.subject}%`]);

      const match = res.rows[0];
      const score = (match && typeof match.similarity === 'number') ? parseFloat(match.similarity.toFixed(2)) : 0;

      // Logic: If the score is high enough, we use it. Otherwise, force null to trigger growth.
      const isAutoLinked = score >= 0.95;
      const cleanMatchedPath = isAutoLinked 
        ? match.ancestry_path.replace(/^[^>]+ > [^>]+ > /i, '').toUpperCase() 
        : `${primaryTopic.subject.toUpperCase()} > ???`;

      stagedData.push({
        ...questionPayload,
        l2Id: l2Node.id,
        topicId: isAutoLinked ? match.id : null,
        linkedPath: cleanMatchedPath,
        aiMatchScore: score,
        isBranchGrowthNeeded: !isAutoLinked,
        hasError: false
      });
    }
    return { success: true, data: stagedData };
  } catch (e: any) { return { success: false, error: "Semantic Engine Error: " + e.message }; }
}

export async function commitBatch(stagedData: any[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const q of stagedData) {
      if (q.hasError || !q.topicId) continue;
      const qRes = await client.query(`
        INSERT INTO prelim_questions (question_text, question_type, paper, year, correct_option, option_a, option_b, option_c, option_d)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;`, 
        [q.questionText, q.type, q.paper, q.year, q.correctOption, q.options.A, q.options.B, q.options.C, q.options.D]);
      const qId = qRes.rows[0].id;
      if (q.statements) {
        for (let i = 0; i < q.statements.length; i++) {
          await client.query(`INSERT INTO prelim_question_statements (question_id, statement_number, statement_text, correct_truth) VALUES ($1, $2, $3, $4);`, 
          [qId, i + 1, q.statements[i].statementText, q.statements[i].correctTruth]);
        }
      }
      await client.query(`INSERT INTO prelim_question_topics (question_id, topic_id) VALUES ($1, $2);`, [qId, q.topicId]);
    }
    await client.query('COMMIT');
    revalidatePath('/prelim-studio');
    return { success: true };
  } catch (error: any) { await client.query('ROLLBACK'); return { success: false, error: error.message }; } 
  finally { client.release(); }
}

export async function searchTopicsBySubject(subjectName: string, query: string) {
  const res = await db.query.topics.findMany({
    where: and(
      or(eq(topics.level, 3), eq(topics.level, 4)), 
      sql`${topics.ancestryPath} ILIKE ${'%' + subjectName + '%'}`,
      sql`${topics.name} ILIKE ${'%' + query + '%'}`
    ),
    limit: 8
  });
  return res.map(t => ({ 
    ...t, 
    ancestryPath: t.ancestryPath?.replace(/^[^>]+ > [^>]+ > /i, '').toUpperCase() 
  }));
}

export async function createTopicBranch(parentId: string, l3Name: string, l4Name?: string) {
  try {
    const parent = await db.query.topics.findFirst({ where: eq(topics.id, parentId) });
    if (!parent) throw new Error("Parent L2 not found");
    const l3Vector = await generateEmbedding(l3Name);
    const [newL3] = await db.insert(topics).values({
      name: l3Name, slug: `l3-${Date.now()}`, level: 3, primaryParentId: parent.id,
      ancestryPath: `${parent.ancestryPath} > ${l3Name}`,
      topicType: 'canonical', embedding: l3Vector 
    }).onConflictDoNothing().returning();
    const tId = newL3?.id || (await db.query.topics.findFirst({ where: eq(topics.name, l3Name) }))?.id;
    if (l4Name && tId) {
      const l4Vector = await generateEmbedding(l4Name);
      await db.insert(topics).values({
        name: l4Name, slug: `l4-${Date.now()}`, level: 4, primaryParentId: tId,
        ancestryPath: `${parent.ancestryPath} > ${l3Name} > ${l4Name}`,
        topicType: 'canonical', embedding: l4Vector 
      }).onConflictDoNothing();
    }
    revalidatePath('/topic-tree');
    return { success: true, topicId: tId };
  } catch (e: any) { return { success: true, error: e.message }; }
}