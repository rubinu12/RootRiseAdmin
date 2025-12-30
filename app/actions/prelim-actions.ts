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

/**
 * HELPER: Slugify a string
 */
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function generateEmbedding(text: string): Promise<number[]> {
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const [response] = await predictionClient.predict({
    endpoint,
    instances: [instance!],
    parameters: helpers.toValue({ autoTruncate: true, outputDimensionality: 768 })!,
  });
  const result = helpers.fromValue(response.predictions![0] as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

/**
 * RESOLVER: Independent L3 and L4 Matching
 */
async function resolveTopicPath(subject: string, anchor: string, detailed?: string) {
  const l2Node = await db.query.topics.findFirst({
    where: and(eq(topics.level, 2), eq(topics.name, subject))
  });

  if (!l2Node) return { error: `Subject "${subject}" missing.`, failedAt: 2, l3Match: null, l4Match: null };

  // 1. Resolve L3 (Anchor)
  const anchorVector = await generateEmbedding(anchor);
  const l3Res = await pool.query(`
    SELECT id, name, ancestry_path, (1 - (embedding <=> $1)) as similarity
    FROM topics WHERE primary_parent_id = $2 AND level = 3 AND embedding IS NOT NULL
    ORDER BY similarity DESC LIMIT 1
  `, [JSON.stringify(anchorVector), l2Node.id]);

  const l3Candidate = l3Res.rows[0];
  const l3Score = l3Candidate ? parseFloat(Number(l3Candidate.similarity).toFixed(4)) : 0;
  
  const l3Info = {
    id: l3Candidate?.id || null,
    name: l3Candidate?.name || "None Found",
    score: l3Score,
    isMatched: l3Score >= 0.95
  };

  let l4Info = { id: null, name: "N/A", score: 0, isMatched: false };

  // 2. Resolve L4 (Detailed) - Search only if L3 is matched
  if (detailed && l3Info.isMatched) {
    const detailedVector = await generateEmbedding(detailed);
    const l4Res = await pool.query(`
      SELECT id, name, ancestry_path, (1 - (embedding <=> $1)) as similarity
      FROM topics WHERE primary_parent_id = $2 AND level = 4 AND embedding IS NOT NULL
      ORDER BY similarity DESC LIMIT 1
    `, [JSON.stringify(detailedVector), l3Info.id]);

    const l4Candidate = l4Res.rows[0];
    const l4Score = l4Candidate ? parseFloat(Number(l4Candidate.similarity).toFixed(4)) : 0;
    
    l4Info = {
      id: l4Candidate?.id || null,
      name: l4Candidate?.name || "None Found",
      score: l4Score,
      isMatched: l4Score >= 0.95
    };
  }

  return {
    l2Id: l2Node.id,
    l2Path: l2Node.ancestryPath,
    l3Match: l3Info,
    l4Match: l4Info,
    resolvedId: l4Info.isMatched ? l4Info.id : (l3Info.isMatched ? l3Info.id : null),
    isGrowthNeeded: !l3Info.isMatched || (!!detailed && !l4Info.isMatched)
  };
}

export async function previewBatchIngestion(rawJson: string) {
  try {
    const batch = JSON.parse(rawJson);
    const stagedData = [];

    for (const item of batch) {
      const q = item.question;
      const meta = item.meta;
      const primaryTopic = item.topics?.[0];

      if (!primaryTopic) {
        stagedData.push({ id: `err-${Date.now()}`, hasError: true, errorMessage: "No topics provided." });
        continue;
      }

      const res = await resolveTopicPath(primaryTopic.subject, primaryTopic.anchor, primaryTopic.detailed);

      stagedData.push({
        id: `staged-${Date.now()}-${Math.random()}`,
        questionText: q.question_text,
        subject: primaryTopic.subject,
        paper: meta.paper,
        year: meta.year,
        type: meta.question_type,
        correctOption: q.correct_option,
        correctAnswerText: q.options.find((o: any) => o.label === q.correct_option)?.text || "",
        statements: q.statements.map((s: any) => ({ statementText: s.text, correctTruth: s.is_statement_true })),
        options: q.options.reduce((acc: any, curr: any) => { acc[curr.label] = curr.text; return acc; }, {}),
        suggestedPath: `${primaryTopic.subject} > ${primaryTopic.anchor}${primaryTopic.detailed ? ` > ${primaryTopic.detailed}` : ''}`.toUpperCase(),
        suggestedL3: primaryTopic.anchor,
        suggestedL4: primaryTopic.detailed || "",
        l2Id: res.l2Id,
        topicId: res.resolvedId,
        l3Match: res.l3Match,
        l4Match: res.l4Match,
        isBranchGrowthNeeded: res.isGrowthNeeded,
        hasError: !!res.error,
        errorMessage: res.error || null
      });
    }
    return { success: true, data: stagedData };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * CREATE BRANCH: Hierarchical Slugs and Dot-Notation Paths
 */
export async function createTopicBranch(l2Id: string, l3Name: string, l4Name?: string) {
  try {
    const l2Node = await db.query.topics.findFirst({ where: eq(topics.id, l2Id) });
    if (!l2Node) throw new Error("L2 missing");

    // Parent path prefix (lowercase and dot-delimited)
    const pathPrefix = l2Node.ancestryPath?.toLowerCase().replace(/ > /g, '.');
    const slugPrefix = l2Node.slug;

    // 1. Handle L3
    let l3Node = await db.query.topics.findFirst({
      where: and(eq(topics.level, 3), eq(topics.primaryParentId, l2Id), eq(topics.name, l3Name))
    });

    if (!l3Node) {
      const v = await generateEmbedding(l3Name);
      const l3Slug = `${slugPrefix}-${slugify(l3Name)}`;
      const l3Path = `${pathPrefix}.${slugify(l3Name)}`;
      
      const [newL3] = await db.insert(topics).values({
        name: l3Name, slug: l3Slug, level: 3, primaryParentId: l2Id,
        ancestryPath: l3Path, topicType: 'provisional', embedding: v
      }).returning();
      l3Node = newL3;
    }

    let finalId = l3Node.id;

    // 2. Handle L4
    if (l4Name) {
      const v = await generateEmbedding(l4Name);
      const l4Slug = `${l3Node.slug}-${slugify(l4Name)}`;
      const l4Path = `${l3Node.ancestryPath}.${slugify(l4Name)}`;

      const [newL4] = await db.insert(topics).values({
        name: l4Name, slug: l4Slug, level: 4, primaryParentId: l3Node.id,
        ancestryPath: l4Path, topicType: 'provisional', embedding: v
      }).returning();
      finalId = newL4.id;
    }

    revalidatePath('/topic-tree');
    return { success: true, topicId: finalId };
  } catch (e: any) { return { success: false, error: e.message }; }
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
          for (const s of q.statements) {
            await client.query(`INSERT INTO prelim_question_statements (question_id, statement_text, correct_truth) VALUES ($1, $2, $3);`, [qId, s.statementText, s.correctTruth]);
          }
        }
        await client.query(`INSERT INTO prelim_question_topics (question_id, topic_id) VALUES ($1, $2);`, [qId, q.topicId]);
      }
      await client.query('COMMIT');
      revalidatePath('/prelim-studio');
      return { success: true };
    } catch (e: any) { await client.query('ROLLBACK'); return { success: false, error: e.message }; } 
    finally { client.release(); }
  }
  
  export async function searchTopicsBySubject(subjectName: string, query: string) {
    if (!subjectName || subjectName === "Unknown") return [];
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

  