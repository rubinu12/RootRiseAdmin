"use server";

import { db } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { sql, cosineDistance, desc, isNotNull } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const predictionServiceClient = new v1.PredictionServiceClient({
  apiEndpoint: API_ENDPOINT,
});

// Fix Type Issues
interface EmbeddingResponse {
  embeddings: { values: number[] };
}

async function getQueryEmbedding(text: string) {
  const instanceValue = helpers.toValue({ content: text, task_type: 'RETRIEVAL_QUERY' });
  const parametersValue = helpers.toValue({ autoTruncate: true, outputDimensionality: 768 });

  const [response] = await predictionServiceClient.predict({
    endpoint: `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`,
    instances: [instanceValue!],
    parameters: parametersValue!,
  });

  const prediction = response.predictions![0];
  const result = helpers.fromValue(prediction as any) as unknown as EmbeddingResponse;
  return result.embeddings.values;
}

export async function testVectorSearch(queryText: string) {
  try {
    const queryVec = await getQueryEmbedding(queryText);

    // 1. RAW SEARCH (Baseline)
    const rawResults = await db.select({
      name: topics.name,
      path: topics.ancestryPath,
      similarity: sql<number>`1 - (${cosineDistance(topics.rawVector, queryVec)})`
    })
    .from(topics)
    .where(isNotNull(topics.rawVector))
    .orderBy(sql`1 - (${cosineDistance(topics.rawVector, queryVec)}) DESC`)
    .limit(5);

    // 2. PURE SEARCH (The Extreme Scalpel)
    const pureResults = await db.select({
      name: topics.name,
      path: topics.ancestryPath,
      similarity: sql<number>`1 - (${cosineDistance(topics.pureVector, queryVec)})`
    })
    .from(topics)
    .where(isNotNull(topics.pureVector)) 
    .orderBy(sql`1 - (${cosineDistance(topics.pureVector, queryVec)}) DESC`)
    .limit(5);

    // 3. HYBRID SEARCH (The Golden Mean)
    // Formula: (Raw * 0.7) + (Pure * 0.3)
    // If Pure is NULL, we treat it as neutral (use Raw score)
    const hybridResults = await db.select({
      name: topics.name,
      path: topics.ancestryPath,
      similarity: sql<number>`
        (
          (1 - (${cosineDistance(topics.rawVector, queryVec)})) * 0.7 + 
          COALESCE(
            (1 - (${cosineDistance(topics.pureVector, queryVec)})), 
            (1 - (${cosineDistance(topics.rawVector, queryVec)}))
          ) * 0.3
        )
      `
    })
    .from(topics)
    .where(isNotNull(topics.rawVector))
    .orderBy(sql`
      (
        (1 - (${cosineDistance(topics.rawVector, queryVec)})) * 0.7 + 
        COALESCE(
          (1 - (${cosineDistance(topics.pureVector, queryVec)})), 
          (1 - (${cosineDistance(topics.rawVector, queryVec)}))
        ) * 0.3
      ) DESC
    `)
    .limit(5);

    return { success: true, raw: rawResults, pure: pureResults, hybrid: hybridResults };

  } catch (error: any) {
    console.error("Vector Test Error:", error);
    return { success: false, error: error.message };
  }
}