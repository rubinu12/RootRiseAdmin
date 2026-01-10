"use server";

import { db } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { sql, cosineDistance, eq, and, isNotNull, desc } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const predictionServiceClient = new v1.PredictionServiceClient({
  apiEndpoint: API_ENDPOINT,
});

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

export async function recursiveVectorSearch(queryText: string) {
  try {
    const queryVec = await getQueryEmbedding(queryText);
    const trace = []; 

    // --- STEP 1: L1 (ROOT) ---
    const l1Results = await db.select({
      id: topics.id,
      name: topics.name,
      similarity: sql<number>`1 - (${cosineDistance(topics.rawVector, queryVec)})`
    })
    .from(topics)
    .where(eq(topics.level, 1))
    .orderBy(sql`1 - (${cosineDistance(topics.rawVector, queryVec)}) DESC`)
    .limit(1);

    if (l1Results.length === 0) return { success: false, error: "No Roots found" };
    const l1Winner = l1Results[0];
    trace.push({ step: "L1 (Root)", winner: l1Winner.name, score: l1Winner.similarity });

    // --- STEP 2: L2 (SUBJECT) ---
    const l2Results = await db.select({
      id: topics.id,
      name: topics.name,
      similarity: sql<number>`1 - (${cosineDistance(topics.sharpVector, queryVec)})`
    })
    .from(topics)
    .where(and(eq(topics.primaryParentId, l1Winner.id), isNotNull(topics.sharpVector)))
    .orderBy(sql`1 - (${cosineDistance(topics.sharpVector, queryVec)}) DESC`)
    .limit(1);

    if (l2Results.length === 0) return { success: true, trace, finalNode: l1Winner, note: "Stopped at L1" };
    const l2Winner = l2Results[0];
    trace.push({ step: "L2 (Subject)", winner: l2Winner.name, score: l2Winner.similarity });

    // --- STEP 3: L3 (TOPIC) ---
    const l3Results = await db.select({
      id: topics.id,
      name: topics.name,
      similarity: sql<number>`1 - (${cosineDistance(topics.sharpVector, queryVec)})`
    })
    .from(topics)
    .where(and(eq(topics.primaryParentId, l2Winner.id), isNotNull(topics.sharpVector)))
    .orderBy(sql`1 - (${cosineDistance(topics.sharpVector, queryVec)}) DESC`)
    .limit(1); // Only get the best L3 to continue drilling

    if (l3Results.length === 0) return { success: true, trace, finalNode: l2Winner, note: "Stopped at L2" };
    const l3Winner = l3Results[0];
    trace.push({ step: "L3 (Topic)", winner: l3Winner.name, score: l3Winner.similarity });

    // --- STEP 4: L4 (SUB-TOPIC) ---
    // Drills down one last time to find "Governor" vs "CM"
    const l4Results = await db.select({
      id: topics.id,
      name: topics.name,
      similarity: sql<number>`1 - (${cosineDistance(topics.sharpVector, queryVec)})`
    })
    .from(topics)
    .where(and(eq(topics.primaryParentId, l3Winner.id), isNotNull(topics.sharpVector)))
    .orderBy(sql`1 - (${cosineDistance(topics.sharpVector, queryVec)}) DESC`)
    .limit(3);

    // If no L4 children exist, we stop at L3 (State Executive)
    if (l4Results.length === 0) {
      return { success: true, trace, finalNode: l3Winner, candidates: [l3Winner], note: "Stopped at L3" };
    }

    const l4Winner = l4Results[0];
    trace.push({ step: "L4 (Sub-Topic)", winner: l4Winner.name, score: l4Winner.similarity });

    return { 
      success: true, 
      trace, 
      finalNode: l4Winner, 
      candidates: l4Results 
    };

  } catch (error: any) {
    console.error("Recursive Search Error:", error);
    return { success: false, error: error.message };
  }
}