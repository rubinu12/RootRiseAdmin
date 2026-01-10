"use server";

import { db } from "@/lib/db";
import {
  topics,
  prelimQuestions,
  prelimQuestionStatements,
  prelimQuestionPairs,
  prelimQuestionTopics,
} from "@/lib/schema";
import { recursiveVectorSearch } from "../prelim/actions/recursive-search";
import { smartBulkSeed } from "./topic-tree-actions"; // Reuse this to generate vectors when creating new topics
import { eq, and } from "drizzle-orm";

// --- 1. ANALYZE JSON & FIND TOPICS ---
export async function analyzeQuestionJson(jsonData: any) {
  try {
    const qData = jsonData.question;
    const tData = jsonData.topics ? jsonData.topics[0] : null; // Focus on primary topic

    const result = {
      aiSuggestion: null as any,
      exactTopicMatch: null as any,
      isNewTopic: false,
      parsedData: jsonData,
    };

    // A. AI SUGGESTION (Recursive Search on Question Text)
    // We combine question text + first statement/pair to give the AI context
    let searchText = qData.question_text;
    if (qData.statements && qData.statements[0])
      searchText += " " + qData.statements[0].text;
    if (qData.pairs && qData.pairs[0]) searchText += " " + qData.pairs[0].col1;

    const aiRes = await recursiveVectorSearch(searchText);
    if (aiRes.success) {
      result.aiSuggestion = aiRes.finalNode;
    }

    // B. EXACT TOPIC CHECK (Does the JSON path exist?)
    if (tData) {
      // Logic: Does a topic with name == 'detailed' exist?
      // You might want to make this stricter by checking parentage, but name search is a good start.
      const exactMatch = await db.query.topics.findFirst({
        where: eq(topics.name, tData.detailed),
      });

      if (exactMatch) {
        result.exactTopicMatch = exactMatch;
      } else {
        result.isNewTopic = true;
      }
    }

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- 2. CREATE NEW TOPIC (One-Click) ---
export async function createTopicFromJson(
  subject: string,
  anchor: string,
  detailed: string
) {
  try {
    // 1. Find or Create Subject (L1)
    let l1 = await db.query.topics.findFirst({
      where: eq(topics.name, subject),
    });
    if (!l1)
      return {
        success: false,
        error: `Subject L1 '${subject}' not found. Please create root manually first.`,
      };

    // 2. Find or Create Anchor (L2)
    let l2 = await db.query.topics.findFirst({
      where: and(eq(topics.name, anchor), eq(topics.primaryParentId, l1.id)),
    });

    // If L2 missing, we try to seed it
    if (!l2) {
      await smartBulkSeed(l1.id, `+ ${anchor}`);
      // Re-fetch
      l2 = await db.query.topics.findFirst({
        where: and(eq(topics.name, anchor), eq(topics.primaryParentId, l1.id)),
      });
      if (!l2) return { success: false, error: "Failed to create L2 Anchor." };
    }

    // 3. Create Detailed Topic (L3)
    // We use smartBulkSeed which handles vector generation automatically!
    // Input format: "- Detailed Topic"
    const res = await smartBulkSeed(l2.id, `- ${detailed}`);

    if (!res.success) return { success: false, error: res.error };

    // Fetch the newly created topic to return it
    const newTopic = await db.query.topics.findFirst({
      where: and(eq(topics.name, detailed), eq(topics.primaryParentId, l2.id)),
    });

    return { success: true, topic: newTopic };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- 3. SAVE QUESTION (The Commit) ---
export async function saveFinalQuestion(payload: {
  json: any;
  topicId: string;
}) {
  try {
    const { json, topicId } = payload;
    const q = json.question;
    const meta = json.meta;

    // 1. Insert Parent Question
    const [insertedQ] = await db
      .insert(prelimQuestions)
      .values({
        year: meta.year,
        source: meta.source,
        questionType: meta.question_type,
        questionText: q.question_text,
        optionA: q.options[0]?.text,
        optionB: q.options[1]?.text,
        optionC: q.options[2]?.text,
        optionD: q.options[3]?.text,
        correctOption: q.correct_option,
        weightage: q.weightage,
      })
      .returning({ id: prelimQuestions.id });

    if (!insertedQ) throw new Error("Failed to insert question header");

    // 2. Insert Children (Statements OR Pairs)
    if (meta.question_type === "statement" && q.statements) {
      for (const stmt of q.statements) {
        await db.insert(prelimQuestionStatements).values({
          questionId: insertedQ.id,
          statementNumber: stmt.idx,
          statementText: stmt.text,
          correctTruth: stmt.is_statement_true,
        });
      }
    } else if (meta.question_type === "pair" && q.pairs) {
      for (const pair of q.pairs) {
        await db.insert(prelimQuestionPairs).values({
          questionId: insertedQ.id,
          col1: pair.col1,
          col2: pair.col2,
          correctMatch: pair.correct_match,
          col1Header: q.pair_headers ? q.pair_headers[0] : null,
          col2Header: q.pair_headers ? q.pair_headers[1] : null,
        });
      }
    }

    // 3. Link Topic
    if (topicId) {
      await db.insert(prelimQuestionTopics).values({
        questionId: insertedQ.id,
        topicId: topicId,
      });
    }

    return { success: true, questionId: insertedQ.id };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

// --- 4. MANUAL SEARCH HELPER ---
export async function manualSearchTopic(query: string) {
  const results = await db.query.topics.findMany({
    where: (table, { ilike }) => ilike(table.name, `%${query}%`),
    limit: 5,
  });
  return results;
}
