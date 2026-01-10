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

// --- 1. HELPERS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateEmbedding(text: string, retryCount = 0): Promise<number[]> {
  if (!PROJECT_ID) throw new Error("GOOGLE_PROJECT_ID is missing.");
  
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const parameters = helpers.toValue({ 
    autoTruncate: true,
    outputDimensionality: 768 
  });

  try {
    const [response] = await predictionServiceClient.predict({
      endpoint,
      instances: [instance!],
      parameters: parameters!,
    });

    const result = helpers.fromValue(response.predictions![0] as any) as {
      embeddings: { values: number[] }
    };
    return result.embeddings.values;

  } catch (error: any) {
    // Aggressive Retry Logic (Up to 5 times with longer waits)
    if (
      (error.code === 429 || error.code === 8 || error.message?.includes('Quota') || error.message?.includes('RESOURCE_EXHAUSTED')) 
      && retryCount < 5
    ) {
      // Wait 2s, 4s, 8s...
      const waitTime = Math.pow(2, retryCount) * 1000 + 1000;
      console.log(`⚠️ Quota hit. Retrying in ${waitTime}ms... (${retryCount + 1}/5)`);
      await delay(waitTime); 
      return generateEmbedding(text, retryCount + 1);
    }
    throw error;
  }
}

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

export async  function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

// --- 2. CREATE ROOT (L1) ---
export async function createRootTopic(name: string) {
  try {
    const slug = await slugify(name);
    await db.insert(topics).values({
      name: name,
      slug: slug,
      level: 1,
      primaryParentId: null,
      ancestryPath: slug,
      topicType: 'canonical',
      rawVector: null,
      sharpVector: null,
      pureVector: null,
      isNavigable: true,
    });
    revalidatePath('/topic-tree');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- 3. INDESTRUCTIBLE SERIAL SEEDER ---
export async function smartBulkSeed(parentId: string, rawText: string) {
  // A. PREPARE CONTEXT
  const parentNode = await db.query.topics.findFirst({ where: eq(topics.id, parentId) });
  if (!parentNode) throw new Error("Parent node not found.");
  
  const parentPath = parentNode.ancestryPath ? parentNode.ancestryPath.toLowerCase() : "";
  const parentLevel = parentNode.level || 1;

  // B. PREPARE LINES
  const lines = rawText.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  const results = { created: 0, errors: [] as string[] };

  // C. STATE TRACKING (Active Parents)
  // We keep vectors in memory to avoid DB lookups during the loop
  let activeL2 = { 
    id: parentLevel === 2 ? parentNode.id : null, 
    slug: parentLevel === 2 ? parentNode.slug : "", 
    path: parentLevel === 2 ? parentNode.ancestryPath : "", 
    vector: parentLevel === 2 ? parentNode.rawVector : null,
    failed: false 
  };
  
  let activeL3 = { 
    id: parentLevel === 3 ? parentNode.id : null, 
    slug: parentLevel === 3 ? parentNode.slug : "", 
    path: parentLevel === 3 ? parentNode.ancestryPath : "", 
    vector: parentLevel === 3 ? parentNode.rawVector : null,
    failed: false
  };

  // D. LOOP ONE-BY-ONE
  for (const line of lines) {
    const client = await pool.connect(); // New connection for each item (Atomic commits)
    
    try {
      const trimmed = line.trim();
      
      // --- 1. Identify Level ---
      const isL4 = trimmed.startsWith('--');
      const isL3 = !isL4 && trimmed.startsWith('-');
      const isL2 = !isL4 && !isL3 && trimmed.startsWith('+');
      const targetLevel = isL2 ? 2 : isL3 ? 3 : 4;

      // --- 2. Check for "Domino Failures" ---
      // If L2 failed, we MUST skip its L3 children to avoid Foreign Key errors
      if (isL3 && activeL2.failed) {
        results.errors.push(`Skipped child of failed L2: ${trimmed}`);
        continue;
      }
      if (isL4 && activeL3.failed) {
        results.errors.push(`Skipped child of failed L3: ${trimmed}`);
        continue;
      }

      // --- 3. Parse Content ---
      const content = trimmed.replace(/^[+\-\-]+/, '').trim();
      const [leftSide, negativeContextRaw] = content.split('|');
      const negativeContext = negativeContextRaw ? negativeContextRaw.trim() : "";
      const [displayNameRaw, positiveContextRaw] = leftSide.split('\\');
      const displayName = displayNameRaw.trim();
      const positiveContext = positiveContextRaw ? positiveContextRaw.trim() : "";

      // --- 4. Determine Parent ---
      let currentParentId = parentId;
      let currentParentPath = parentPath;
      let currentParentSlug = parentNode.slug;
      let subtractionVector: number[] | null = null;

      if (isL2) {
        if (parentLevel !== 1) throw new Error("L2 must be under L1");
        currentParentId = parentNode.id;
        subtractionVector = null; 
      } 
      else if (isL3) {
        if (!activeL2.id) throw new Error("No Active L2 Parent");
        currentParentId = activeL2.id;
        currentParentPath = activeL2.path || "";
        currentParentSlug = activeL2.slug;
        subtractionVector = activeL2.vector; 
      } 
      else if (isL4) {
        if (!activeL3.id) throw new Error("No Active L3 Parent");
        currentParentId = activeL3.id;
        currentParentPath = activeL3.path || "";
        currentParentSlug = activeL3.slug;
        subtractionVector = activeL3.vector; 
      }

      // --- 5. Generate Vectors (This is where Quota might hit) ---
      const aiInput = positiveContext ? `${displayName} ${positiveContext}` : displayName;
      
      // We start transaction ONLY after expensive API calls succeed 
      // This reduces database lock time significantly
      const rawVector = await generateEmbedding(aiInput);
      
      let sharpVector = rawVector;
      if (subtractionVector) {
        sharpVector = normalizeVector(rejectVector(rawVector, subtractionVector));
      }

      let pureVector = null;
      if (negativeContext) {
        const negVector = await generateEmbedding(negativeContext);
        pureVector = normalizeVector(rejectVector(rawVector, negVector));
      }

      // --- 6. Database Insert (Short Transaction) ---
      await client.query('BEGIN');

      const finalSlug = `${currentParentSlug}-${slugify(displayName)}`;
      const finalPath = currentParentPath ? `${currentParentPath}.${slugify(displayName)}` : slugify(displayName);

      const res = await client.query(`
        INSERT INTO topics (
          name, slug, level, primary_parent_id, ancestry_path, topic_type, 
          definition_string, raw_vector, sharp_vector, pure_vector
        )
        VALUES ($1, $2, $3, $4, $5, 'canonical', $6, $7, $8, $9)
        ON CONFLICT (slug) DO UPDATE SET 
          name = EXCLUDED.name,
          raw_vector = EXCLUDED.raw_vector,
          sharp_vector = EXCLUDED.sharp_vector,
          pure_vector = EXCLUDED.pure_vector,
          definition_string = EXCLUDED.definition_string
        RETURNING id, ancestry_path, slug;
      `, [
        displayName, finalSlug, targetLevel, currentParentId, finalPath, content,
        JSON.stringify(rawVector), JSON.stringify(sharpVector), pureVector ? JSON.stringify(pureVector) : null
      ]);

      await client.query('COMMIT');
      
      // Success! Update State
      if (isL2) {
        activeL2 = { id: res.rows[0].id, slug: res.rows[0].slug, path: res.rows[0].ancestry_path, vector: rawVector, failed: false };
        activeL3 = { id: null, slug: "", path: "", vector: null, failed: false }; // Reset L3
      } else if (isL3) {
        activeL3 = { id: res.rows[0].id, slug: res.rows[0].slug, path: res.rows[0].ancestry_path, vector: rawVector, failed: false };
      }
      
      results.created++;
      
      // --- 7. CRITICAL: RATE LIMIT DELAY ---
      // We wait 1.5 seconds AFTER every item. 
      // This keeps us at ~40 requests/minute (Safe Zone)
      await delay(1500);

    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`Skipping "${line}":`, err.message);
      results.errors.push(`${line.substring(0, 20)}... Failed: ${err.message}`);
      
      // MARK AS FAILED so we don't try to add children to this ghost node
      const trimmed = line.trim();
      const isL2 = !trimmed.startsWith('-') && !trimmed.startsWith('--');
      const isL3 = trimmed.startsWith('-') && !trimmed.startsWith('--');
      
      if (isL2) activeL2.failed = true;
      if (isL3) activeL3.failed = true;
      
    } finally {
      client.release();
    }
  }

  revalidatePath('/topic-tree');
  return { success: true, ...results };
}

// ... Exports ...
export async function getRootNodes() {
  return await db.query.topics.findMany({ where: eq(topics.level, 1), orderBy: [topics.name] });
}
export async function getChildren(parentId: string) {
  return await db.query.topics.findMany({ where: eq(topics.primaryParentId, parentId), orderBy: [topics.name] });
}