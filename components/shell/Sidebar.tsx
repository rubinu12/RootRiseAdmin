"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  GitGraph, 
  FileUp, 
  Database, 
  PenTool, 
  Settings,
  X
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div 
        className={`fixed inset-0 bg-md-primary/40 z-50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={onClose} 
      />
      
      <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-md-surface z-50 transform transition-transform duration-300 flex flex-col shadow-2xl ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8 border-b border-md-outline/10 flex justify-between items-center">
          <span className="text-xl font-bold text-md-primary italic tracking-tight uppercase">Explorer</span>
          <button onClick={onClose} className="text-md-on-surface-variant hover:text-md-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink href="/" icon={<LayoutDashboard size={20} />} label="Dashboard" active={pathname === "/"} />
          <SidebarLink href="/topic-tree" icon={<GitGraph size={20} />} label="Spinal Cord" active={pathname === "/topic-tree"} />
          
          <div className="py-6 px-4 text-[10px] font-black text-md-secondary uppercase tracking-widest">Studios</div>
          <SidebarLink href="/prelim-studio" icon={<FileUp size={20} />} label="Prelim Studio" active={pathname === "/prelim-studio"} />
          <SidebarLink href="/mains-studio" icon={<PenTool size={20} />} label="Mains Studio" active={pathname === "/mains-studio"} />
          <SidebarLink href="/question-bank" icon={<Database size={20} />} label="Question Bank" active={pathname === "/question-bank"} />
          
          <div className="mt-auto pt-10">
            <SidebarLink href="/settings" icon={<Settings size={20} />} label="System Settings" active={pathname === "/settings"} />
          </div>
        </nav>
      </aside>
    </>
  );
}

function SidebarLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-4 px-5 py-3 rounded-xl transition-all ${active ? "bg-md-primary text-md-on-primary font-bold shadow-lg shadow-md-primary/20" : "hover:bg-md-primary-container text-md-primary"}`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}