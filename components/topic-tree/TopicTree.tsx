"use client";

import React, { useState, useEffect } from "react";
import { getRootNodes, getChildren, createRootTopic } from "@/app/actions/topic-tree-actions"; 
import { ChevronRight, Folder, FolderOpen, Database, Layers, PlusSquare, FileText } from "lucide-react";

interface TopicNode {
  id: string;
  name: string;
  level: number;
  slug: string;
}

export function TopicTree({ onSelect, selectedId }: { onSelect: (n: TopicNode) => void, selectedId?: string }) {
  const [rootNodes, setRootNodes] = useState<TopicNode[]>([]);
  const [isCreating, setIsCreating] = useState(false); 
  const [newPaperName, setNewPaperName] = useState("");

  const loadRoots = async () => {
    const roots = await getRootNodes();
    setRootNodes(roots.map(r => ({ id: r.id, name: r.name, level: r.level || 1, slug: r.slug })));
  };

  useEffect(() => { loadRoots(); }, []);

  const handleCreateRoot = async () => {
    if(!newPaperName.trim()) return;
    await createRootTopic(newPaperName);
    setNewPaperName("");
    setIsCreating(false);
    loadRoots(); 
  };

  return (
    <aside className="w-80 border-r border-slate-200 bg-white h-full flex flex-col">
      {/* Header with Add Button */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div className="flex items-center gap-2 text-slate-700">
          <Database className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Spinal Cord</span>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="text-slate-400 hover:text-indigo-600 transition-colors"
          title="Add GS Paper (L1)"
        >
          <PlusSquare className="w-4 h-4" />
        </button>
      </div>

      {/* L1 Creation Input */}
      {isCreating && (
        <div className="p-2 border-b border-indigo-100 bg-indigo-50 animate-in slide-in-from-top-2">
          <input 
            autoFocus
            type="text" 
            placeholder="Paper Name (e.g. GS Paper 2)"
            className="w-full text-xs p-2 rounded border border-indigo-200 focus:outline-none focus:border-indigo-500 mb-2"
            value={newPaperName}
            onChange={(e) => setNewPaperName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateRoot()}
          />
          <button 
            onClick={handleCreateRoot}
            className="w-full bg-indigo-600 text-white text-[10px] font-bold py-1 rounded uppercase tracking-wider hover:bg-indigo-700"
          >
            Create Root
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {rootNodes.map(node => (
          <TreeNodeItem key={node.id} node={node} onSelect={onSelect} selectedId={selectedId} />
        ))}
      </div>
    </aside>
  );
}

function TreeNodeItem({ node, onSelect, selectedId }: { node: TopicNode, onSelect: (n: TopicNode) => void, selectedId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<TopicNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isSelected = selectedId === node.id;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && !hasLoaded) {
      setLoading(true);
      const data = await getChildren(node.id);
      setChildren(data.map(c => ({ id: c.id, name: c.name, level: c.level || 0, slug: c.slug })));
      setLoading(false);
      setHasLoaded(true);
    }
    setIsOpen(!isOpen);
    onSelect(node);
  };

  const Icon = node.level === 1 ? Layers : (isOpen ? FolderOpen : Folder);

  return (
    <div className="select-none">
      <div 
        onClick={toggle}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
          isSelected ? "bg-slate-900 text-white shadow-md" : "hover:bg-slate-50 text-slate-600"
        }`}
      >
        <div className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
          <ChevronRight className={`w-3 h-3 ${isSelected ? "text-slate-400" : "text-slate-300"}`} />
        </div>
        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-300" : "text-slate-400"}`} />
        <span className="truncate text-xs font-medium">{node.name}</span>
        {loading && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping ml-auto"></div>}
      </div>
      {isOpen && (children.length > 0 || hasLoaded) && (
        <div className="ml-4 border-l border-slate-200 pl-1 mt-1 space-y-0.5">
          {children.length > 0 ? (
            children.map(child => <TreeNodeItem key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} />)
          ) : (
            <div className="pl-4 py-2 text-[10px] text-slate-400 italic">No children found</div>
          )}
        </div>
      )}
    </div>
  );
}