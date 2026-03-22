import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import type { Issue, IssueStatus } from '../lib/supabase';
import MapComponent from './MapComponent';
import { LogOut, Clock, CheckCircle, Navigation, Loader2, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | IssueStatus>('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [activeTab, setActiveTab] = useState<'issues' | 'logins'>('issues');
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(true);
  const [isLoadingLogins, setIsLoadingLogins] = useState(true);

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

  useEffect(() => {
    loadLoginLogs();

    const channel = supabase.channel('login-logs-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'login_logs' },
        (payload) => {
          setLoginLogs(prev => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadIssues = async () => {
    setIsLoadingIssues(true);
    const { data } = await supabase.from('issues').select('*').order('created_at', { ascending: false });
    if (data) {
      setIssues(data as Issue[]);
    }
    setIsLoadingIssues(false);
  };

  const loadLoginLogs = async () => {
    setIsLoadingLogins(true);
    const { data } = await supabase
      .from('login_logs')
      .select('*')
      .order('logged_in_at', { ascending: false })
      .limit(20);
    if (data) {
      setLoginLogs(data);
    }
    setIsLoadingLogins(false);
  };

  const handleStatusChange = async (id: string, newStatus: IssueStatus) => {
    const issue = issues.find(i => i.id === id);
    if (!issue) return;

    // Optimistic update
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    
    const { error: dbError } = await supabase.from('issues').update({ status: newStatus }).eq('id', id);

    if (!dbError) {
      // Trigger email notification via Edge Function
      await supabase.functions.invoke('notify-status-change', {
        body: {
          issue_type: issue.issue_type,
          lat: issue.lat,
          lng: issue.lng,
          new_status: newStatus,
          email: issue.email
        }
      });
    } else {
      // Revert optimism if error
      setIssues(prev => prev.map(i => i.id === id ? { ...i, status: issue.status } : i));
      alert('Failed to update status: ' + dbError.message);
    }
  };

  const handleDeleteIssue = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
      return;
    }

    const { error } = await supabase.from('issues').delete().eq('id', id);
    if (error) {
      alert('Failed to delete issue: ' + error.message);
    }
    // Note: The UI updates automatically via the real-time subscription
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Issue Type', 'Description', 'Status', 'Coordinates', 'Reporter Email', 'Submitted Date', 'Last Updated'];
    const csvContent = [
      headers.join(','),
      ...issues.map(issue => [
        issue.id,
        issue.issue_type,
        `"${issue.description.replace(/"/g, '""')}"`,
        issue.status,
        `"${issue.lat}, ${issue.lng}"`,
        issue.email,
        issue.created_at,
        issue.updated_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nagarseva_issues_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredIssues = issues.filter(issue => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (typeFilter !== 'All' && issue.issue_type !== typeFilter) return false;
    return true;
  }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const types = ['All', 'Garbage Disposal', 'Pothole', 'Street Light', 'Flooding', 'Graffiti', 'Other'];

  const stats = {
    total: issues.length,
    pending: issues.filter(i => i.status === 'pending').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
  };

  return (
    <div className="flex flex-col h-screen w-full relative overflow-hidden bg-background">
      
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-surface border-b border-white/5 z-20">
        <div className="glass-card p-2 md:p-3 flex flex-col items-center justify-center border border-white/5">
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5 font-mono">Total Issues</span>
          <span className="text-xl font-bold font-heading text-white">{stats.total}</span>
        </div>
        <div className="glass-card p-2 md:p-3 flex flex-col items-center justify-center border border-pending/20 bg-pending/5">
          <span className="text-[9px] font-bold text-pending uppercase tracking-widest mb-0.5 font-mono">Pending</span>
          <span className="text-xl font-bold font-heading text-pending">{stats.pending}</span>
        </div>
        <div className="glass-card p-2 md:p-3 flex flex-col items-center justify-center border-inprogress/20 bg-inprogress/5 border">
          <span className="text-[9px] font-bold text-inprogress uppercase tracking-widest mb-0.5 font-mono">In Progress</span>
          <span className="text-xl font-bold font-heading text-inprogress">{stats.inProgress}</span>
        </div>
        <div className="glass-card p-2 md:p-3 flex flex-col items-center justify-center border-resolved/20 bg-resolved/5 border">
          <span className="text-[9px] font-bold text-resolved uppercase tracking-widest mb-0.5 font-mono">Resolved</span>
          <span className="text-xl font-bold font-heading text-resolved">{stats.resolved}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 relative overflow-hidden">
      
      {/* Map Area */}
      <div className="flex-1 relative order-1 md:order-2 h-[40vh] md:h-full">
        <MapComponent 
          issues={issues} 
          interactive={true}
          selectedLocation={flyTo}
          isAdmin={true}
          showFilters={true}
          compactFilters={true}
        />
        
      </div>

      {/* Feed Panel */}
      <div className="w-full md:w-[380px] h-[60vh] md:h-full z-10 glass flex flex-col shadow-2xl order-2 md:order-1 border-l border-white/5 bg-surface/95 block shrink-0">
        
        {/* Header Options */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-accent rounded-lg border border-white/10 transition-all text-xs font-bold uppercase tracking-widest"
              title="Export to CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-red-400" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="p-4 border-b border-white/10 space-y-4">
          <div className="flex gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 bg-surface/50 border border-white/5 rounded-lg py-2 px-3 text-white/80 text-xs focus:outline-none focus:border-accent appearance-none font-mono"
            >
              <option value="all">STATUS: ALL</option>
              <option value="pending">PENDING</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="resolved">RESOLVED</option>
            </select>
            
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 bg-surface/50 border border-white/5 rounded-lg py-2 px-3 text-white/80 text-xs focus:outline-none focus:border-accent appearance-none font-mono"
            >
              {types.map(t => <option key={t} value={t}>{t === 'All' ? 'TYPE: ALL' : t.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="h-[1px] bg-white/5 w-full" />

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('issues')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                activeTab === 'issues' ? 'bg-accent text-background shadow-lg' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Issue Feed
            </button>
            <button
              onClick={() => setActiveTab('logins')}
              className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                activeTab === 'logins' ? 'bg-accent text-background shadow-lg' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Login Activity
            </button>
          </div>


          {activeTab === 'logins' && (
            <div className="flex items-center justify-between text-sm">
              <h3 className="font-bold text-white/80 uppercase tracking-widest text-xs flex items-center gap-2">
                <Clock size={14} /> Recent Login Events
              </h3>
              <span className="text-accent font-mono bg-accent/10 px-2 py-1 rounded">
                Live
              </span>
            </div>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto styled-scrollbar p-0">
          {activeTab === 'issues' ? (
            <div className="p-4 space-y-4 relative min-h-[200px]">
              {isLoadingIssues ? (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-[1px] z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="text-accent animate-spin" size={24} />
                    <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Loading Issues...</span>
                  </div>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="text-center py-20 text-white/30 font-body">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No issues matching filters.</p>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div 
                    key={issue.id}
                    onClick={() => setFlyTo([issue.lat, issue.lng])}
                    className="bg-surface/40 border border-white/5 hover:border-accent/30 rounded-xl p-2 transition-all cursor-pointer group"
                  >
                    {/* Status Badge & Actions */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${issue.status === 'pending' ? 'bg-pending animate-pulse' : issue.status === 'in_progress' ? 'bg-inprogress' : 'bg-resolved'}`} />
                        <span className="font-bold font-heading text-white">{issue.issue_type}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={issue.status}
                          onChange={(e) => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                          className={`text-xs font-bold px-3 py-2 rounded border appearance-none cursor-pointer focus:outline-none uppercase tracking-widest ${
                            issue.status === 'pending' ? 'bg-pending/10 text-pending border-pending/20' : 
                            issue.status === 'in_progress' ? 'bg-inprogress/10 text-inprogress border-inprogress/20' : 
                            'bg-resolved/10 text-resolved border-resolved/20'
                          }`}
                        >
                          <option value="pending">PENDING</option>
                          <option value="in_progress">IN PROGRESS</option>
                          <option value="resolved">RESOLVED</option>
                        </select>

                        <button
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="p-1 text-white/20 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                          title="Delete Issue"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {/* Optional Image Thumbnail */}
                      {issue.image_urls && issue.image_urls.length > 0 && (
                       <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                         <img src={issue.image_urls[0]} alt="thumbnail" className="w-full h-full object-cover" />
                       </div>
                      )}
                      
                      <div className="flex-1">
                        <p className="text-xs text-white/70 line-clamp-2 leading-relaxed mb-1.5 font-body">
                          {issue.description}
                        </p>
                        
                         <div className="flex flex-col gap-1 mt-auto">
                           <div className="flex items-center justify-between text-[9px] font-mono">
                             <span className="truncate max-w-[120px] opacity-40">{issue.email}</span>
                             <span className="opacity-30">ID: {issue.id}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                             <div className="flex items-center gap-1">
                               <Navigation size={10} className="text-accent/50" />
                               <span>{issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}</span>
                             </div>
                             <span className="opacity-20">•</span>
                             <div className="flex items-center gap-1">
                               <Clock size={10} />
                               <span>{format(new Date(issue.created_at), 'MMM d, ha')}</span>
                             </div>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-0 relative min-h-[200px]">
              {isLoadingLogins && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-[1px] z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="text-accent animate-spin" size={24} />
                    <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Loading Activity...</span>
                  </div>
                </div>
              )}
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40 font-mono">
                  <tr>
                    <th className="px-4 py-3 font-bold border-b border-white/10">Email</th>
                    <th className="px-4 py-3 font-bold border-b border-white/10">Role</th>
                    <th className="px-4 py-3 font-bold border-b border-white/10">Time</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-body">
                  {loginLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white/80 truncate max-w-[150px]" title={log.email}>{log.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white/60'
                        }`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 font-mono text-xs">
                        {format(new Date(log.logged_in_at), 'HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                  {loginLogs.length === 0 && !isLoadingLogins && (
                    <tr>
                      <td colSpan={3} className="px-4 py-20 text-center text-white/30 font-body">
                        No login activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
