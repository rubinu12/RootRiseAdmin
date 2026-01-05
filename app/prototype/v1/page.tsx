'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Plus, 
  RefreshCcw, 
  Edit3, 
  ChevronRight, 
  Save, 
  Trash2 
} from 'lucide-react';

// --- MOCK DATA & TYPES ---

type Topic = {
  subject: string; // L2
  anchor: string;  // L3
  detailed?: string; // L4 (Optional)
};

type Question = {
  id: string;
  question_text: string;
  type: 'statement' | 'mcq';
  statements?: { idx: number; text: string; is_true: boolean }[];
  options: { label: string; text: string }[];
  correct_option: string;
  topics: Topic[]; // AI Suggestions
};

// The "Single Source of Truth" Database (Mock)
const INITIAL_DB_TOPICS = [
  { subject: 'Polity', anchor: 'State Executive', detailed: 'Governor' },
  { subject: 'Polity', anchor: 'Parliament', detailed: 'Lok Sabha' },
  { subject: 'Economy', anchor: 'Banking', detailed: 'RBI' },
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'statement',
    question_text: 'Consider the following statements regarding the Governor:',
    statements: [
      { idx: 1, text: 'The Governor has no discretionary powers under the Constitution.', is_true: false },
      { idx: 2, text: 'He is appointed by the President.', is_true: true }
    ],
    options: [{ label: 'A', text: '1 only' }, { label: 'B', text: '2 only' }],
    correct_option: 'B',
    topics: [
      { subject: 'Polity', anchor: 'State Executive', detailed: 'Governor Discretionary Powers' } // RED: "Governor Discretionary Powers" not in DB
    ]
  },
  {
    id: 'q2',
    type: 'mcq',
    question_text: 'Which Article deals with the Money Bill?',
    options: [
      { label: 'A', text: 'Article 110' },
      { label: 'B', text: 'Article 112' }
    ],
    correct_option: 'A',
    topics: [
      { subject: 'Polity', anchor: 'Parliament', detailed: 'Lok Sabha' } // GREEN: Exists
    ]
  },
  {
    id: 'q3',
    type: 'statement',
    question_text: 'Regarding RBI monetary policy:',
    statements: [
      { idx: 1, text: 'Repo rate is a qualitative tool.', is_true: false },
      { idx: 2, text: 'CRR is maintained with RBI.', is_true: true }
    ],
    options: [],
    correct_option: 'B',
    topics: [
      { subject: 'Economy', anchor: 'Banking', detailed: 'Monetary Policy Tools' } // RED: New topic
    ]
  }
];

// --- COMPONENTS ---

export default function IngestionStudio() {
  // --- STATE ---
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [dbTopics, setDbTopics] = useState<Topic[]>(INITIAL_DB_TOPICS);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  
  // Validation Logic: Check if a topic exists in DB
  const checkTopicStatus = (topic: Topic) => {
    const exists = dbTopics.some(t => 
      t.subject === topic.subject && 
      t.anchor === topic.anchor && 
      (t.detailed === topic.detailed || (!t.detailed && !topic.detailed))
    );
    return exists ? 'green' : 'red';
  };

  // Derived State: Global Validity
  const questionStatuses = useMemo(() => {
    return questions.map(q => {
      const allTopicsValid = q.topics.every(t => checkTopicStatus(t) === 'green');
      return { id: q.id, isValid: allTopicsValid };
    });
  }, [questions, dbTopics]);

  const allValid = questionStatuses.every(qs => qs.isValid);

  // --- ACTIONS ---

  const handleCreateTopic = (topic: Topic) => {
    // Add to "DB"
    setDbTopics(prev => [...prev, topic]);
  };

  const handleRemoveTopic = (qId: string, topicIndex: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const newTopics = [...q.topics];
      newTopics.splice(topicIndex, 1);
      return { ...q, topics: newTopics };
    }));
  };

  const startEdit = (q: Question) => {
    // Create a simplified pseudo-JSON for editing
    const cleanData = {
      text: q.question_text,
      statements: q.statements?.map(s => ({ text: s.text, true: s.is_true })),
      options: q.options?.map(o => ({ label: o.label, text: o.text })),
      correct: q.correct_option
    };
    setEditBuffer(JSON.stringify(cleanData, null, 2)); // Using standard JSON for prototype, pseudo-JSON logic would go here
    setEditingId(q.id);
  };

  const saveEdit = () => {
    if (!editingId) return;
    try {
      const parsed = JSON.parse(editBuffer);
      setQuestions(prev => prev.map(q => {
        if (q.id !== editingId) return q;
        return {
          ...q,
          question_text: parsed.text,
          statements: parsed.statements?.map((s:any, i:number) => ({ idx: i+1, text: s.text, is_true: s.true })),
          options: parsed.options,
          correct_option: parsed.correct
        };
      }));
      setEditingId(null);
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  const scrollToQuestion = (id: string) => {
    setActiveQuestionId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* --- COLUMN A: SMART NAVIGATION (30%) --- */}
      <aside className="w-[30%] h-full flex flex-col border-r border-slate-200 bg-white shadow-sm z-10">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Ingestion Queue</h2>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-slate-800">{questions.length} Questions</span>
            <span className="text-xs font-medium text-slate-500">
              {questionStatuses.filter(s => s.isValid).length} Ready / {questionStatuses.filter(s => !s.isValid).length} Action
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {questions.map((q, idx) => {
            const status = questionStatuses.find(s => s.id === q.id);
            const isRed = !status?.isValid;
            const isActive = activeQuestionId === q.id;

            return (
              <div 
                key={q.id}
                onClick={() => scrollToQuestion(q.id)}
                className={`
                  group flex items-center p-3 rounded-lg cursor-pointer border transition-all duration-200
                  ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}
                `}
              >
                <div className={`
                  w-2.5 h-2.5 rounded-full mr-3 shrink-0
                  ${isRed ? 'bg-red-500 animate-pulse' : 'bg-green-500'}
                `} />
                <div className="overflow-hidden">
                  <p className="text-xs font-mono text-slate-400 mb-0.5">Q{idx + 1} • {q.id}</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{q.question_text}</p>
                </div>
                {isRed && (
                  <div className="ml-auto text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                    RESOLVE
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* COMMIT BUTTON */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button 
            disabled={!allValid}
            className={`
              w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all
              ${allValid 
                ? 'bg-slate-900 text-white hover:bg-black shadow-lg hover:shadow-xl' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}
            `}
          >
            {allValid ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {allValid ? 'COMMIT ALL QUESTIONS' : 'RESOLVE RED TOPICS TO COMMIT'}
          </button>
        </div>
      </aside>

      {/* --- COLUMN B: WORK AREA (70%) --- */}
      <main className="w-[70%] h-full bg-slate-100 overflow-y-auto relative">
        <div className="max-w-4xl mx-auto p-8 space-y-6 pb-20">
          
          {questions.map((q, idx) => (
            <QuestionCard 
              key={q.id} 
              question={q} 
              idx={idx} 
              checkTopicStatus={checkTopicStatus}
              onCreateTopic={handleCreateTopic}
              onRemoveTopic={handleRemoveTopic}
              onEdit={() => startEdit(q)}
            />
          ))}

        </div>
      </main>

      {/* --- EDIT SIDE PANEL (SLIDE OVER) --- */}
      {editingId && (
        <>
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setEditingId(null)}
          />
          <div className="absolute top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Edit3 size={16} /> Edit Question Content
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative">
              <textarea 
                className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-white text-slate-800"
                value={editBuffer}
                onChange={(e) => setEditBuffer(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={saveEdit}
                className="w-full py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// --- SUB-COMPONENTS ---

function QuestionCard({ 
  question, 
  idx, 
  checkTopicStatus,
  onCreateTopic,
  onRemoveTopic,
  onEdit 
}: { 
  question: Question; 
  idx: number; 
  checkTopicStatus: (t: Topic) => 'green' | 'red'; 
  onCreateTopic: (t: Topic) => void;
  onRemoveTopic: (qid: string, index: number) => void;
  onEdit: () => void;
}) {
  return (
    <div id={question.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
      
      {/* CARD HEADER */}
      <div className="flex justify-between items-start p-5 pb-3">
        <div className="flex gap-3">
          <span className="text-xs font-bold text-slate-400 pt-1">Q{idx + 1}</span>
          <p className="text-base font-medium text-slate-900 leading-relaxed max-w-2xl">
            {question.question_text}
          </p>
        </div>
        <button 
          onClick={onEdit}
          className="text-slate-300 hover:text-blue-600 transition-colors p-1"
          title="Edit Content"
        >
          <Edit3 size={16} />
        </button>
      </div>

      {/* CARD BODY: STATEMENTS & OPTIONS */}
      <div className="px-5 pb-4 pl-12">
        {question.type === 'statement' && question.statements ? (
          <div className="space-y-2 mb-3">
            {question.statements.map((s) => (
              <div key={s.idx} className="flex gap-3 items-start group">
                <div className={`
                  mt-1 w-2 h-2 rounded-full shrink-0
                  ${s.is_true ? 'bg-green-500' : 'bg-red-400'}
                `} title={s.is_true ? "True Statement" : "False Statement"} />
                <p className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                  <span className="font-mono text-slate-400 mr-2">{s.idx}.</span>
                  {s.text}
                </p>
              </div>
            ))}
             <div className="mt-3 inline-block px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">
                Correct Option: <span className="font-bold text-slate-900">{question.correct_option}</span>
            </div>
          </div>
        ) : (
          // Standard MCQ
          <div className="grid grid-cols-2 gap-2 text-sm">
            {question.options.map((opt) => (
              <div 
                key={opt.label}
                className={`
                  p-2 rounded border flex items-center gap-2
                  ${question.correct_option === opt.label 
                    ? 'border-green-200 bg-green-50 text-green-900 font-medium' 
                    : 'border-slate-100 text-slate-500'}
                `}
              >
                <span className="font-bold">{opt.label}</span> {opt.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CARD FOOTER: TOPIC BREADCRUMBS (THE CORE MECHANIC) */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Intent:</span>
        
        {question.topics.map((topic, tIdx) => {
          const status = checkTopicStatus(topic);
          return (
            <TopicBreadcrumb 
              key={`${tIdx}`} 
              topic={topic} 
              status={status} 
              onResolveCreate={() => onCreateTopic(topic)}
              onRemove={() => onRemoveTopic(question.id, tIdx)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TopicBreadcrumb({ 
  topic, 
  status, 
  onResolveCreate, 
  onRemove 
}: { 
  topic: Topic; 
  status: 'green' | 'red'; 
  onResolveCreate: () => void;
  onRemove: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  // Close menu on outside click logic would go here in prod
  
  return (
    <div className="relative">
      <div 
        onClick={() => status === 'red' && setShowMenu(!showMenu)}
        className={`
          flex items-center text-xs border rounded-md px-2 py-1 transition-all cursor-pointer select-none
          ${status === 'green' 
            ? 'bg-white border-slate-200 text-slate-600' 
            : 'bg-red-50 border-red-200 text-red-700 shadow-sm hover:border-red-300'}
        `}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${status === 'green' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        <span className="opacity-70">{topic.subject}</span>
        <ChevronRight size={10} className="mx-1 opacity-40" />
        <span className="opacity-70">{topic.anchor}</span>
        {topic.detailed && (
          <>
            <ChevronRight size={10} className="mx-1 opacity-40" />
            <span className="font-semibold">{topic.detailed}</span>
          </>
        )}
      </div>

      {/* INLINE RESOLUTION MENU (POPOVER) */}
      {showMenu && status === 'red' && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 bg-red-50 border-b border-red-100 text-[10px] font-bold text-red-600 uppercase tracking-wide">
            Gap Detected: Topic Missing
          </div>
          
          <button 
            onClick={() => { onResolveCreate(); setShowMenu(false); }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <div className="p-1 bg-green-100 text-green-700 rounded"><Plus size={12} /></div>
            <div>
              Create in Database
              <div className="text-[10px] text-slate-400 font-normal">Adds "{topic.detailed || topic.anchor}" to System</div>
            </div>
          </button>

          <button 
             className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 opacity-50 cursor-not-allowed"
             title="Mock only"
          >
             <div className="p-1 bg-blue-100 text-blue-700 rounded"><RefreshCcw size={12} /></div>
             <div>
               Attach to Existing...
               <div className="text-[10px] text-slate-400 font-normal">Search DB for similar topic</div>
             </div>
          </button>

          <div className="border-t border-slate-100 my-1"></div>

          <button 
            onClick={() => { onRemove(); setShowMenu(false); }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
             <div className="p-1 bg-red-100 text-red-700 rounded"><Trash2 size={12} /></div>
            Remove Intent
          </button>
        </div>
      )}
      
      {/* Backdrop for menu */}
      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
    </div>
  );
}