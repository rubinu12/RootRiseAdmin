'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Loader2, CheckCircle2, AlertCircle, LayoutDashboard, 
  X, Save, Edit3, Search, Undo2
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  IngestionItem, 
  TopicCandidate,
  StagedQuestion,
  TopicNode,
  StagedTopicChain
} from '@/types/prelimIngestion';
import { analyzeIncomingBatch } from '@/app/prelim/actions/analyze-batch';
import { commitBatch } from '@/app/prelim/actions/commit-batch';
import { searchTopicsBySubject } from '@/app/actions/prelim-actions'; 
import { QuestionCard } from '@/components/prelim-studio/QuestionCard';

// Extended type to track validation state
type ValidatedItem = IngestionItem & {
  validationErrors?: string[];
};

export default function StudioClient() {
  // --- STATE ---
  const [view, setView] = useState<'input' | 'studio'>('input');
  const [jsonInput, setJsonInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  
  const [items, setItems] = useState<ValidatedItem[]>([]);
  const [history, setHistory] = useState<string[]>([]); 

  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  
  const [searchModal, setSearchModal] = useState<{
    isOpen: boolean;
    qIdx: number;
    chainIdx: number; // -1 = Append, >=0 = Replace
    subjectContext: string;
    searchTerm: string;
    results: any[];
    isSearching: boolean;
  }>({ 
    isOpen: false, qIdx: -1, chainIdx: -1, 
    subjectContext: '', searchTerm: '', 
    results: [], isSearching: false 
  });

  // --- VALIDATION LOGIC ---
  const validateItem = (item: IngestionItem): { isValid: boolean, errors: string[] } => {
    const errors: string[] = [];
    const q = item.question;

    // 1. Basic Fields
    if (!q.type) errors.push("Question type missing");
    if (!q.correctOption) errors.push("Correct option missing");

    // 2. Options (Strict check for MCQs, Statement, Pair usually imply options too unless pure match)
    // Assuming standard format where A,B,C,D are required for all types except maybe direct Pair matching questions
    if ((!q.options || q.options.length === 0)) errors.push("Options are missing");
    else if (!q.options.find(o => o.label === 'A')) errors.push("Option A is missing");

    // 3. UPSC Constraints
    if (q.source === 'UPSC') {
      if (!q.paper) errors.push("UPSC source requires Paper");
      if (!q.year) errors.push("UPSC source requires Year");
    }

    // 4. Type Specific
    if (q.type === 'statement' && (!('statements' in q) || !q.statements || q.statements.length === 0)) {
        errors.push("Statements are missing");
    }
    if (q.type === 'pair' && (!('pairs' in q) || !q.pairs || q.pairs.length === 0)) {
        errors.push("Pairs are missing");
    }

    // 5. Topic Constraints
    const hasResolved = item.topicChains.some(c => c.isFullyResolved);
    if (!hasResolved) errors.push("At least one fully resolved (Green) topic is required");

    // 6. Overall Validity
    // The item.isValid from analysis might be true structurally, but false logically here
    return { isValid: errors.length === 0, errors };
  };

  // --- UNDO SYSTEM ---
  const saveToHistory = () => {
    const snapshot = JSON.stringify(items);
    setHistory(prev => {
      const newHistory = [...prev, snapshot];
      return newHistory.slice(-20);
    });
  };

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastSnapshot = prev[prev.length - 1];
      const newHistory = prev.slice(0, -1);
      setItems(JSON.parse(lastSnapshot));
      toast.info("Undo Successful");
      return newHistory;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // --- LIVE SEARCH ---
  useEffect(() => {
    if (!searchModal.isOpen || searchModal.searchTerm.length < 2) return;
    const delayDebounceFn = setTimeout(async () => {
      setSearchModal(prev => ({ ...prev, isSearching: true }));
      try {
        const results = await searchTopicsBySubject(searchModal.subjectContext, searchModal.searchTerm);
        setSearchModal(prev => ({ ...prev, results, isSearching: false }));
      } catch (e) {
        setSearchModal(prev => ({ ...prev, isSearching: false }));
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchModal.searchTerm, searchModal.isOpen, searchModal.subjectContext]);

  // --- ACTIONS ---
  const handleAnalyze = async () => {
    if (!jsonInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const rawResult = await analyzeIncomingBatch(jsonInput);
      // Run Initial Validation
      const validatedResult = rawResult.map(item => {
        const v = validateItem(item);
        return { ...item, isValid: v.isValid, validationErrors: v.errors };
      });
      setItems(validatedResult);
      setHistory([]); 
      setView('studio');
      toast.success(`Analyzed ${rawResult.length} questions`);
    } catch (error: any) {
      toast.error(error.message || "Analysis Failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- TOPIC ACTIONS ---
  const handleTopicAction = (
    action: 'create' | 'map' | 'remove' | 'manual-add' | 'add-topic',
    targetQIdx: number,
    chainIdx: number,
    level: 3 | 4,
    payload?: TopicCandidate
  ) => {
    
    // SEARCH HANDLERS
    if (action === 'manual-add' || action === 'add-topic') {
      const targetChain = items[targetQIdx].topicChains[chainIdx];
      let subject = "Unknown";
      
      // Determine Context
      if (action === 'manual-add' && level === 4 && targetChain.l3.name) {
         subject = targetChain.l3.name; // Search inside Parent L3
      } else {
         subject = targetChain.l2.name || "Unknown"; // Search inside Subject L2
      }
      
      setSearchModal({
        isOpen: true,
        qIdx: targetQIdx,
        chainIdx: action === 'add-topic' ? -1 : chainIdx, // -1 signals Append Mode
        subjectContext: subject,
        searchTerm: '',
        results: [],
        isSearching: false
      });
      return;
    }

    saveToHistory();
    const targetItem = items[targetQIdx];
    const targetChain = targetItem.topicChains[chainIdx];

    setItems(currentItems => currentItems.map(item => {
      // Map chains, modifying matched ones, filtering nulls (deletions)
      const newChains = item.topicChains.map(chain => {
        const isSameL3 = chain.l3.name === targetChain.l3.name;
        const isSameL4 = chain.l4?.name === targetChain.l4?.name;

        // DELETE LOGIC
        if (action === 'remove') {
          // DELETE INTENT: Level 3 -> Remove Chain entirely
          if (level === 3 && isSameL3) return null; 
          
          // DELETE INTENT: Level 4 -> Demote to L3 (Remove L4 only)
          if (level === 4 && isSameL3 && isSameL4) {
             const { l4, ...rest } = chain;
             // Re-evaluate resolution status of L3
             const isL3Resolved = chain.l3.status === 'green' || chain.l3.status === 'pending-create';
             return { ...rest, isFullyResolved: isL3Resolved } as StagedTopicChain;
          }
          return chain;
        }

        // CREATE / MAP LOGIC (Only runs if not removed)
        if (level === 3 && isSameL3) {
           const newNode = { ...chain.l3 };
           if (action === 'create') {
             newNode.status = 'pending-create';
             newNode.tempParentId = chain.l2.dbId;
           } else if (action === 'map' && payload) {
             newNode.status = 'green';
             newNode.dbId = payload.id;
             newNode.slug = payload.slug;
             newNode.name = payload.name;
           }
           const isL4Ok = !chain.l4 || chain.l4.status === 'green' || chain.l4.status === 'pending-create';
           const isResolved = (newNode.status === 'green' || newNode.status === 'pending-create') && isL4Ok;
           return { ...chain, l3: newNode, isFullyResolved: isResolved };
        }

        if (level === 4 && isSameL3 && isSameL4) {
           if (!chain.l4) return chain;
           const newNode = { ...chain.l4 };
           if (action === 'create') {
             newNode.status = 'pending-create';
             newNode.tempParentId = chain.l3.dbId;
           } else if (action === 'map' && payload) {
             newNode.status = 'green';
             newNode.dbId = payload.id;
             newNode.slug = payload.slug;
             newNode.name = payload.name;
           }
           const isL3Ok = chain.l3.status === 'green' || chain.l3.status === 'pending-create';
           const isResolved = isL3Ok && (newNode.status === 'green' || newNode.status === 'pending-create');
           return { ...chain, l4: newNode, isFullyResolved: isResolved };
        }
        return chain;
      }).filter((c): c is StagedTopicChain => c !== null); // Filter out deleted chains

      // RE-VALIDATE AFTER CHANGE
      const validation = validateItem({ ...item, topicChains: newChains });
      return { ...item, topicChains: newChains, isValid: validation.isValid, validationErrors: validation.errors };
    }));
    
    if (action !== 'remove') toast.success("Updated Batch");
  };

  // --- SEARCH SELECTION ---
  const selectManualTopic = (topic: any) => {
    saveToHistory();

    const parts = topic.ancestryPath ? topic.ancestryPath.split(' > ') : [topic.name];
    const l1Name = parts[0] || "GS";
    const l2Name = parts[1] || searchModal.subjectContext;
    
    const newChain = {
      id: `manual-${Date.now()}`,
      rawString: topic.ancestryPath || topic.name,
      l1: { name: l1Name, level: 1, status: 'green' } as TopicNode,
      l2: { name: l2Name, level: 2, status: 'green', dbId: 'assume-exist' } as TopicNode, 
      l3: { name: topic.name, level: 3, status: 'green', dbId: topic.id, slug: topic.slug } as TopicNode,
      isFullyResolved: true
    };

    setItems(prev => prev.map((item, idx) => {
      if (idx !== searchModal.qIdx) return item;
      
      const newChains = [...item.topicChains];
      if (searchModal.chainIdx === -1) {
        newChains.push(newChain); // Append Mode
      } else {
        newChains[searchModal.chainIdx] = newChain; // Replace Mode
      }
      
      const validation = validateItem({ ...item, topicChains: newChains });
      return { ...item, topicChains: newChains, isValid: validation.isValid, validationErrors: validation.errors };
    }));

    setSearchModal(prev => ({ ...prev, isOpen: false }));
    toast.success("Topic Attached");
  };

  // --- COMMIT ---
  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const res = await commitBatch(items);
      if (res.success) {
        toast.success(`Committed ${res.count} questions!`);
        setView('input');
        setItems([]);
        setHistory([]);
        setJsonInput('');
      } else {
        toast.error(res.error || "Commit failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCommitting(false);
    }
  };

  // --- EDIT ---
  const openEditPanel = (idx: number) => {
    const item = items[idx];
    const cleanQ = { ...item.question };
    // @ts-ignore
    delete cleanQ.id; 
    setEditBuffer(JSON.stringify(cleanQ, null, 2));
    setEditingItemIdx(idx);
  };

  const saveEdit = () => {
    if (editingItemIdx === null) return;
    saveToHistory();
    try {
      const parsedQ = JSON.parse(editBuffer) as StagedQuestion;
      setItems(prev => prev.map((item, idx) => {
        if (idx !== editingItemIdx) return item;
        const newItem = { ...item, question: { ...parsedQ, id: item.question.id } };
        const validation = validateItem(newItem);
        return { ...newItem, isValid: validation.isValid, validationErrors: validation.errors };
      }));
      setEditingItemIdx(null);
      toast.success("Saved");
    } catch (e) { toast.error("Invalid JSON"); }
  };

  const allValid = items.length > 0 && items.every(i => i.isValid);

  if (view === 'input') return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><LayoutDashboard size={24} /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Prelims Ingestion Studio</h1></div>
          </div>
          <textarea 
            className="w-full h-72 p-4 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            placeholder='[ { "meta": ... } ]' value={jsonInput} onChange={(e) => setJsonInput(e.target.value)}
          />
          <div className="mt-6 flex justify-end">
            <button onClick={handleAnalyze} disabled={isAnalyzing || !jsonInput} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {isAnalyzing && <Loader2 className="animate-spin" size={18} />}
              {isAnalyzing ? 'Analyzing...' : 'Start Session'}
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-900 font-sans overflow-hidden">
      <aside className="w-[320px] flex flex-col border-r border-slate-200 bg-white z-10">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Batch Queue</h2>
            <div className="flex gap-2">
               <button onClick={handleUndo} disabled={history.length === 0} className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200" title="Undo (Ctrl+Z)"><Undo2 size={12} /> Undo ({history.length})</button>
               <button onClick={() => setView('input')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1">New</button>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{items.length}</span>
            <span className="text-sm font-medium text-slate-500">Questions</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item, idx) => (
             <div key={item.id} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${!item.isValid ? 'bg-red-50 border-red-100 text-red-900' : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'}`}>
              <div className={`w-2.5 h-2.5 rounded-full mr-3 shrink-0 ${item.isValid ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <div className="overflow-hidden"><p className="text-xs font-mono text-slate-400 mb-0.5">Q{idx + 1}</p><p className="text-sm font-medium truncate">{item.question.text}</p></div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-200 bg-white">
          <button disabled={!allValid || isCommitting} onClick={handleCommit} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${allValid ? 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02]' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}>
            {isCommitting ? <Loader2 className="animate-spin" size={18} /> : (allValid ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />)}
            {allValid ? 'COMMIT BATCH' : 'RESOLVE RED ITEMS'}
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-slate-100/50 overflow-y-auto relative scroll-smooth">
        <div className="max-w-4xl mx-auto p-8 space-y-8 pb-32">
          {items.map((item, idx) => (
            <div key={item.id} className="relative group/card">
              <button onClick={() => openEditPanel(idx)} className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm opacity-0 group-hover/card:opacity-100 transition-all z-10"><Edit3 size={16} /></button>
              <QuestionCard item={item} index={idx} onTopicAction={(action, chainIdx, level, payload) => handleTopicAction(action, idx, chainIdx, level, payload)} />
            </div>
          ))}
        </div>
      </main>

      {/* SEARCH MODAL */}
      {searchModal.isOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={() => setSearchModal(prev => ({ ...prev, isOpen: false }))} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <Search className="text-slate-400" size={24} />
              <input autoFocus className="flex-1 bg-transparent text-lg font-medium outline-none text-slate-800 placeholder:text-slate-400"
                placeholder={`Search in ${searchModal.subjectContext}...`} value={searchModal.searchTerm} onChange={(e) => setSearchModal(prev => ({ ...prev, searchTerm: e.target.value }))}
              />
              <button onClick={() => setSearchModal(prev => ({ ...prev, isOpen: false }))}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
            </div>
            <div className="h-[300px] overflow-y-auto p-2 bg-slate-50/50">
              {searchModal.isSearching ? <div className="flex items-center justify-center h-full text-slate-400 gap-2"><Loader2 className="animate-spin" size={20} /> Searching Database...</div> 
              : searchModal.results.length > 0 ? <div className="space-y-1">{searchModal.results.map((t, i) => (
                    <button key={i} onClick={() => selectManualTopic(t)} className="w-full text-left p-3 rounded bg-white border border-slate-200 hover:border-indigo-300 hover:ring-1 hover:ring-indigo-100 text-slate-600 text-sm flex flex-col gap-0.5 transition-all">
                      <span className="font-bold text-slate-800">{t.name}</span><span className="text-[10px] text-slate-400 font-mono uppercase">{t.ancestryPath}</span>
                    </button>
                  ))}</div> 
              : <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">{searchModal.searchTerm.length < 2 ? "Type to start searching..." : "No matches found."}</div>}
            </div>
          </div>
        </>
      )}

      {/* EDIT PANEL */}
      {editingItemIdx !== null && (
        <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right">
           <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-700">Edit JSON</h3><button onClick={() => setEditingItemIdx(null)}><X size={20}/></button></div>
           <textarea className="flex-1 p-6 font-mono text-xs focus:outline-none resize-none" value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} spellCheck={false}/>
           <div className="p-6 border-t border-slate-100"><button onClick={saveEdit} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">Save Changes</button></div>
        </div>
      )}
    </div>
  );
}