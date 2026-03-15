import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import type { Issue, IssueStatus } from '../lib/supabase';
import MapComponent from './MapComponent';
import { LogOut, Filter, Clock, CheckCircle, Navigation, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | IssueStatus>('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadIssues();
    
    const channel = supabase.channel('issues-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setIssues(prev => [payload.new as Issue, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setIssues(prev => prev.map(i => i.id === payload.new.id ? payload.new as Issue : i));
          } else if (payload.eventType === 'DELETE') {
            setIssues(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadIssues = async () => {
    const { data } = await supabase.from('issues').select('*').order('created_at', { ascending: false });
    if (data) {
      setIssues(data as Issue[]);
    }
  };

  const handleStatusChange = async (id: string, newStatus: IssueStatus) => {
    // Optimistic update
    setIssues(prev => prev.map(issue => issue.id === id ? { ...issue, status: newStatus } : issue));
    await supabase.from('issues').update({ status: newStatus }).eq('id', id);
  };

  const filteredIssues = issues.filter(issue => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (typeFilter !== 'All' && issue.issue_type !== typeFilter) return false;
    return true;
  }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const types = ['All', 'Garbage Disposal', 'Pothole', 'Street Light', 'Flooding', 'Graffiti', 'Other'];

  return (
    <div className="flex flex-col md:flex-row h-screen w-full relative overflow-hidden bg-background">
      
      {/* Map Area (Left) */}
      <div className="flex-1 relative order-2 md:order-1 h-[50vh] md:h-full">
        <MapComponent 
          issues={issues} 
          interactive={true}
          selectedLocation={flyTo}
          isAdmin={true}
        />
        
        {/* Floating Admin Header on Map */}
        <div className="absolute top-6 left-6 z-10 glass-card px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex flex-center items-center justify-center border border-accent/50">
            <LayoutDashboard className="text-accent w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-white">Administration</h1>
            <p className="font-mono text-xs text-accent">Real-time Command Center</p>
          </div>
        </div>
      </div>

      {/* Right Feed Panel */}
      <div className="w-full md:w-[500px] h-[50vh] md:h-full z-10 glass flex flex-col shadow-2xl order-1 md:order-2 border-l border-white/5 bg-surface/95 block shrink-0">
        
        {/* Header Options */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <span className="font-mono text-sm opacity-60">Session:</span>
            <span className="font-bold font-body">{user?.email}</span>
            <span className="px-2 py-0.5 bg-accent/20 text-accent rounded text-xs font-bold uppercase tracking-widest">Admin</span>
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-red-400" title="Logout">
            <LogOut size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-white/10 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <h3 className="font-bold text-white/80 uppercase tracking-widest text-xs flex items-center gap-2">
              <Filter size={14} /> LIVE Triage Feed
            </h3>
            <span className="text-accent font-mono bg-accent/10 px-2 py-1 rounded">
              {filteredIssues.length} Results
            </span>
          </div>

          <div className="flex gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 bg-surface border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent appearance-none font-body"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 bg-surface border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent appearance-none font-body"
            >
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Issue Feed List */}
        <div className="flex-1 overflow-y-auto styled-scrollbar p-4 space-y-4">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-20 text-white/30 font-body">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No issues matching filters.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div 
                key={issue.id}
                onClick={() => setFlyTo([issue.lat, issue.lng])}
                className="bg-surface border border-white/5 hover:border-accent/30 rounded-xl p-4 transition-all cursor-pointer group"
              >
                {/* Status Badge & Actions */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${issue.status === 'pending' ? 'bg-pending animate-pulse' : issue.status === 'in_progress' ? 'bg-inprogress' : 'bg-resolved'}`} />
                    <span className="font-bold font-heading text-white">{issue.issue_type}</span>
                  </div>
                  
                  {/* Status Dropdown - Stop Propagation so it doesn't trigger map fly */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={issue.status}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                      className={`text-xs font-bold px-2 py-1 rounded border appearance-none cursor-pointer focus:outline-none uppercase tracking-widest ${
                        issue.status === 'pending' ? 'bg-pending/10 text-pending border-pending/20' : 
                        issue.status === 'in_progress' ? 'bg-inprogress/10 text-inprogress border-inprogress/20' : 
                        'bg-resolved/10 text-resolved border-resolved/20'
                      }`}
                    >
                      <option value="pending">PENDING</option>
                      <option value="in_progress">IN PROGRESS</option>
                      <option value="resolved">RESOLVED</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  {/* Optional Image Thumbnail */}
                  {issue.image_urls && issue.image_urls.length > 0 && (
                   <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-white/10">
                     <img src={issue.image_urls[0]} alt="thumbnail" className="w-full h-full object-cover" />
                   </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="text-sm text-white/70 line-clamp-2 leading-relaxed mb-2 font-body">
                      {issue.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto text-xs text-white/40 font-mono">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5" title={issue.email}>
                          <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white">
                            @
                          </span>
                          <span className="truncate max-w-[150px]">{issue.email}</span>
                        </div>
                        <div className="text-[10px] opacity-70 ml-5 font-mono">ID: {issue.user_id}</div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Navigation size={12} className="text-accent/70" />
                        <span>{issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{format(new Date(issue.created_at), 'MMM d, ha')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
