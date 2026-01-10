// types/prelimIngestion.ts

// --- 1. QUESTION STRUCTURES ---

export type QuestionType = 'statement' | 'mcq' | 'pair';

export interface BaseQuestion {
  id: string; // Temporary ID (e.g., "temp-1")
  text: string;
  year: number;
  paper: string;
  source: string;
  type: QuestionType;
}

export interface StatementQuestion extends BaseQuestion {
  type: 'statement';
  statements: { 
    idx: number; 
    text: string; 
    isTrue: boolean; 
  }[];
  correctOption: string; // "A" | "B" | "C" | "D"
  options: { label: string; text: string }[];
}

export interface MCQQuestion extends BaseQuestion {
  type: 'mcq';
  options: { label: string; text: string }[];
  correctOption: string; 
}

export interface PairQuestion extends BaseQuestion {
  type: 'pair';
  pairs: {
    left: string;  // e.g., "Sthalwa"
    right: string; // e.g., "Graders"
    isCorrectMatch: boolean; // True if this specific row is factually correct
  }[];
  options: { label: string; text: string }[]; // e.g. "Only one pair", "Only two pairs"
  correctOption: string;
}

export type StagedQuestion = StatementQuestion | MCQQuestion | PairQuestion;

// --- 2. TOPIC & RESOLUTION STRUCTURES ---

export type NodeStatus = 'green' | 'red' | 'pending-create';

export interface TopicCandidate {
  id: string;      // DB UUID
  name: string;
  slug: string;
  similarity: number;
}

export interface TopicNode {
  name: string;
  level: 1 | 2 | 3 | 4;
  status: NodeStatus;
  
  // If status is 'green', we have a dbId
  dbId?: string; 
  slug?: string;

  // If status is 'pending-create', we store the parent info so we can create it later
  tempParentId?: string; 
  
  // NEW: If status is 'red', we store the semantic search results here
  candidates?: TopicCandidate[];
}

// A single topic chain (e.g. Polity > Executive > Governor)
export interface StagedTopicChain {
  id: string; // Unique ID for this chain in the UI
  rawString: string; 
  
  // The Breadcrumb Nodes
  l1: TopicNode; // Subject (GS2/Polity)
  l2: TopicNode; // Anchor (Executive)
  l3: TopicNode; // Topic (Governor)
  l4?: TopicNode; // Subtopic (Discretionary Power) - Optional

  // Flags for the UI
  isFullyResolved: boolean; 
}

// --- 3. THE BATCH PAYLOAD ---

export interface IngestionItem {
  id: string;
  question: StagedQuestion;
  topicChains: StagedTopicChain[];
  isValid: boolean; 
}