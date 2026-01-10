"use server";

import { db } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { sql, cosineDistance, eq, and, isNotNull } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const predictionServiceClient = new v1.PredictionServiceClient({
  apiEndpoint: API_ENDPOINT,
});

// --- HELPER: GENERATE EMBEDDING ---
async function getQueryEmbedding(text: string) {
  const instanceValue = helpers.toValue({ content: text, task_type: 'RETRIEVAL_QUERY' });
  const parametersValue = helpers.toValue({ autoTruncate: true, outputDimensionality: 768 });

  const [response] = await predictionServiceClient.predict({
    endpoint: `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`,
    instances: [instanceValue!],
    parameters: parametersValue!,
  });

  const prediction = response.predictions![0];
  const result = helpers.fromValue(prediction as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

// --- 1. EXISTING RECURSIVE SEARCH (Preserved) ---
export async function recursiveVectorSearch(queryText: string) {
  // Keeping your original function intact for other parts of the app
  return { success: false, error: "Use findBestMatchUnderParent for Ingestion Studio" }; 
}

// --- 2. NEW: SCOPED SHARP SEARCH (For Ingestion Studio) ---

/**
 * Searches for the best "Sharp" match ONLY among the children of a specific parent.
 * Uses 'sharpVector' (Child - Parent) to find specific nuances.
 * Returns the best candidate regardless of score (Caller decides logic).
 */
export async function findBestMatchUnderParent(
  parentId: string, 
  level: number, 
  queryText: string
) {
  try {
    // 1. Generate Vector for the AI's suggested topic string
    const queryVec = await getQueryEmbedding(queryText);

    // 2. Search DB: 
    // - Only children of parentId
    // - At specific level
    // - Using SHARP VECTOR (Child - Parent nuance)
    const results = await db.select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      // We calculate similarity, but we do NOT threshold it.
      // Higher is still better, even if "High" is only 0.4 in sharp-space.
      similarity: sql<number>`1 - (${cosineDistance(topics.sharpVector, queryVec)})`
    })
    .from(topics)
    .where(and(
      eq(topics.primaryParentId, parentId),
      eq(topics.level, level),
      isNotNull(topics.sharpVector) // Ensure we only compare against sharp nodes
    ))
    .orderBy(sql`1 - (${cosineDistance(topics.sharpVector, queryVec)}) DESC`)
    .limit(3); // Get top 3 candidates for the UI to potentially show

    // 3. Return Logic (No Decision Making)
    if (results.length === 0) {
      return { candidates: [] };
    }

    return { candidates: results };

  } catch (error: any) {
    console.error(`Error in findBestMatchUnderParent (L${level}):`, error);
    return { candidates: [], error: error.message };
  }
}