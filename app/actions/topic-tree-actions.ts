"use server";

import { db, pool } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

/**
 * AI PLATFORM CONFIGURATION
 */
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const clientOptions = { apiEndpoint: API_ENDPOINT, fallback: true };
const predictionServiceClient = new v1.PredictionServiceClient(clientOptions);

/**
 * GENERATE EMBEDDING (768 Dimensions)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!PROJECT_ID) throw new Error("GOOGLE_PROJECT_ID is missing.");
  
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const parameters = helpers.toValue({ autoTruncate: true });

  const [response] = await predictionServiceClient.predict({
    endpoint,
    instances: [instance!],
    parameters: parameters!,
  });

  const result = helpers.fromValue(response.predictions![0] as any) as {
    embeddings: { values: number[] }
  };
  return result.embeddings.values;
}

/**
 * FETCH CONTEXT FOR EMBEDDING
 * Requirement: Paper -> Subject -> Anchor context for L3/L4 embeddings.
 */
async function getContext(parentId: string) {
  // Define an interface for the query result to fix the ts(7006) error
  interface AncestryResult {
    name: string;
    level: number;
  }

  const res = await pool.query<AncestryResult>(`
    WITH RECURSIVE ancestry AS (
      SELECT id, name, level, primary_parent_id FROM topics WHERE id = $1
      UNION ALL
      SELECT t.id, t.name, t.level, t.primary_parent_id FROM topics t
      INNER JOIN ancestry a ON a.primary_parent_id = t.id
    )
    SELECT name, level FROM ancestry;
  `, [parentId]);

  // Now 'r' is typed as AncestryResult instead of 'any'
  const paper = res.rows.find((r: AncestryResult) => r.level === 1)?.name || "";
  const subject = res.rows.find((r: AncestryResult) => r.level === 2)?.name || "";
  const anchor = res.rows.find((r: AncestryResult) => r.level === 3)?.name || "";
  
  return { paper, subject, anchor };
}

/**
 * SMART BULK SEEDER
 */
export async function smartBulkSeed(parentId: string, rawText: string) {
  // 1. Validate Parent and Get Level
  const parentNode = await db.query.topics.findFirst({
    where: eq(topics.id, parentId)
  });

  if (!parentNode) throw new Error("Parent node not found.");
  const parentLevel = parentNode.level || 0;
  const { paper, subject, anchor } = await getContext(parentId);

  const lines = rawText.split('\n');
  const results = { created: 0, errors: [] as string[] };

  // Database Transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let activeL3Id = parentLevel === 3 ? parentId : null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Prefix Logic
      const isL4 = trimmed.startsWith('--');
      const isL3 = !isL4 && trimmed.startsWith('-');
      const isL2 = !isL4 && !isL3 && trimmed.startsWith('+');

      // Validation Rules
      if (parentLevel === 2 && isL2) {
        results.errors.push(`Error: Cannot add L2 (+) under Subject "${parentNode.name}".`);
        continue;
      }
      if (parentLevel === 3 && (isL2 || isL3)) {
        results.errors.push(`Error: Can only add L4 (--) under Anchor "${parentNode.name}".`);
        continue;
      }

      // Parse Name | Hints
      const content = trimmed.replace(/^[+\-\-]+/, '').trim();
      const [name, hintsRaw] = content.split('|').map(s => s.trim());
      const hints = hintsRaw ? hintsRaw.split(',').map(h => h.trim()) : [];

      const targetLevel = isL2 ? 2 : isL3 ? 3 : 4;
      const slug = `${parentNode.slug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      // Semantic Embedding String
      const richString = `Paper: ${paper}, Subject: ${subject}, Parent: ${anchor || parentNode.name}, Topic: ${name}. Hints: ${hints.join(', ')}`;
      const embedding = (targetLevel >= 3) ? await generateEmbedding(richString) : null;

      // Insert or Update
      const res = await client.query(`
        INSERT INTO topics (name, slug, level, primary_parent_id, topic_type, keywords, embedding)
        VALUES ($1, $2, $3, $4, 'canonical', $5, $6)
        ON CONFLICT (slug) DO UPDATE SET 
          name = EXCLUDED.name,
          keywords = EXCLUDED.keywords,
          embedding = COALESCE(EXCLUDED.embedding, topics.embedding)
        RETURNING id;
      `, [name, slug, targetLevel, isL4 ? activeL3Id : parentId, hints, embedding ? JSON.stringify(embedding) : null]);

      if (isL3) activeL3Id = res.rows[0].id;
      results.created++;
    }

    await client.query('COMMIT');
    revalidatePath('/topic-tree');
    return { success: true, ...results };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * GET INITIAL TREE (Collapsed State Support)
 */
export async function getRootNodes() {
  return await db.query.topics.findMany({
    where: eq(topics.level, 1),
    orderBy: [topics.name]
  });
}

/**
 * GET CHILDREN (Lazy Loading for Tree)
 */
export async function getChildren(parentId: string) {
  return await db.query.topics.findMany({
    where: eq(topics.primaryParentId, parentId),
    orderBy: [topics.name]
  });
}