"use server";

import { db, pool } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const clientOptions = { apiEndpoint: API_ENDPOINT, fallback: true };
const predictionServiceClient = new v1.PredictionServiceClient(clientOptions);

/**
 * HELPER: Standardize slugs and paths
 */
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * GENERATE EMBEDDING (768 Dimensions)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!PROJECT_ID) throw new Error("GOOGLE_PROJECT_ID is missing.");
  
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const parameters = helpers.toValue({ 
    autoTruncate: true,
    outputDimensionality: 768 // Enforced for schema compatibility
  });

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
 * SMART BULK SEEDER
 */
export async function smartBulkSeed(parentId: string, rawText: string) {
  const parentNode = await db.query.topics.findFirst({
    where: eq(topics.id, parentId)
  });

  if (!parentNode) throw new Error("Parent node not found.");
  
  // Standardize parent path to dots for dot-notation
  const parentPath = parentNode.ancestryPath ? parentNode.ancestryPath.toLowerCase() : "";

  const lines = rawText.split('\n');
  const results = { created: 0, errors: [] as string[] };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Tracks the most recently created L3 so L4s can be nested correctly during bulk paste
    let activeL3Id = parentNode.level === 3 ? parentNode.id : null;
    let activeL3Path = parentNode.level === 3 ? parentNode.ancestryPath : "";
    let activeL3Slug = parentNode.level === 3 ? parentNode.slug : "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isL4 = trimmed.startsWith('--');
      const isL3 = !isL4 && trimmed.startsWith('-');
      const isL2 = !isL4 && !isL3 && trimmed.startsWith('+');

      // Validation
      if (parentNode.level === 2 && isL2) {
        results.errors.push(`Error: Cannot add L2 (+) under Subject "${parentNode.name}".`);
        continue;
      }

      const content = trimmed.replace(/^[+\-\-]+/, '').trim();
      const [name, hintsRaw] = content.split('|').map(s => s.trim());
      const hints = hintsRaw ? hintsRaw.split(',').map(h => h.trim()) : [];

      const targetLevel = isL2 ? 2 : isL3 ? 3 : 4;
      
      // Calculate hierarchical slug and dot-notation path
      let finalParentId = parentId;
      let finalSlug = "";
      let finalPath = "";

      if (isL4 && activeL3Id) {
        finalParentId = activeL3Id;
        finalSlug = `${activeL3Slug}-${slugify(name)}`;
        finalPath = `${activeL3Path}.${slugify(name)}`;
      } else {
        finalSlug = `${parentNode.slug}-${slugify(name)}`;
        finalPath = parentPath ? `${parentPath}.${slugify(name)}` : slugify(name);
      }

      // Generate context-aware embedding
      const contextString = `${name} | ${hints.join(', ')}`;
      const embedding = await generateEmbedding(contextString);

      const res = await client.query(`
        INSERT INTO topics (name, slug, level, primary_parent_id, ancestry_path, topic_type, keywords, embedding)
        VALUES ($1, $2, $3, $4, $5, 'canonical', $6, $7)
        ON CONFLICT (slug) DO UPDATE SET 
          name = EXCLUDED.name,
          keywords = EXCLUDED.keywords,
          ancestry_path = EXCLUDED.ancestry_path,
          embedding = EXCLUDED.embedding
        RETURNING id, ancestry_path, slug;
      `, [name, finalSlug, targetLevel, finalParentId, finalPath, hints, JSON.stringify(embedding)]);

      if (isL3) {
        activeL3Id = res.rows[0].id;
        activeL3Path = res.rows[0].ancestry_path;
        activeL3Slug = res.rows[0].slug;
      }
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

// ... rest of the file (getRootNodes, getChildren) remains the same
export async function getRootNodes() {
  return await db.query.topics.findMany({
    where: eq(topics.level, 1),
    orderBy: [topics.name]
  });
}

export async function getChildren(parentId: string) {
  return await db.query.topics.findMany({
    where: eq(topics.primaryParentId, parentId),
    orderBy: [topics.name]
  });
}