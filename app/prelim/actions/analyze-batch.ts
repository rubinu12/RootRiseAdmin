"use server";

import { db } from "@/lib/db";
import { topics } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { findBestMatchUnderParent } from "@/app/prelim/actions/recursive-search";
import {
  IngestionItem,
  StagedQuestion,
  StagedTopicChain,
  TopicNode,
  TopicCandidate,
} from "@/types/prelimIngestion";

export async function analyzeIncomingBatch(
  jsonRaw: string
): Promise<IngestionItem[]> {
  try {
    const batch = JSON.parse(jsonRaw);
    const results: IngestionItem[] = [];

    for (const [idx, item] of batch.entries()) {
      const qData = item.question;
      const meta = item.meta;
      const rawTopics = item.topics || [];

      const stagedChains: StagedTopicChain[] = [];
      let isQuestionValid = true;

      // --- 1. PROCESS TOPIC CHAINS ---
      for (const [tIdx, t] of rawTopics.entries()) {
        const chainId = `chain-${idx}-${tIdx}`;

        // --- LEVEL 2: SUBJECT (HARD CHECK ONLY) ---
        // As per rule: If L2 fails, we stop processing this chain/question
        const l2NodeDB = await db.query.topics.findFirst({
          where: and(eq(topics.level, 2), eq(topics.name, t.subject)),
        });

        if (!l2NodeDB) {
          // STOP: Subject must exist
          isQuestionValid = false;
          // We push a "Dead" chain to show the error in UI
          stagedChains.push({
            id: chainId,
            rawString: `${t.subject} > ${t.anchor}`,
            l1: { name: "GS", level: 1, status: "green" }, // Mock Root
            l2: { name: t.subject, level: 2, status: "red" },
            l3: { name: t.anchor, level: 3, status: "red" },
            isFullyResolved: false,
          });
          continue; // Move to next topic/question logic
        }

        const l2Node: TopicNode = {
          name: l2NodeDB.name,
          level: 2,
          status: "green",
          dbId: l2NodeDB.id,
          slug: l2NodeDB.slug,
        };

        // --- LEVEL 3: ANCHOR (HARD -> SEMANTIC) ---
        let l3Node: TopicNode = { name: t.anchor, level: 3, status: "red" };

        // A. Hard Search
        const l3NodeDB = l2Node.dbId
          ? await db.query.topics.findFirst({
              where: and(
                eq(topics.level, 3),
                eq(topics.primaryParentId, l2Node.dbId),
                eq(topics.name, t.anchor)
              ),
            })
          : undefined;

        if (l3NodeDB) {
          // Found Exact Match
          l3Node = {
            name: l3NodeDB.name,
            level: 3,
            status: "green",
            dbId: l3NodeDB.id,
            slug: l3NodeDB.slug,
          };
        } else {
          // Not Found -> Semantic Search for Candidates
          const semanticResult = await findBestMatchUnderParent(
            l2Node.dbId!,
            3,
            t.anchor
          );

          // Map raw DB result to our Candidate Type
          const candidates: TopicCandidate[] = semanticResult.candidates.map(
            (c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              similarity: c.similarity,
            })
          );

          l3Node.candidates = candidates;
        }

        // --- LEVEL 4: DETAILED (HARD -> SEMANTIC) ---
        // We can only check L4 if L3 was resolved (Green)
        let l4Node: TopicNode | undefined = undefined;

        if (t.detailed) {
          l4Node = { name: t.detailed, level: 4, status: "red" };

          if (l3Node.status === "green" && l3Node.dbId) {
            // A. Hard Search
            const l4NodeDB = l3Node.dbId
              ? await db.query.topics.findFirst({
                  where: and(
                    eq(topics.level, 4),
                    eq(topics.primaryParentId, l3Node.dbId),
                    eq(topics.name, t.detailed)
                  ),
                })
              : undefined;

            if (l4NodeDB) {
              l4Node = {
                name: l4NodeDB.name,
                level: 4,
                status: "green",
                dbId: l4NodeDB.id,
                slug: l4NodeDB.slug,
              };
            } else {
              // Not Found -> Semantic Search
              const semanticResult = await findBestMatchUnderParent(
                l3Node.dbId,
                4,
                t.detailed
              );

              const candidates: TopicCandidate[] =
                semanticResult.candidates.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  similarity: c.similarity,
                }));

              l4Node.candidates = candidates;
            }
          }
          // If L3 is Red, L4 stays Red with no candidates (Logic: Fix Parent First)
        }

        // --- CHECK RESOLUTION ---
        const isChainResolved =
          l2Node.status === "green" &&
          l3Node.status === "green" &&
          (!l4Node || l4Node.status === "green");

        if (!isChainResolved) isQuestionValid = false;

        stagedChains.push({
          id: chainId,
          rawString: `${t.subject} > ${t.anchor}${
            t.detailed ? " > " + t.detailed : ""
          }`,
          l1: { name: "GS", level: 1, status: "green" },
          l2: l2Node,
          l3: l3Node,
          l4: l4Node,
          isFullyResolved: isChainResolved,
        });
      }

      // --- 2. CONSTRUCT QUESTION OBJECT ---
      const stagedQuestion: StagedQuestion = {
        id: `q-${Date.now()}-${idx}`,
        text: qData.question_text,
        year: meta.year,
        paper: meta.paper || "GS",
        source: meta.source || "UPSC",
        type:
          meta.question_type === "pair"
            ? "pair"
            : meta.question_type === "statement"
            ? "statement"
            : "mcq",

        // Union Type Handling
        ...(meta.question_type === "statement"
          ? {
              statements:
                qData.statements?.map((s: any) => ({
                  idx: s.idx,
                  text: s.text,
                  isTrue: s.is_statement_true,
                })) || [],
              correctOption: qData.correct_option,
              options: qData.options || [],
            }
          : {}),

        ...(meta.question_type === "mcq"
          ? {
              options: qData.options || [],
              correctOption: qData.correct_option,
            }
          : {}),

        ...(meta.question_type === "pair"
          ? {
              pairs: qData.pairs || [],
              options: qData.options || [],
              correctOption: qData.correct_option,
            }
          : {}),
      } as StagedQuestion;

      results.push({
        id: `item-${idx}`,
        question: stagedQuestion,
        topicChains: stagedChains,
        isValid: isQuestionValid,
      });
    }

    return results;
  } catch (error: any) {
    console.error("Batch Analysis Error:", error);
    // Return empty array or throw, handled by UI try/catch
    throw new Error("Failed to analyze batch: " + error.message);
  }
}
