'use client';

import React, { useState } from 'react';
import { 
  Check, X, ChevronRight, AlertCircle, 
  Plus, Search, GitMerge, Trash2
} from 'lucide-react';
import { 
  IngestionItem, 
  StagedTopicChain, 
  TopicNode, 
  TopicCandidate 
} from '@/types/prelimIngestion';

// Interface extension to handle local validation errors
interface ExtendedIngestionItem extends IngestionItem {
  validationErrors?: string[];
}

interface QuestionCardProps {
  item: ExtendedIngestionItem;
  index: number;
  onTopicAction: (
    action: 'create' | 'map' | 'remove' | 'manual-add' | 'add-topic', // Added 'add-topic'
    chainIdx: number, 
    level: 3 | 4,
    payload?: any
  ) => void;
}

export function QuestionCard({ item, index, onTopicAction }: QuestionCardProps) {
  const { question, topicChains } = item;

  // Helper to get correct option text
  const getCorrectOptionText = () => {
    if (!question.correctOption) return '';
    const opt = question.options.find(o => o.label === question.correctOption);
    return opt ? opt.text : '';
  };

  return (
    <div 
      id={item.id} 
      className={`
        bg-white rounded-xl shadow-sm border transition-all mb-6 relative
        ${item.isValid ? 'border-slate-200' : 'border-red-200 ring-1 ring-red-50'}
      `}
    >
      {/* HEADER (Rounded Top Only) */}
      <div className="px-6 py-4 border-b border-slate-50 flex gap-4 items-start bg-white rounded-t-xl">
        <span className="text-xs font-bold text-slate-400 mt-1 shrink-0">Q{index + 1}</span>
        <div className="flex-1">
          <div className="flex gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
              {question.year}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
              {question.type}
            </span>
          </div>
          <h3 className="text-base font-medium text-slate-800 leading-relaxed">
            {question.text}
          </h3>

          {/* VALIDATION ERROR DISPLAY (New Feature) */}
          {item.validationErrors && item.validationErrors.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 text-xs space-y-1 animate-in slide-in-from-top-2">
              <p className="font-bold flex items-center gap-1"><AlertCircle size={12}/> Validation Errors:</p>
              <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                {item.validationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="px-6 py-4 bg-white">
        
        {/* CASE 1: STATEMENTS */}
        {question.type === 'statement' && (
          <div className="space-y-2">
            {question.statements.map((s) => (
              <div key={s.idx} className="flex gap-3 items-start">
                <div className={`mt-0.5 font-bold text-xs ${s.isTrue ? 'text-green-600' : 'text-red-600'}`}>
                  {s.idx}.
                </div>
                <p className={`text-sm font-medium ${s.isTrue ? 'text-green-700' : 'text-red-700'}`}>
                  {s.text}
                </p>
              </div>
            ))}
            <div className="mt-3 pt-2 border-t border-slate-50 text-xs text-slate-500 flex gap-1">
              Correct Option: 
              <span className="font-bold text-slate-800">{question.correctOption}</span>
              <span className="text-slate-400">—</span>
              <span className="text-slate-700">{getCorrectOptionText()}</span>
            </div>
          </div>
        )}

        {/* CASE 2: PAIRS */}
        {question.type === 'pair' && (
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 p-2">
              <div>Pair Left</div>
              <div>Pair Right</div>
            </div>
            {question.pairs.map((p, idx) => (
              <div key={idx} className="grid grid-cols-2 text-sm p-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <div className="font-medium text-slate-700">{p.left}</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{p.right}</span>
                  {p.isCorrectMatch ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <X size={14} className="text-red-400 opacity-50" />
                  )}
                </div>
              </div>
            ))}
             <div className="p-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-100 flex gap-1">
              Correct: <strong className="text-slate-800">{question.correctOption}</strong>
              <span className="text-slate-400">—</span>
              <span>{getCorrectOptionText()}</span>
            </div>
          </div>
        )}

        {/* CASE 3: MCQ */}
        {question.type === 'mcq' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {question.options.map((opt) => (
              <div 
                key={opt.label} 
                className={`
                  p-2.5 rounded border text-sm flex gap-2
                  ${question.correctOption === opt.label 
                    ? 'border-green-200 bg-green-50 text-green-800' 
                    : 'border-slate-100 text-slate-500'}
                `}
              >
                <span className="font-bold">{opt.label}</span>
                <span>{opt.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER: TOPIC CHAINS (Rounded Bottom Only) */}
      <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2 rounded-b-xl">
        {topicChains.map((chain, cIdx) => (
          <div key={chain.id} className="flex items-center w-full">
            <TopicChainRow 
              chain={chain}
              onAction={(action, level, payload) => onTopicAction(action, cIdx, level, payload)}
            />
            
            {/* MANUAL ATTACH TRIGGER (UPDATED ACTION & VISIBILITY) */}
            <button
               onClick={() => onTopicAction('add-topic', cIdx, 3)}
               className="ml-auto p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:shadow-sm rounded-md transition-all flex items-center gap-2 group"
               title="Attach another topic"
            >
               <span className="text-[10px] font-bold uppercase hidden group-hover:inline-block">Attach Topic</span>
               <Search size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: TOPIC CHAIN ROW ---

function TopicChainRow({ 
  chain, 
  onAction 
}: { 
  chain: StagedTopicChain;
  onAction: (action: 'create' | 'map' | 'remove' | 'manual-add' | 'add-topic', level: 3 | 4, payload?: any) => void;
}) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 text-slate-400">
      <span className="text-[10px] font-bold text-slate-500 uppercase">{chain.l1.name}</span>
      <ChevronRight size={10} />
      
      <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
        {chain.l2.name}
      </span>
      <ChevronRight size={10} />

      <InteractiveNode node={chain.l3} level={3} onAction={onAction} />

      {chain.l4 && (
        <>
          <ChevronRight size={10} />
          <InteractiveNode node={chain.l4} level={4} onAction={onAction} />
        </>
      )}
    </div>
  );
}

// --- SUB-COMPONENT: INTERACTIVE NODE ---

function InteractiveNode({ 
  node, 
  level, 
  onAction 
}: { 
  node: TopicNode; 
  level: 3 | 4; 
  onAction: (action: 'create' | 'map' | 'remove' | 'manual-add' | 'add-topic', level: 3 | 4, payload?: any) => void; 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const baseStyles = "px-2 py-0.5 rounded text-xs font-medium border transition-all select-none flex items-center gap-1.5 relative";
  const greenStyles = "text-green-700 bg-green-50 border-green-200 cursor-default";
  const redStyles = "text-red-600 bg-white border-red-200 hover:border-red-300 hover:bg-red-50 cursor-pointer shadow-sm";
  const pendingStyles = "text-blue-600 bg-blue-50 border-blue-200 border-dashed cursor-default";

  // RENDER GREEN
  if (node.status === 'green') {
    return <span className={`${baseStyles} ${greenStyles}`}>{node.name}</span>;
  }

  // RENDER PENDING
  if (node.status === 'pending-create') {
    return (
      <span className={`${baseStyles} ${pendingStyles}`}>
        <Plus size={10} /> {node.name}
      </span>
    );
  }

  // RENDER RED (With Popover)
  return (
    <div className="relative group">
      <span 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`${baseStyles} ${redStyles}`}
      >
        <AlertCircle size={10} className="animate-pulse" />
        {node.name}
      </span>

      {/* POPOVER MENU */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setIsOpen(false)} />
          
          <div className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-lg shadow-xl border border-slate-200 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
            
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Resolve Gap</span>
              <button onClick={() => setIsOpen(false)}><X size={12} className="text-slate-400 hover:text-slate-600"/></button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              
              {/* SECTION 1: CANDIDATES (UPDATED: HORIZONTAL GRID) */}
              {node.candidates && node.candidates.length > 0 ? (
                <div className="p-3 border-b border-slate-50 bg-slate-50/30">
                  <p className="text-[10px] text-slate-400 font-bold mb-2 px-1">SUGGESTED MATCHES</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {node.candidates.map((candidate: TopicCandidate) => (
                      <button
                        key={candidate.id}
                        onClick={() => {
                          onAction('map', level, candidate);
                          setIsOpen(false);
                        }}
                        className="text-left p-2 bg-white border border-slate-200 hover:border-indigo-400 hover:ring-1 hover:ring-indigo-100 rounded text-xs text-slate-700 group flex flex-col gap-1 shadow-sm transition-all h-full"
                      >
                        <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                           <GitMerge size={12} />
                           <span className="truncate w-full">{candidate.name}</span>
                        </div>
                        <div className="flex justify-between items-center w-full mt-1">
                           <span className="text-[10px] text-slate-400 font-mono">{(candidate.similarity * 100).toFixed(0)}% Match</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                 <div className="p-3 border-b border-slate-50 text-center text-xs text-slate-400 italic">
                    No semantic matches found.
                 </div>
              )}

              {/* SECTION 2: ACTIONS */}
              <div className="p-2 space-y-1">
                <button 
                  onClick={() => { onAction('create', level); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-green-50 rounded text-xs text-slate-700 group flex items-start gap-2 border border-transparent hover:border-green-100 transition-colors"
                >
                  <Plus size={14} className="mt-0.5 text-green-500 group-hover:text-green-700" />
                  <div>
                    <span className="font-bold block text-green-700">Create "{node.name}"</span>
                    <span className="text-[10px] text-slate-400">Add to database as new topic</span>
                  </div>
                </button>
                
                {/* NEW: FIND ALTERNATIVE (SCOPED SEARCH) */}
                <button 
                  onClick={() => { onAction('manual-add', level); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded text-xs text-slate-700 group flex items-start gap-2 border border-transparent hover:border-indigo-100 transition-colors"
                >
                  <Search size={14} className="mt-0.5 text-indigo-500 group-hover:text-indigo-700" />
                  <div>
                    <span className="font-bold block text-indigo-700">Find Alternative...</span>
                    <span className="text-[10px] text-slate-400">Search database for a different topic</span>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button 
                  onClick={() => { onAction('remove', level); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-red-50 rounded text-xs text-slate-700 group flex items-start gap-2 border border-transparent hover:border-red-100 transition-colors"
                >
                  <Trash2 size={14} className="mt-0.5 text-red-500 group-hover:text-red-700" />
                  <div>
                    <span className="font-bold block text-red-700">Remove Intent</span>
                    <span className="text-[10px] text-slate-400">Delete this topic suggestion</span>
                  </div>
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}