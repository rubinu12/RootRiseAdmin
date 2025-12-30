"use server";

import { db, pool } from '@/lib/db';
import { topics } from '@/lib/schema';
import { v1, helpers } from '@google-cloud/aiplatform';
import { eq, and, sql } from 'drizzle-orm';

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID; 
const LOCATION = 'us-central1';
const MODEL_NAME = 'text-embedding-004'; 

const clientOptions = { apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`, fallback: true };
const predictionClient = new v1.PredictionServiceClient(clientOptions);

const slugify = (text: string) => 
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function generateEmbedding(text: string): Promise<number[]> {
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const [response] = await predictionClient.predict({
    endpoint,
    instances: [instance!],
    parameters: helpers.toValue({ 
      autoTruncate: true,
      outputDimensionality: 768 
    })!,
  });
  const result = helpers.fromValue(response.predictions![0] as any) as { embeddings: { values: number[] } };
  return result.embeddings.values;
}

export async function runIsolatedSemanticTrace(subject: string, anchor: string, detailed?: string) {
  try {
    const trace: any[] = [];
    
    const l2Node = await db.query.topics.findFirst({
      where: and(eq(topics.level, 2), eq(topics.name, subject))
    });

    if (!l2Node) return { success: false, error: `Subject "${subject}" not found.` };
    trace.push({ level: 2, name: l2Node.name, score: 1.0, status: "ROOT_LOCK" });

    // --- L3 RESOLUTION WITH COMPETITOR TRACKING ---
    const l3Vector = await generateEmbedding(anchor);
    // Fetch TOP 5 to see competition (e.g., Legislature)
    const l3Res = await pool.query(`
      SELECT id, name, (1 - (embedding <=> $1)) as similarity
      FROM topics 
      WHERE primary_parent_id = $2 AND level = 3 AND embedding IS NOT NULL
      ORDER BY similarity DESC LIMIT 5
    `, [JSON.stringify(l3Vector), l2Node.id]);

    const l3Matches = l3Res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        score: parseFloat(Number(r.similarity).toFixed(4))
    }));

    const bestL3 = l3Matches[0];
    trace.push({ 
        level: 3, 
        name: bestL3?.name || "NONE", 
        score: bestL3?.score || 0, 
        competitors: l3Matches.slice(1), // Show other 4 candidates
        status: (bestL3?.score || 0) >= 0.95 ? "CANONICAL" : "PROVISIONAL" 
    });

    // --- L4 RESOLUTION ---
    let l4Info = { name: "N/A", score: 0, competitors: [] as any[] };
    if (detailed && bestL3) {
      const l4Vector = await generateEmbedding(detailed);
      const l4Res = await pool.query(`
        SELECT id, name, (1 - (embedding <=> $1)) as similarity
        FROM topics 
        WHERE primary_parent_id = $2 AND level = 4 AND embedding IS NOT NULL
        ORDER BY similarity DESC LIMIT 5
      `, [JSON.stringify(l4Vector), bestL3.id]);

      const l4Matches = l4Res.rows.map((r: any) => ({
          name: r.name,
          score: parseFloat(Number(r.similarity).toFixed(4))
      }));

      const bestL4 = l4Matches[0];
      l4Info = { 
        name: bestL4?.name || "NONE", 
        score: bestL4?.score || 0,
        competitors: l4Matches.slice(1)
      };
      
      trace.push({ 
          level: 4, 
          ...l4Info,
          status: l4Info.score >= 0.95 ? "CANONICAL" : "PROVISIONAL" 
      });
    }

    const finalL3 = (bestL3?.score >= 0.95) ? bestL3.name : anchor;
    const pathPrefix = l2Node.ancestryPath?.toLowerCase().replace(/ > /g, '.');
    const proposedPath = `${pathPrefix}.${slugify(finalL3)}${detailed ? `.${slugify(detailed)}` : ''}`;
    const proposedSlug = `${l2Node.slug}-${slugify(finalL3)}${detailed ? `-${slugify(detailed)}` : ''}`;

    return { success: true, trace, metadata: { slug: proposedSlug, path: proposedPath } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}