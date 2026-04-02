import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Users, Clock, MapPin } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { supabase, type Issue } from '../lib/supabase';

export default function AdminAnalytics() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    const channel = supabase.channel('admin-analytics-pulse')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIssues(data as Issue[]);
    }
    setIsLoading(false);
  };

  const metrics = useMemo(() => {
    const todayIssues = issues.filter(i => isToday(new Date(i.created_at)));
    const criticalOpen = issues.filter(i => i.status === 'pending' && (i as any).severity >= 4);
    const resolvedToday = issues.filter(i => i.status === 'resolved' && isToday(new Date(i.created_at))); // Simplified today check
    const activeCitizens = new Set(issues.map(i => i.user_id)).size;

    return [
      { label: 'Issues Today', value: todayIssues.length, icon: TrendingUp, color: 'text-emerald-500', pulse: 'bg-emerald-500' },
      { label: 'Critical Open', value: criticalOpen.length, icon: AlertTriangle, color: 'text-red-500', pulse: 'bg-red-500' },
      { label: 'Resolved Today', value: resolvedToday.length, icon: CheckCircle, color: 'text-teal-500', pulse: 'bg-teal-500' },
      { label: 'Active Citizens', value: activeCitizens, icon: Users, color: 'text-blue-500', pulse: 'bg-blue-500' },
    ];
  }, [issues]);

  const wardHotspots = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach(i => {
      const ward = (i as any).ward_name || 'Unassigned';
      counts[ward] = (counts[ward] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const max = sorted[0]?.[1] || 1;

    return sorted.map(([name, count]) => ({
      name,
      count,
      percentage: (count / max) * 100
    }));
  }, [issues]);

  const recentActivity = issues.slice(0, 6);

  if (isLoading) return <div className="w-full h-48 animate-pulse bg-white/5 rounded-3xl" />;

  return (
    <div className="w-full premium-card bg-[#0d1f1a] border-[#1a3a32] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="p-8 space-y-10">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((m, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 group hover:border-accent/30 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl bg-surface border border-white/5 ${m.color}`}>
                  <m.icon size={20} />
                </div>
                {m.value > 0 && (
                  <div className="relative flex h-3 w-3 mt-1 mr-1">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${m.pulse}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${m.pulse}`}></span>
                  </div>
                )}
              </div>
              <div>
                 <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{m.label}</p>
                 <h3 className="text-3xl font-black text-white mt-1 leading-none">{m.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Middle & Bottom Sections Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Ward Hotspots */}
          <div className="space-y-6">
             <div className="flex items-center gap-2 px-1">
                <MapPin size={16} className="text-accent" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ward Concentration Pulse</h3>
             </div>
             <div className="space-y-5">
                {wardHotspots.map((ward, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                       <span className="text-[11px] font-bold text-white/80">{ward.name}</span>
                       <span className="text-[10px] font-mono font-black text-white/40">{ward.count} Reports</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                       <div 
                         className="h-full rounded-full bg-gradient-to-r from-[#00bcd4]/40 to-[#00bcd4] transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,188,212,0.3)]"
                         style={{ width: `${ward.percentage}%` }}
                       />
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="space-y-6">
             <div className="flex items-center gap-2 px-1">
                <Clock size={16} className="text-accent" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Live Activity Feed</h3>
             </div>
             <div className="space-y-4 max-h-[300px] overflow-y-auto styled-scrollbar pr-2">
                {recentActivity.map((i, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                     <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-white/10 shrink-0 group-hover:border-accent/40 transition-colors">
                        <Clock size={16} className="text-white/20 group-hover:text-accent transition-colors" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                           <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">{i.issue_type}</h4>
                           <span className="text-[9px] font-mono text-white/30 uppercase shrink-0">
                              {format(new Date(i.created_at), 'h:mm a')}
                           </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-medium truncate">
                           {(i as any).ward_name || 'Mumbai District'} • {i.description.substring(0, 40)}...
                        </p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center pt-8 border-t border-white/5 opacity-30">
           <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-white">NagarSeva OS Introspection v3.0</p>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Data Synced</span>
           </div>
        </div>

      </div>
    </div>
  );
}
