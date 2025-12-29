"use client";

import React, { useState, useEffect } from "react";
import { getRootNodes, getChildren } from "@/app/actions/topic-tree-actions";

interface TopicNode {
  id: string;
  name: string;
  level: number;
  slug: string;
}

export function VsCodeTree({ onSelect, selectedId }: { onSelect: (n: TopicNode) => void, selectedId?: string }) {
  const [rootNodes, setRootNodes] = useState<TopicNode[]>([]);

  useEffect(() => {
    const loadRoots = async () => {
      const roots = await getRootNodes();
      setRootNodes(roots.map(r => ({ id: r.id, name: r.name, level: r.level || 1, slug: r.slug })));
    };
    loadRoots();
  }, []);

  return (
    <aside className="w-80 border-r border-md-outline/10 overflow-y-auto p-4 bg-md-surface/30 h-full">
      <div className="flex items-center justify-between px-2 mb-4">
        <span className="text-[10px] font-black uppercase text-md-primary tracking-widest">Root Hierarchy</span>
        <button className="material-icons-outlined text-sm hover:text-md-primary">add_circle</button>
      </div>
      <div className="space-y-1">
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

  const isSelected = selectedId === node.id;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && children.length === 0) {
      setLoading(true);
      const data = await getChildren(node.id);
      setChildren(data.map(c => ({ id: c.id, name: c.name, level: c.level || 0, slug: c.slug })));
      setLoading(false);
    }
    setIsOpen(!isOpen);
    onSelect(node);
  };

  return (
    <div className="select-none">
      <div 
        onClick={toggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-md-primary text-md-on-primary font-bold shadow-md shadow-md-primary/10" : "hover:bg-md-primary-container text-md-on-surface-variant"
        }`}
      >
        <span className={`material-icons-outlined text-sm transition-transform ${isOpen ? "rotate-90" : ""}`}>
          chevron_right
        </span>
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-black/5 leading-none">L{node.level}</span>
        <span className="text-xs truncate">{node.name}</span>
        {loading && <span className="w-2 h-2 rounded-full bg-md-primary animate-pulse ml-auto"></span>}
      </div>
      {isOpen && children.length > 0 && (
        <div className="ml-4 border-l border-md-outline/20 pl-2 mt-1 space-y-1">
          {children.map(child => (
            <TreeNodeItem key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}