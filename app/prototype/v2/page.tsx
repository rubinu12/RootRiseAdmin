'use client';

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Plus, 
  Search,
  ChevronRight, 
  Save, 
  Trash2, 
  CornerDownRight,
  ArrowUpRight
} from 'lucide-react';

// --- TYPES & MOCK DATA ---

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

// INITIAL DB STATE (The "Reality")
const INITIAL_DB_TOPICS = [
  { subject: 'Polity', anchor: 'State Executive', detailed: 'Governor' },
  { subject: 'Polity', anchor: 'Parliament', detailed: 'Lok Sabha' },
  { subject: 'Polity', anchor: 'Parliament', detailed: 'Rajya Sabha' }, // Added for your video example
  { subject: 'Economy', anchor: 'Banking', detailed: 'RBI' },
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'statement',
    question_text: 'Consider the following statements regarding the Governor:',
    statements: [
      { idx: 1, text: 'The Constitution mentions discretionary powers of Governor.', is_true: true },
      { idx: 2, text: 'President can reserve bill without Governor.', is_true: false }
    ],
    options: [{ label: 'A', text: '1 only' }, { label: 'B', text: '2 only' }],
    correct_option: 'A',
    topics: [
      { subject: 'Polity', anchor: 'State Executive', detailed: 'Governor\'s Discretionary Powers' } // L4 Missing
    ]
  },
  {
    id: 'q2',
    type: 'mcq',
    question_text: 'With reference to Parliament of India:',
    options: [
      { label: 'A', text: 'Rajya Sabha is permanent' },
      { label: 'B', text: 'Lok Sabha is permanent' }
    ],
    correct_option: 'A',
    topics: [
      { subject: 'Polity', anchor: 'Parliament', detailed: 'Rajya Sabha' }, // Full Match
      { subject: 'Polity', anchor: 'State Executive', detailed: 'Governor\'s Discretionary Powers' } // Duplicate error case
    ]
  }
];

// --- MAIN COMPONENT ---

export default function IngestionStudio() {
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [dbTopics, setDbTopics] = useState<Topic[]>(INITIAL_DB_TOPICS);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // --- ACTIONS ---

  // 1. Create L4: Adds the exact topic structure to DB
  const handleCreateL4 = (topic: Topic) => {
    setDbTopics(prev => [...prev, topic]);
  };

  // 2. Attach to Parent: Updates the question to remove the L4 (fallback to L3)
  const handleAttachToParent = (qId: string, topicIndex: number, parentTopic: Topic) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const newTopics = [...q.topics];
      newTopics[topicIndex] = parentTopic; // Replace with L3 version
      return { ...q, topics: newTopics };
    }));
  };

  // 3. Remove Topic
  const handleRemoveTopic = (qId: string, topicIndex: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const newTopics = [...q.topics];
      newTopics.splice(topicIndex, 1);
      return { ...q, topics: newTopics };
    }));
  };

  // 4. Manual Add (Mock)
  const handleManualAdd = (qId: string, newTopic: Topic) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, topics: [...q.topics, newTopic] };
    }));
  };

  // --- VALIDATION HELPERS ---
  
  // Checks strictly if the chain exists up to the requested level
  const checkLevelStatus = (t: Topic, level: 'L2' | 'L3' | 'L4') => {
    if (level === 'L2') {
      return dbTopics.some(db => db.subject === t.subject) ? 'green' : 'red';
    }
    if (level === 'L3') {
      return dbTopics.some(db => db.subject === t.subject && db.anchor === t.anchor) ? 'green' : 'red';
    }
    if (level === 'L4') {
      // If the intent HAS no L4, it's valid (return green). If it HAS L4, check DB.
      if (!t.detailed) return 'green'; 
      return dbTopics.some(db => 
        db.subject === t.subject && 
        db.anchor === t.anchor && 
        db.detailed === t.detailed
      ) ? 'green' : 'red';
    }
    return 'red';
  };

  const isQuestionValid = (q: Question) => {
    return q.topics.every(t => 
      checkLevelStatus(t, 'L2') === 'green' && 
      checkLevelStatus(t, 'L3') === 'green' && 
      checkLevelStatus(t, 'L4') === 'green'
    );
  };

  const allValid = questions.every(isQuestionValid);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* COLUMN A: NAVIGATION */}
      <aside className="w-[280px] flex flex-col border-r border-slate-200 bg-white z-10">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Ingestion Studio</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{questions.length}</span>
            <span className="text-sm text-slate-500">Items</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {questions.map((q, idx) => {
            const valid = isQuestionValid(q);
            return (
              <div 
                key={q.id}
                onClick={() => document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={`p-3 rounded-md cursor-pointer text-sm font-medium flex items-center gap-3 transition-colors ${!valid ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${valid ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="truncate">Q{idx + 1}: {q.question_text}</span>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-200">
           <button 
             disabled={!allValid}
             className={`w-full py-3 rounded-lg font-bold text-sm shadow-sm transition-all flex justify-center items-center gap-2
               ${allValid ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
             `}
           >
             {allValid ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
             Commit All
           </button>
        </div>
      </aside>

      {/* COLUMN B: WORKSPACE */}
      <main className="flex-1 bg-slate-100 overflow-y-auto p-8 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">
          {questions.map((q, idx) => (
            <QuestionCard 
              key={q.id} 
              q={q} 
              idx={idx}
              dbTopics={dbTopics}
              checkLevelStatus={checkLevelStatus}
              onCreateL4={handleCreateL4}
              onAttachParent={handleAttachToParent}
              onRemove={handleRemoveTopic}
              onManualAdd={handleManualAdd}
            />
          ))}
        </div>
      </main>

    </div>
  );
}

// --- SUB-COMPONENTS ---

function QuestionCard({ 
  q, idx, dbTopics, checkLevelStatus, onCreateL4, onAttachParent, onRemove, onManualAdd 
}: any) {
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter DB for manual add
  const filteredTopics = useMemo(() => {
    if (!searchTerm) return [];
    return dbTopics.filter((t: Topic) => 
      t.anchor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.detailed && t.detailed.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);
  }, [dbTopics, searchTerm]);

  return (
    <div id={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-50 flex gap-4 items-start">
        <span className="text-xs font-bold text-slate-300 mt-1">Q{idx + 1}</span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-800 leading-snug">{q.question_text}</h3>
        </div>
      </div>

      {/* Content (Statements) */}
      <div className="px-6 py-4 space-y-3">
        {q.type === 'statement' ? (
           q.statements.map((s: any) => (
             <div 
               key={s.idx}
               className={`
                 p-3 rounded-lg text-sm font-medium border
                 ${s.is_true 
                   ? 'bg-green-50 border-green-100 text-green-800' // TRUE STYLE
                   : 'bg-red-50 border-red-100 text-red-800'}       // FALSE STYLE
               `}
             >
               {s.text}
             </div>
           ))
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt: any) => (
               <div key={opt.label} className="p-3 bg-slate-50 border border-slate-100 rounded text-sm text-slate-600 font-medium">
                 <span className="font-bold mr-2">{opt.label}</span> {opt.text}
               </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Topics & Actions */}
      <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
        
        {/* Existing Topics List */}
        <div className="flex flex-col gap-2">
          {q.topics.map((topic: Topic, tIdx: number) => (
            <TopicChain 
              key={tIdx}
              topic={topic}
              qId={q.id}
              tIdx={tIdx}
              checkLevelStatus={checkLevelStatus}
              onCreateL4={onCreateL4}
              onAttachParent={onAttachParent}
              onRemove={onRemove}
            />
          ))}
        </div>

        {/* Manual Add Trigger */}
        <div className="relative">
          {!isSearchOpen ? (
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus size={12} /> Add Topic Manually
            </button>
          ) : (
            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
               <div className="flex items-center gap-2 border border-indigo-200 rounded-md bg-white px-2 py-1.5 shadow-sm w-full max-w-md focus-within:ring-2 ring-indigo-100">
                 <Search size={14} className="text-slate-400" />
                 <input 
                    autoFocus
                    className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"
                    placeholder="Search Polity, Economy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
                 <button onClick={() => setIsSearchOpen(false)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button>
               </div>
               
               {/* Search Results Dropdown */}
               {searchTerm && (
                 <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-white border border-slate-200 rounded-md shadow-xl z-50 overflow-hidden">
                   {filteredTopics.length > 0 ? filteredTopics.map((ft: Topic, i: number) => (
                     <div 
                        key={i} 
                        onClick={() => {
                          onManualAdd(q.id, ft);
                          setIsSearchOpen(false);
                          setSearchTerm('');
                        }}
                        className="px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center gap-2"
                     >
                        <span className="font-bold text-slate-800">{ft.subject}</span>
                        <ChevronRight size={10} className="text-slate-300"/>
                        <span>{ft.anchor}</span>
                        {ft.detailed && (
                          <>
                            <ChevronRight size={10} className="text-slate-300"/>
                            <span className="text-indigo-600">{ft.detailed}</span>
                          </>
                        )}
                     </div>
                   )) : (
                     <div className="px-3 py-2 text-xs text-slate-400 italic">No existing topics found...</div>
                   )}
                 </div>
               )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// --- CORE COMPONENT: THE BREADCRUMB CHAIN ---

function TopicChain({ topic, qId, tIdx, checkLevelStatus, onCreateL4, onAttachParent, onRemove }: any) {
  const [activeMenu, setActiveMenu] = useState(false);

  // Status for each specific node
  const sStatus = checkLevelStatus(topic, 'L2');
  const aStatus = checkLevelStatus(topic, 'L3');
  const dStatus = checkLevelStatus(topic, 'L4');

  // Helper to render a node
  const Node = ({ label, status, onClick, isLast }: any) => (
    <span 
      onClick={status === 'red' ? onClick : undefined}
      className={`
        px-1.5 py-0.5 rounded text-xs font-medium transition-all select-none flex items-center
        ${status === 'green' ? 'text-green-700 bg-green-50/50' : ''}
        ${status === 'red' ? 'text-red-600 bg-red-100 cursor-pointer hover:bg-red-200 ring-1 ring-red-200' : ''}
      `}
    >
      {label}
    </span>
  );

  const Separator = () => <ChevronRight size={12} className="text-slate-300 mx-0.5" />;

  return (
    <div className="flex items-center flex-wrap gap-y-1 relative">
      {/* L1/L2 Subject */}
      <Node label={topic.subject} status={sStatus} />
      
      <Separator />
      
      {/* L3 Anchor */}
      <Node label={topic.anchor} status={aStatus} />

      {/* L4 Detailed (Only if exists) */}
      {topic.detailed && (
        <>
          <Separator />
          <div className="relative">
            <Node 
              label={topic.detailed} 
              status={dStatus} 
              isLast={true}
              onClick={() => setActiveMenu(!activeMenu)}
            />

            {/* THE INLINE ACTION MENU (Video Style) */}
            {activeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Gap Resolution</p>
                  </div>
                  
                  {/* OPTION 1: Create L4 */}
                  <button 
                    onClick={() => { onCreateL4(topic); setActiveMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-green-50 flex items-start gap-3 transition-colors group"
                  >
                    <CornerDownRight size={14} className="mt-0.5 text-green-600" />
                    <div>
                      <span className="block text-xs font-bold text-slate-800 group-hover:text-green-800">Create Level 4</span>
                      <span className="block text-[10px] text-slate-500 leading-tight">Add "{topic.detailed}" to database</span>
                    </div>
                  </button>

                  <div className="border-t border-slate-100" />

                  {/* OPTION 2: Attach to Parent */}
                  <button 
                    onClick={() => { 
                      onAttachParent(qId, tIdx, { subject: topic.subject, anchor: topic.anchor }); 
                      setActiveMenu(false); 
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-start gap-3 transition-colors group"
                  >
                    <ArrowUpRight size={14} className="mt-0.5 text-blue-600" />
                    <div>
                      <span className="block text-xs font-bold text-slate-800 group-hover:text-blue-800">Attach to {topic.anchor}</span>
                      <span className="block text-[10px] text-slate-500 leading-tight">Discard detailed topic, use parent</span>
                    </div>
                  </button>

                  <div className="border-t border-slate-100" />

                  {/* OPTION 3: Remove */}
                  <button 
                    onClick={() => { onRemove(qId, tIdx); setActiveMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 flex items-start gap-3 transition-colors group"
                  >
                    <Trash2 size={14} className="mt-0.5 text-red-500" />
                    <span className="block text-xs font-bold text-red-600 pt-0.5">Remove this topic</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}