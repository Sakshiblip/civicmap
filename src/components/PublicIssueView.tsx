import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Issue } from '../lib/supabase';
import { MapPin, Clock, Navigation, CheckCircle, ChevronLeft, Loader2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

export default function PublicIssueView() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadIssue(id);
    }
  }, [id]);

  const loadIssue = async (issueId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .single();

    if (error) {
      setError('Issue not found or access denied.');
    } else if (data) {
      setIssue(data as Issue);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-accent">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-mono text-sm uppercase tracking-[0.2em]">Retrieving Issue Details...</span>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-card p-12 border border-white/5 max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <MapPin className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4 font-heading">Issue Not Found</h1>
          <p className="text-white/60 mb-8 font-body">The issue you are looking for does not exist or has been removed.</p>
          <Link to="/login" className="inline-flex items-center gap-2 text-accent hover:underline font-bold uppercase tracking-widest text-xs">
            <ChevronLeft size={16} /> Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white font-body pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
            <MapPin className="text-accent" />
            NagarSeva
          </Link>
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] border ${
            issue.status === 'pending' ? 'bg-pending/10 text-pending border-pending/20' : 
            issue.status === 'in_progress' ? 'bg-inprogress/10 text-inprogress border-inprogress/20' : 
            'bg-resolved/10 text-resolved border-resolved/20'
          }`}>
            {issue.status.replace('_', ' ')}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* Left Column: Details */}
          <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
            <div>
              <div className="flex items-center gap-3 mb-4">
                 <div className={`w-3 h-3 rounded-full ${issue.status === 'pending' ? 'bg-pending animate-pulse' : issue.status === 'in_progress' ? 'bg-inprogress' : 'bg-resolved'}`} />
                 <span className="text-accent font-mono text-xs font-bold uppercase tracking-widest">{issue.issue_type}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight mb-6">
                Issue Details
              </h1>
              <p className="text-white/70 text-lg leading-relaxed bg-white/5 border border-white/5 p-6 rounded-2xl">
                {issue.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-6 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3 text-white/40 mb-2 uppercase tracking-widest text-[10px] font-bold">
                  <Navigation size={14} className="text-accent" />
                  Coordinates
                </div>
                <div className="font-mono text-accent text-sm">
                  {issue.lat.toFixed(6)}, {issue.lng.toFixed(6)}
                </div>
              </div>
              <div className="glass-card p-6 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3 text-white/40 mb-2 uppercase tracking-widest text-[10px] font-bold">
                  <Clock size={14} className="text-accent" />
                  Submitted
                </div>
                <div className="font-mono text-white/80 text-sm">
                  {format(new Date(issue.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>

            <div className="p-6 border border-white/5 bg-surface/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-accent" size={20} />
                <span className="text-sm font-bold opacity-60 uppercase tracking-widest">Public Record</span>
              </div>
              <span className="font-mono text-[10px] opacity-30">ID: {issue.id}</span>
            </div>
          </div>

          {/* Right Column: Images */}
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
            {issue.image_urls && issue.image_urls.length > 0 ? (
              <div className="space-y-4">
                {issue.image_urls.map((url, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
                    <img 
                      src={url} 
                      alt={`Issue photo ${i + 1}`} 
                      className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" 
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[400px] bg-surface/40 border border-white/5 border-dashed rounded-3xl flex flex-col items-center justify-center text-white/20 gap-4">
                <ImageIcon size={64} strokeWidth={1} />
                <span className="font-mono text-xs uppercase tracking-widest">No Photos Provided</span>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
