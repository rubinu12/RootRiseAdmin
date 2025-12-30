"use server";

import { db } from '@/lib/db';
import { labTopics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { eq, sql, cosineDistance, desc } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 
const API_ENDPOINT = `${LOCATION}-aiplatform.googleapis.com`;
const clientOptions = { apiEndpoint: API_ENDPOINT, fallback: true };
const predictionServiceClient = new v1.PredictionServiceClient(clientOptions);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- VECTOR MATH ---
const normalizeVector = (v: number[]) => {
  const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? v : v.map((val) => val / magnitude);
};

const addVectors = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
const subtractVectors = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const multiplyVector = (v: number[], scalar: number) => v.map((val) => val * scalar);
const dotProduct = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

// ORTHOGONAL SCALPEL (Gram-Schmidt)
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

// --- NEW: CALCULATE "MODE" (PC1 - First Principal Component) ---
// This finds the "Dominant Direction" of the data, effectively the "Mode"
function computePC1(vectors: number[][], iterations = 10): number[] {
  const dim = vectors[0].length;
  // 1. Center the data (Subtract Mean first to find true variance)
  let mean = new Array(dim).fill(0);
  vectors.forEach(v => mean = addVectors(mean, v));
  mean = mean.map(x => x / vectors.length);
  
  const centeredVectors = vectors.map(v => subtractVectors(v, mean));

  // 2. Power Iteration to find PC1
  // Start with a random vector (or just the first one)
  let candidate = centeredVectors[0]; 
  candidate = normalizeVector(candidate);

  for (let i = 0; i < iterations; i++) {
    let nextCandidate = new Array(dim).fill(0);
    
    // Project all data onto candidate and sum up (Matrix Multiplication approx)
    for (const vec of centeredVectors) {
      const projection = dotProduct(vec, candidate);
      const weightedVec = multiplyVector(vec, projection);
      nextCandidate = addVectors(nextCandidate, weightedVec);
    }
    
    candidate = normalizeVector(nextCandidate);
  }
  
  return candidate; // This is the "Mode" Axis
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!PROJECT_ID) throw new Error("GOOGLE_PROJECT_ID is missing.");
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const parameters = helpers.toValue({ autoTruncate: true, outputDimensionality: 768 });
  const [response] = await predictionServiceClient.predict({ endpoint, instances: [instance!], parameters: parameters! });
  const result = helpers.fromValue(response.predictions![0] as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

// --- SEEDING ---
export async function seedLabTopics(topicList: string[]) {
  try {
    const cleanList = topicList.map(t => t.trim()).filter(t => t.length > 0);
    let successCount = 0;
    await db.delete(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'));

    for (const topicName of cleanList) {
      const rawVec = await generateEmbedding(topicName);
      await db.insert(labTopics).values({
        topicName: topicName,
        category: 'EXPERIMENT_A',
        rawVector: rawVec,
        pureVectorA: null, 
        pureVectorB: null,
      });
      successCount++;
      await delay(200); 
    }
    return { success: true, count: successCount };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- CALIBRATION (UPDATED WITH PC1/MODE) ---
// Lens A = Manual
// Lens B = AUTO MODE (PC1)
export async function calibrateLabDNA(noiseTextA: string) {
  try {
    // 1. Prepare Lens A (Manual Noise)
    const noiseVecA = await generateEmbedding(noiseTextA); 

    // 2. Prepare Lens B (AUTO MODE / PC1)
    const allTopics = await db.select().from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'));
    if (allTopics.length === 0) throw new Error("No topics to calibrate.");

    // Extract raw vectors
    const validVectors = allTopics
      .filter(t => t.rawVector !== null)
      .map(t => t.rawVector as number[]);

    if (validVectors.length < 2) throw new Error("Need at least 2 topics to calculate Mode.");

    // CALCULATE THE MODE (PC1)
    const noiseVecB = computePC1(validVectors);

    // 3. Save Both Profiles
    await db.delete(labTopics).where(eq(labTopics.category, 'SYSTEM'));
    await db.insert(labTopics).values({ topicName: 'NOISE_A', category: 'SYSTEM', rawVector: noiseVecA });
    await db.insert(labTopics).values({ topicName: 'NOISE_B', category: 'SYSTEM', rawVector: noiseVecB }); // Saved as Mode

    // 4. Apply Scalpels
    let updateCount = 0;
    for (const topic of allTopics) {
      if (!topic.rawVector) continue;

      // Lens A: Rejects "Polity" (Manual)
      const pureA = normalizeVector(rejectVector(topic.rawVector, noiseVecA));
      
      // Lens B: Rejects "The Mode" (Auto PC1)
      const pureB = normalizeVector(rejectVector(topic.rawVector, noiseVecB));

      await db.update(labTopics)
        .set({ pureVectorA: pureA, pureVectorB: pureB })
        .where(eq(labTopics.id, topic.id));
        
      updateCount++;
    }

    return { success: true, message: `Calibrated. Lens B stripped the Vector Mode (PC1) of ${validVectors.length} topics.` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- SEARCH ---
export async function runDualSearch(query: string) {
  try {
    const rawQuery = await generateEmbedding(query);

    const noiseA = await db.query.labTopics.findFirst({ where: eq(labTopics.topicName, 'NOISE_A') });
    const noiseB = await db.query.labTopics.findFirst({ where: eq(labTopics.topicName, 'NOISE_B') });

    if (!noiseA?.rawVector || !noiseB?.rawVector) throw new Error("Lab not calibrated.");

    // Pure Queries
    const queryA = normalizeVector(rejectVector(rawQuery, noiseA.rawVector));
    const queryB = normalizeVector(rejectVector(rawQuery, noiseB.rawVector));

    // Search 1: Standard
    const resStandard = await db.select({
      name: labTopics.topicName,
      similarity: sql<number>`1 - (${cosineDistance(labTopics.rawVector, rawQuery)})`
    }).from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'))
      .orderBy(desc(sql`1 - (${cosineDistance(labTopics.rawVector, rawQuery)})`)).limit(5);

    // Search 2: Lens A (Polity Removed)
    const resA = await db.select({
      name: labTopics.topicName,
      similarity: sql<number>`1 - (${cosineDistance(labTopics.pureVectorA, queryA)})`
    }).from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'))
      .orderBy(desc(sql`1 - (${cosineDistance(labTopics.pureVectorA, queryA)})`)).limit(5);

    // Search 3: Lens B (Mode/PC1 Removed)
    const resB = await db.select({
      name: labTopics.topicName,
      similarity: sql<number>`1 - (${cosineDistance(labTopics.pureVectorB, queryB)})`
    }).from(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'))
      .orderBy(desc(sql`1 - (${cosineDistance(labTopics.pureVectorB, queryB)})`)).limit(5);

    return { success: true, standard: resStandard, pureA: resA, pureB: resB };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function clearLab() {
  await db.delete(labTopics).where(eq(labTopics.category, 'EXPERIMENT_A'));
  await db.delete(labTopics).where(eq(labTopics.category, 'SYSTEM'));
  return { success: true };
}