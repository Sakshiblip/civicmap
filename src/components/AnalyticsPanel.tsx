import { useState, useMemo } from 'react';
import { BarChart2, X, AlertTriangle, TrendingUp, Clock, MapPin, Filter, Download, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Issue } from '../lib/supabase';

interface AnalyticsPanelProps {
  issues: Issue[];
  isOpen: boolean;
  onClose: () => void;
}

// Mock ward names for demonstration (Mumbai wards)
const wards = [
  'A Ward (Colaba)', 'D Ward (Malabar Hill)', 'G North (Dharavi)', 'K West (Andheri)', 
  'L Ward (Kurla)', 'H East (Santacruz)', 'M West (Chembur)', 'S Ward (Bhandup)'
];

export default function AnalyticsPanel({ issues, isOpen, onClose }: AnalyticsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'all'>('all');

  const timeFilteredIssues = useMemo(() => {
    if (timeFilter === 'all') return issues;
    const now = new Date();
    const days = timeFilter === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return issues.filter(i => new Date(i.created_at) >= cutoff);
  }, [issues, timeFilter]);

  const categoryFilteredIssues = useMemo(() => {
    if (activeFilter === 'all') return timeFilteredIssues;
    return timeFilteredIssues.filter(i => i.status === activeFilter);
  }, [timeFilteredIssues, activeFilter]);

  const wardStats = useMemo(() => {
    // Group issues by a mock ward (derived from index for demo)
    const stats: Record<string, number> = {};
    wards.forEach(ward => (stats[ward] = 0));
    
    categoryFilteredIssues.forEach((issue) => {
      const wardIndex = (issue.lat + issue.lng) % wards.length; // Deterministic mock
      const wardName = wards[Math.floor(wardIndex)];
      stats[wardName] = (stats[wardName] || 0) + 1;
    });

    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [categoryFilteredIssues]);

  const hottestWard = wardStats[0]?.count > 0 ? wardStats[0].name : 'N/A';
  const lastReported = timeFilteredIssues.length > 0 ? format(new Date(timeFilteredIssues[0].created_at), 'h:mm a') : 'N/A';

  const exportCSV = () => {
    const headers = ['ID', 'Type', 'Status', 'Lat', 'Lng', 'Created At'];
    const rows = issues.map(i => [i.id, i.issue_type, i.status, i.lat, i.lng, i.created_at]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `nagarseva_reports_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-[400px] z-[4000] transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full glass border-l border-white/10 shadow-[-20px_0_40px_rgba(0,0,0,0.4)] flex flex-col backdrop-blur-3xl bg-surface/90">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center border border-accent/30 shadow-lg glow-accent">
                <BarChart2 size={20} className="text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Analytics Pulse</h2>
                <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Live density data</p>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white hover:text-accent transition-all uppercase tracking-wider"
                title="Export Data Cluster"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all group">
                <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 styled-scrollbar space-y-8">
           {/* Metric Cards */}
           <div className="grid grid-cols-3 gap-3">
              <div className="premium-card p-3.5 bg-white/5 border-white/10 text-center flex flex-col items-center justify-center gap-2">
                 <AlertTriangle size={16} className="text-orange-500" />
                 <div className="text-2xl font-black text-white font-mono leading-none tracking-tighter">{timeFilteredIssues.length}</div>
                 <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Total</div>
              </div>
              <div className="premium-card p-3.5 bg-white/5 border-white/10 text-center flex flex-col items-center justify-center gap-2 overflow-hidden">
                 <TrendingUp size={16} className="text-emerald-500" />
                 <div className="text-[9px] font-black text-white leading-tight font-mono whitespace-normal h-6 flex items-center justify-center uppercase">{hottestWard}</div>
                 <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Hottest</div>
              </div>
              <div className="premium-card p-3.5 bg-white/5 border-white/10 text-center flex flex-col items-center justify-center gap-2">
                 <Clock size={16} className="text-sky-500" />
                 <div className="text-lg font-black text-white font-mono leading-none tracking-tighter">{lastReported}</div>
                 <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Last</div>
              </div>
           </div>

           {/* Filter Tabs */}
           <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/60 tracking-[0.2em] uppercase">
                   <Filter size={12} className="text-accent" />
                   Categorization
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex p-1 bg-surface/50 rounded-2xl border border-white/10 backdrop-blur-xl">
                   {['all', 'pending', 'resolved'].map(f => (
                     <button
                       key={f}
                       onClick={() => setActiveFilter(f as any)}
                       className={`flex-1 py-2 px-3 rounded-xl font-bold text-[10px] transition-all uppercase tracking-widest ${activeFilter === f ? 'bg-accent text-background shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white/60'}`}
                     >
                       {f === 'all' ? 'Pulse' : f}
                     </button>
                   ))}
                </div>

                <div className="flex p-0.5 bg-surface/30 rounded-xl border border-white/5 backdrop-blur-md gap-1">
                   {[
                     { id: '7d', label: '7 Days' },
                     { id: '30d', label: '30 Days' },
                     { id: 'all', label: 'All Time' }
                   ].map(t => (
                     <button
                       key={t.id}
                       onClick={() => setTimeFilter(t.id as any)}
                       className={`flex-1 py-1 px-2 rounded-lg font-bold text-[9px] transition-all uppercase tracking-wider ${timeFilter === t.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white/50'}`}
                     >
                       {t.label}
                     </button>
                   ))}
                </div>
              </div>
           </div>

           {/* Ward Density List */}
           <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/60 tracking-[0.2em] uppercase">
                   <MapPin size={12} className="text-accent" />
                   Ward-Level Density
                </div>
              </div>
              <div className="space-y-2.5">
                 {wardStats.map((ward, i) => (
                   <div key={ward.name} className="group cursor-pointer">
                      <div className="flex justify-between items-end mb-2">
                         <span className="text-xs font-bold text-white/80 group-hover:text-accent transition-colors">{ward.name}</span>
                         <span className="text-[10px] font-mono font-black text-white/40">{ward.count} reports</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                         <div 
                           className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-emerald-500/40 via-orange-500/60 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                           style={{ width: `${(ward.count / (wardStats[0].count || 1)) * 100}%`, transitionDelay: `${i * 100}ms` }}
                         />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="py-4 px-6 border-t border-white/10 bg-surface/40 backdrop-blur-xl" />
      </div>
    </div>
  );
}
