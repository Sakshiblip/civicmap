import React, { useState, useEffect } from 'react';
import { 
  X, ChevronRight, FileText, BarChart2, 
  MessageSquare, Bug, ChevronDown, Clock, 
  Send, Loader2, Globe, Settings, Lock, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface ProfileSidebarProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  setDisplayName: (val: string) => void;
}

export default function ProfileSidebar({ user, isOpen, onClose, displayName, setDisplayName }: ProfileSidebarProps) {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [myIssues, setMyIssues] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Profile State
  const [editDisplayName, setEditDisplayName] = useState(displayName);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditDisplayName(displayName);
    }
  }, [isOpen, displayName]);

  useEffect(() => {
    if (isOpen) {
      if (activeAccordion === 'reports') fetchMyIssues();
      if (activeAccordion === 'data') fetchLoginHistory();
    }
  }, [isOpen, activeAccordion]);

  const fetchMyIssues = async () => {
    if (!user) return;
    setIsLoadingIssues(true);
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMyIssues(data);
    setIsLoadingIssues(false);
  };

  const fetchLoginHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('login_logs')
      .select('*')
      .eq('email', user.email)
      .order('logged_in_at', { ascending: false })
      .limit(10);
    if (data) setLoginHistory(data);
    setIsLoadingHistory(false);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Password if provided
      if (newPassword) {
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) throw authError;
      }

      // 2. Update Display Name in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          display_name: editDisplayName,
          updated_at: new Date().toISOString()
        });
      
      if (profileError) throw profileError;

      setDisplayName(editDisplayName);

      setSuccessMsg('Profile updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      message: feedback
    });
    if (!error) {
      setSuccessMsg('Feedback sent! Thanks for your input.');
      setFeedback('');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
    setIsSubmitting(false);
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      description: bugDescription,
      page_url: window.location.href
    });
    if (!error) {
      setSuccessMsg('Bug report submitted. We\'ll look into it!');
      setBugDescription('');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
    setIsSubmitting(false);
  };

  const toggleAccordion = (id: string) => {
    setActiveAccordion(prev => prev === id ? null : id);
  };

  const initials = user?.email?.split('@')[0].slice(0, 2).toUpperCase() || 'US';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[4000] animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 left-0 h-full w-[320px] bg-background border-r border-white/5 z-[5000] shadow-2xl transition-transform duration-500 ease-in-out transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Header */}
          <div className="p-6 border-b border-white/5 relative">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center mt-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center text-background text-2xl font-black shadow-xl shadow-accent/20 mb-4">
                {initials}
              </div>
              <h2 className="text-lg font-heading font-bold text-white tracking-tight">
                {displayName}
              </h2>
              <p className="text-xs text-white/40 font-mono mt-1">{user?.email}</p>
            </div>
          </div>

          {/* Message Banners */}
          {successMsg && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-accent/20 border border-accent/30 text-accent text-center text-xs font-bold animate-in zoom-in-95 duration-200">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-center text-xs font-bold animate-in zoom-in-95 duration-200">
              {errorMsg}
            </div>
          )}

          {/* Accordion Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 mt-2 styled-scrollbar">
            
            {/* Edit Profile */}
            <div className="space-y-1">
              <button 
                onClick={() => toggleAccordion('edit')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeAccordion === 'edit' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Settings size={18} />
                  </div>
                  <span className="text-sm font-bold text-white/80">Edit Profile</span>
                </div>
                {activeAccordion === 'edit' ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              {activeAccordion === 'edit' && (
                <div className="p-3 animate-in slide-in-from-top-1 duration-200">
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Display Name</label>
                          <input 
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-accent"
                            placeholder="Enter your name"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Email Address</label>
                          <div className="relative">
                            <input 
                              type="email"
                              value={user?.email || ''}
                              readOnly
                              className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-[12px] text-white/40 outline-none cursor-not-allowed"
                            />
                            <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                          </div>
                          <p className="text-[9px] text-white/20 pl-1 italic">Email cannot be changed</p>
                        </div>

                        <div className="h-[1px] bg-white/5 mx-1" />

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">New Password</label>
                          <input 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-accent"
                            placeholder="Min. 6 characters"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Confirm Password</label>
                          <input 
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-accent"
                            placeholder="Repeat new password"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-accent text-background font-black py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 disabled:opacity-50 mt-2 shadow-lg shadow-accent/20"
                        >
                          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Save Changes
                        </button>
                    </form>
                </div>
              )}
            </div>
            
            {/* My Reports */}
            <div className="space-y-1">
              <button 
                onClick={() => toggleAccordion('reports')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeAccordion === 'reports' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <FileText size={18} />
                  </div>
                  <span className="text-sm font-bold text-white/80">My Reports</span>
                </div>
                {activeAccordion === 'reports' ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>
              
              {activeAccordion === 'reports' && (
                <div className="p-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                  {isLoadingIssues ? (
                    <div className="py-8 flex justify-center"><Loader2 size={20} className="text-accent animate-spin" /></div>
                  ) : myIssues.length === 0 ? (
                    <p className="text-center py-8 text-xs text-white/20 italic">No reports found.</p>
                  ) : (
                    myIssues.map(issue => (
                      <div key={issue.id} className="p-3 rounded-xl bg-surface/40 border border-white/5 text-[11px]">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-bold text-white">{issue.issue_type}</span>
                          <span className={`capitalize font-bold ${
                            issue.status === 'pending' ? 'text-pending' : issue.status === 'in_progress' ? 'text-inprogress' : 'text-resolved'
                          }`}>{issue.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-white/50 line-clamp-1 mb-1">{issue.description}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
                          <Clock size={10} />
                          {format(new Date(issue.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* My Data */}
            <div className="space-y-1">
              <button 
                onClick={() => toggleAccordion('data')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeAccordion === 'data' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <BarChart2 size={18} />
                  </div>
                  <span className="text-sm font-bold text-white/80">My Data</span>
                </div>
                {activeAccordion === 'data' ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              {activeAccordion === 'data' && (
                <div className="p-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                   <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-2">
                     <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Session History</p>
                     {isLoadingHistory ? (
                       <Loader2 size={16} className="text-accent animate-spin mx-auto my-4" />
                     ) : loginHistory.length === 0 ? (
                       <p className="text-[11px] text-white/20 italic p-2">No login data available.</p>
                     ) : (
                       <div className="space-y-3">
                         {loginHistory.map((log, idx) => (
                           <div key={idx} className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                               <span className="text-[11px] text-white/60">{format(new Date(log.logged_in_at), 'MMM d, ha')}</span>
                             </div>
                             <span className="text-[10px] font-mono text-white/20">Authenticated</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                   <div className="p-3 bg-accent/5 rounded-xl border border-accent/10">
                     <p className="text-[10px] font-black text-accent/40 uppercase tracking-[0.2em] mb-1">Account Info</p>
                     <p className="text-[11px] text-white/60">Registered: Nov 2023</p>
                     <p className="text-[11px] text-white/60">Reports: {myIssues.length}</p>
                   </div>
                </div>
              )}
            </div>

            {/* Feedback */}
            <div className="space-y-1">
              <button 
                onClick={() => toggleAccordion('feedback')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeAccordion === 'feedback' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <MessageSquare size={18} />
                  </div>
                  <span className="text-sm font-bold text-white/80">Feedback</span>
                </div>
                {activeAccordion === 'feedback' ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              {activeAccordion === 'feedback' && (
                <div className="p-3 animate-in slide-in-from-top-1 duration-200">
                  <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                    <textarea 
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Share feedback with admin..."
                      className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-accent min-h-[80px]"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmitting || !feedback.trim()}
                      className="w-full bg-accent text-background font-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Submit Feedback
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Bug Report */}
            <div className="space-y-1">
              <button 
                onClick={() => toggleAccordion('bug')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeAccordion === 'bug' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                    <Bug size={18} />
                  </div>
                  <span className="text-sm font-bold text-white/80">Found a Bug?</span>
                </div>
                {activeAccordion === 'bug' ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              {activeAccordion === 'bug' && (
                <div className="p-3 animate-in slide-in-from-top-1 duration-200">
                  <form onSubmit={handleBugSubmit} className="space-y-3">
                    <p className="text-[10px] text-white/40 mb-1">Current URL: <span className="font-mono">{window.location.pathname}</span></p>
                    <textarea 
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      placeholder="Describe the bug you found..."
                      className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-accent min-h-[80px]"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmitting || !bugDescription.trim()}
                      className="w-full bg-red-500 text-white font-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
                      Report Bug
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>

          <div className="p-6 border-t border-white/5 bg-surface/30">
            <div className="flex items-center gap-2 text-white/30 text-[10px] font-mono">
              <Globe size={12} />
              <span>NagarSeva Production v1.2</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
