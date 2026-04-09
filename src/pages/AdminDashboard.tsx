import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  ListFilter, 
  LogOut, 
  Menu, 
  X, 
  User, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  ChevronRight, 
  ArrowUpRight,
  Search,
  ArrowUpDown,
  Filter,
  Clock,
  Briefcase,
  Download,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from '../components/MapComponent';
import 'leaflet/dist/leaflet.css';

// Types from Supabase or defined locally
interface Profile {
  id: string;
  full_name: string | null;
  ward_number: string | null;
  email: string | null;
}

interface Issue {
  id: string;
  issue_type: string;
  ward_number: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  description: string;
  lat: number;
  lng: number;
  image_urls: string[];
  email: string;
  user_id?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues'>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  


  // Modal State
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Filter & Sort State
  const [wardFilter, setWardFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'open' | 'resolved'>('newest');

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/login');
      return;
    }

    setUser(session.user);

    // Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch Issues
    const { data: issuesData } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (issuesData) {
      setIssues(issuesData as Issue[]);
    }

    setIsLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };



  const handleDeleteIssue = async (issueId: string) => {
    if (!window.confirm("Delete this issue? This action cannot be undone.")) return;

    const { error } = await supabase.from('issues').delete().eq('id', issueId);

    if (error) {
      console.error("Error deleting issue:", error.message);
    } else {
      setIssues(prev => prev.filter(i => i.id !== issueId));
    }
  };

  const handleExportCSV = () => {
    if (filteredIssues.length === 0) return;

    const headers = ['ID', 'Title', 'Ward', 'Status', 'Reported On'];
    const rows = filteredIssues.map(issue => [
      issue.id,
      issue.issue_type,
      issue.ward_number,
      issue.status,
      format(new Date(issue.created_at), 'dd/MM/yyyy')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nagarseva_issues.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Derived Data
  const distinctWards = useMemo(() => {
    const wards = Array.from(new Set(issues.map(i => i.ward_number))).filter(Boolean);
    return ['All', ...wards.sort()];
  }, [issues]);

  const filteredIssues = useMemo(() => {
    let result = [...issues];

    // Filter by Ward
    if (wardFilter !== 'All') {
      result = result.filter(i => i.ward_number === wardFilter);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      switch (sortBy) {
        case 'newest': return dateB - dateA;
        case 'oldest': return dateA - dateB;
        case 'open': 
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return dateB - dateA;
        case 'resolved':
          if (a.status === 'resolved' && b.status !== 'resolved') return -1;
          if (a.status !== 'resolved' && b.status === 'resolved') return 1;
          return dateB - dateA;
        default: return 0;
      }
    });

    return result;
  }, [issues, wardFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/50 font-mono text-sm tracking-widest uppercase">Initializing Control Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans selection:bg-accent/30">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f0f12]/80 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between z-40">
        <h1 className="text-lg font-black tracking-tighter text-accent uppercase">NagarSeva</h1>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#0f0f12] border-r border-white/5 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-12">
            <h1 className="text-xl font-black tracking-tighter text-accent flex items-center gap-2 uppercase">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              NagarSeva Admin
            </h1>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <button 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${activeTab === 'dashboard' ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_20px_rgba(0,212,170,0.1)]' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <LayoutDashboard className={`w-5 h-5 transition-transform group-hover:scale-110`} />
              <span className="font-bold text-sm tracking-wide">Dashboard</span>
            </button>
            <button 
              onClick={() => { setActiveTab('issues'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${activeTab === 'issues' ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_20px_rgba(0,212,170,0.1)]' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <ListFilter className={`w-5 h-5 transition-transform group-hover:scale-110`} />
              <span className="font-bold text-sm tracking-wide">Issues</span>
            </button>
          </nav>

          <button 
            onClick={handleLogout}
            className="mt-auto w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all duration-300 border border-transparent hover:border-red-400/20 group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-bold text-sm tracking-wide text-left">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-72 pt-16 md:pt-0 min-h-screen transition-all duration-300">
        <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-accent font-mono text-[10px] tracking-[0.3em] uppercase mb-1 drop-shadow-[0_0_5px_rgba(0,212,170,0.5)]">Welcome back, Administrator</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-white">
                {activeTab === 'dashboard' ? 'Admin Profile' : 'Citizen Issues'}
              </h2>
            </div>
          </div>

          {activeTab === 'dashboard' ? (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Profile Card */}
              <div className="glass-card p-8 space-y-6 relative overflow-hidden group max-w-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <User className="w-48 h-48 -mr-12 -mt-12" />
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center text-3xl font-black text-background shadow-xl shadow-accent/20 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                    {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black tracking-tight">{profile?.full_name || 'System Admin'}</h3>
                    <div className="flex items-center gap-2 text-white/40 text-xs font-mono uppercase tracking-widest">
                      <ShieldCheck className="w-3 h-3 text-accent" />
                      Verified Administrator
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1 group/item hover:bg-white/[0.08] transition-colors">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Mail className="w-3 h-3" /> Email Address
                    </label>
                    <p className="text-sm font-medium text-white/90">{user?.email}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1 group/item hover:bg-white/[0.08] transition-colors">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                       <MapPin className="w-3 h-3" /> Assigned Ward
                    </label>
                    <p className="text-sm font-medium text-white/90">Ward #{profile?.ward_number || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Filters Bar */}
              <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                   <div className="p-2 bg-accent/10 border border-accent/20 rounded-lg text-accent">
                      <Filter className="w-4 h-4" />
                   </div>
                   <select 
                    value={wardFilter}
                    onChange={(e) => setWardFilter(e.target.value)}
                    className="flex-1 sm:w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent appearance-none"
                   >
                    {distinctWards.map(ward => (
                      <option key={ward} value={ward} className="bg-[#1a1a1e]">Ward: {ward}</option>
                    ))}
                   </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                   <div className="p-2 bg-white/5 border border-white/5 rounded-lg text-white/40">
                      <ArrowUpDown className="w-4 h-4" />
                   </div>
                   <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 sm:w-56 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent appearance-none"
                   >
                    <option value="newest" className="bg-[#1a1a1e]">Sort: Newest First</option>
                    <option value="oldest" className="bg-[#1a1a1e]">Sort: Oldest First</option>
                    <option value="open" className="bg-[#1a1a1e]">Sort: Status (Open First)</option>
                    <option value="resolved" className="bg-[#1a1a1e]">Sort: Status (Resolved First)</option>
                   </select>
                </div>

                <button 
                  onClick={handleExportCSV}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-accent hover:bg-accent hover:text-background transition-all font-bold text-xs uppercase tracking-widest"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {/* Issues List */}
              <div className="grid grid-cols-1 gap-4">
                {filteredIssues.length === 0 ? (
                  <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                      <Search className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold">No issues found</h4>
                      <p className="text-sm text-white/40 max-w-xs mx-auto">Try adjusting your filters or search parameters to see more results.</p>
                    </div>
                  </div>
                ) : (
                  filteredIssues.map((issue) => (
                    <div key={issue.id} className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-accent/30 transition-all duration-300">
                      <div className="flex items-start gap-5">
                        <div className={`mt-1 w-3 h-3 rounded-full shadow-[0_0_10px_rgba(var(--status-color),0.5)] ${
                          issue.status === 'pending' ? 'bg-red-500' :
                          issue.status === 'in_progress' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        <div className="space-y-2">
                          <h4 className="text-lg font-bold tracking-tight text-white group-hover:text-accent transition-colors">{issue.issue_type || 'Untitled Issue'}</h4>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tracking-wider text-white/40">
                            <span className="flex items-center gap-1.5 uppercase tracking-widest"><Briefcase className="w-3 h-3" /> {issue.ward_number || 'Global'}</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {format(new Date(issue.created_at), 'MMM d, yyyy')}</span>
                            <span className="text-[10px] text-white/20">ID: {issue.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 sm:gap-8">
                        {issue.image_urls && issue.image_urls.length > 0 && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); window.open(issue.image_urls[0], '_blank'); }}
                            className="cursor-pointer group/img relative"
                          >
                            <img 
                              src={issue.image_urls[0]} 
                              alt="Issue thumbnail" 
                              className="h-[60px] w-auto max-w-[100px] object-cover rounded-lg border border-white/10 hover:border-accent transition-all"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <ArrowUpRight className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                          issue.status === 'pending' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                          issue.status === 'in_progress' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' :
                          'text-green-400 bg-green-400/10 border-green-400/20'
                        }`}>
                          {issue.status.replace('_', ' ')}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue.id); }}
                            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-white transition-all group/del"
                            title="Delete Issue"
                          >
                            <Trash2 className="w-5 h-5 transition-transform group-hover/del:scale-110" />
                          </button>
                          <button 
                            onClick={() => setSelectedIssue(issue)}
                            className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-accent hover:text-background transition-all group/btn"
                            title="View Details"
                          >
                            <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Live Map Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30 text-accent">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-white">Live Map</h3>
                </div>
                
                <div className="glass-card overflow-hidden h-[500px] w-full relative border border-white/10 shadow-2xl">
                  <MapComponent 
                    issues={issues} 
                    interactive={true}
                    isAdmin={true}
                    showFilters={true}
                    compactFilters={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedIssue && (
        <IssueDetailModal 
          issue={selectedIssue} 
          onClose={() => setSelectedIssue(null)} 
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card {
          background: rgba(15, 15, 18, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}} />
    </div>
  );
}

function IssueDetailModal({ issue, onClose }: { issue: Issue, onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight">{issue.issue_type}</h2>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
              issue.status === 'pending' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
              issue.status === 'in_progress' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' :
              'text-green-400 bg-green-400/10 border-green-400/20'
            }`}>
              {issue.status.replace('_', ' ')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-mono tracking-wider text-white/40">
            <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Ward #{issue.ward_number}</span>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Reported on {format(new Date(issue.created_at), 'dd MMM yyyy')}</span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
            Description
          </label>
          <p className="text-white/80 leading-relaxed font-medium bg-white/5 border border-white/5 p-6 rounded-2xl whitespace-pre-wrap">
            {issue.description}
          </p>
        </div>

        {issue.image_urls && issue.image_urls.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
              Uploaded Photo
            </label>
            <img 
              src={issue.image_urls[0]} 
              alt="Issue evidence" 
              className="w-full h-auto rounded-3xl border border-white/10 shadow-2xl" 
            />
          </div>
        )}

        <div className="pt-6 border-t border-white/5">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
               <Mail className="w-3 h-3" /> Reporter Email
            </label>
            <p className="text-sm font-medium text-white/90">{issue.email || 'Anonymous'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
