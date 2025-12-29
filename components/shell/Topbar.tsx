"use client";

import React from "react";
import { Menu, Moon, Sun, User } from "lucide-react";

interface TopBarProps {
  onMenuClick: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export function TopBar({ onMenuClick, isDarkMode, toggleDarkMode }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-md-surface border-b border-md-primary/10 flex items-center justify-between px-6 z-40 transition-colors">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="p-2 hover:bg-md-primary-container rounded-full text-md-primary transition-colors">
          <Menu size={24} />
        </button>
        <span className="text-xl font-bold text-md-primary italic tracking-tight uppercase">Precision Studio</span>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={toggleDarkMode} className="p-2 hover:bg-md-surface-variant rounded-full text-md-primary transition-all">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="w-10 h-10 rounded-full bg-md-primary-container flex items-center justify-center text-md-primary shadow-sm border border-md-primary/10">
          <User size={20} />
        </div>
      </div>
    </header>
  );
}