"use client";

import React from "react";
import { 
  Zap, 
  Target, 
  BrainCircuit, 
  History, 
  ArrowRightCircle, 
  Activity, 
  ShieldCheck 
} from "lucide-react";

export default function Home() {
  return (
    <div className="p-6 md:p-10 space-y-12 max-w-[1400px] mx-auto transition-colors">
      <HeaderSection />
      
      {/* STATS FRAGMENT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Spinal Nodes" value="1,284" icon={<BrainCircuit size={28} />} type="primary" />
        <StatCard label="Question Bank" value="8,402" icon={<Target size={28} />} type="secondary" />
        <StatCard label="Ingested Today" value="+154" icon={<Zap size={28} />} type="primary" />
        <StatCard label="Verified" value="98.2%" icon={<ShieldCheck size={28} />} type="secondary" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2">
          <ActivityFeed />
        </div>
        <div>
          <MilestoneCard />
        </div>
      </div>
    </div>
  );
}

function HeaderSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-md-primary italic tracking-tight uppercase">Admin Dashboard</h1>
      <p className="text-sm text-md-on-surface-variant font-medium mt-1 italic">Precision Monitoring for Root & Rise Ingestion.</p>
    </div>
  );
}

function StatCard({ label, value, icon, type }: any) {
  return (
    <div className="p-7 rounded-[2.5rem] border border-md-primary/10 flex items-center gap-6 shadow-sm bg-md-surface transition-all hover:translate-y-[-4px]">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${type === 'primary' ? 'bg-md-primary text-white shadow-md-primary/20' : 'bg-md-primary-container text-md-primary'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-md-primary uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-bold text-md-on-surface mt-1">{value}</h3>
      </div>
    </div>
  );
}

function ActivityFeed() {
  return (
    <section className="bg-md-surface rounded-[2rem] border border-md-outline/10 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-md-outline/20 bg-md-primary-container/20 flex items-center gap-3">
        <History size={20} className="text-md-primary" />
        <h2 className="text-md font-bold text-md-primary uppercase tracking-tight">Recent Studio Activity</h2>
      </div>
      <div className="p-16 text-center">
        <Activity size={48} className="mx-auto text-md-primary/20 mb-4" />
        <p className="text-sm font-medium text-md-on-surface-variant">Real-time activity logs will populate here during ingestion.</p>
      </div>
    </section>
  );
}

function MilestoneCard() {
  return (
    <section className="bg-md-primary text-md-on-primary rounded-[2rem] p-8 shadow-xl shadow-md-primary/30 relative overflow-hidden group">
      <ArrowRightCircle size={120} className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform" />
      <h2 className="font-bold mb-6 italic text-lg uppercase tracking-wider">Next Milestone</h2>
      <div className="p-6 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
        <p className="text-xl font-bold">GS-2 Hierarchy Seeding</p>
        <p className="text-xs opacity-80 mt-2 uppercase font-black tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-md-primary-container animate-pulse" />
          In Progress
        </p>
      </div>
    </section>
  );
}