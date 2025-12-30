"use server";

import { db } from '@/lib/db';
import { labTopics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { eq, sql, cosineDistance, desc } from 'drizzle-orm';

// --- CONFIGURATION ---
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;

const clientOptions = { apiEndpoint: API_ENDPOINT, fallback: true };
const predictionServiceClient = new v1.PredictionServiceClient(clientOptions);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- VECTOR MATH: ORTHOGONAL REJECTION ---
// "Take vector A and mathematically remove vector B from it"
const normalizeVector = (v: number[]) => {
  const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? v : v.map((val) => val / magnitude);
};

const rejectVector = (a: number[], b: number[]) => {
  let dot = 0;
  let bMagSq = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    bMagSq += b[i] * b[i];
  }
  if (bMagSq === 0) return a;
  const scalar = dot / bMagSq;
  return a.map((val, i) => val - (scalar * b[i]));
};

// --- AI EMBEDDING GENERATOR ---
async function generateEmbedding(text: string): Promise<number[]> {
  if (!PROJECT_ID) throw new Error("GOOGLE_PROJECT_ID is missing.");
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const parameters = helpers.toValue({ autoTruncate: true, outputDimensionality: 768 });
  const [response] = await predictionServiceClient.predict({ endpoint, instances: [instance!], parameters: parameters! });
  const result = helpers.fromValue(response.predictions![0] as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

// --- 1. INTELLIGENT INTAKE (The Contrastive Logic) ---
// --- 1. INTELLIGENT INTAKE (The Contrastive Logic) ---
export async function seedLabTopics(topicList: string[]) {
  try {
    const cleanList = topicList.map(t => t.trim()).filter(t => t.length > 0);
    let successCount = 0;

    // REMOVED: await db.delete(...) <-- This was the culprit!
    // Now we just append new data.

    for (const line of cleanList) {
      // Parse: "Topic Name | What It Is Not"
      const parts = line.split('|');
      const topicName = parts[0].trim();
      const negativeContext = parts.length > 1 ? parts[1].trim() : "";

      // A. Generate Standard Vector
      const rawVec = await generateEmbedding(topicName);
      
      let sculptedVec = null;

      if (negativeContext) {
        // B. Generate Negative Vector
        const negativeVec = await generateEmbedding(negativeContext);
        
        // C. The Scalpel: Subtract Negative from Standard
        sculptedVec = normalizeVector(rejectVector(rawVec, negativeVec));
      } else {
        sculptedVec = rawVec;
      }

      // D. Save to DB
      await db.insert(labTopics).values({
        topicName: topicName,
        category: 'EXPERIMENT_A',
        rawVector: rawVec,      
        pureVectorA: sculptedVec 
      });

      successCount++;
      await delay(200); // Rate limit protection
    }
    return { success: true, count: successCount };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}

// --- 2. DUAL SEARCH (Compare Results) ---
export async function runDualSearch(query: string) {
  try {
    // Note: We search using the RAW query against both columns.
    // The "Sculpting" happened in the database, so the database is now smart enough
    // to reject the query if the query matches the "Negative" part.
    const queryVec = await generateEmbedding(query);

    // Search 1: Standard (Blurry DB)
    const resStandard = await db.select({
      name: labTopics.topicName,
      similarity: sql<number>`1 - (${cosineDistance(labTopics.rawVector, queryVec)})`
    }).from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'))
      .orderBy(desc(sql`1 - (${cosineDistance(labTopics.rawVector, queryVec)})`)).limit(5);

    // Search 2: Sculpted (Contrastive DB)
    const resSculpted = await db.select({
      name: labTopics.topicName,
      similarity: sql<number>`1 - (${cosineDistance(labTopics.pureVectorA, queryVec)})`
    }).from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'))
      .orderBy(desc(sql`1 - (${cosineDistance(labTopics.pureVectorA, queryVec)})`)).limit(5);

    return { success: true, standard: resStandard, sculpted: resSculpted };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- 3. RESET ---
export async function clearLab() {
  await db.delete(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'));
  return { success: true };
}