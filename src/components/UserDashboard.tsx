import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import type { Issue } from '../lib/supabase';
import MapComponent from './MapComponent';
import { LogOut, PlusCircle, List, MapPin, Image as ImageIcon, Send, Navigation, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'submit' | 'list'>('submit');
  
  // Submission Form State
  const [draftLocation, setDraftLocation] = useState<[number, number] | null>(null);
  const [issueType, setIssueType] = useState('Pothole');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadIssues();
    
    // Listen for realtime updates to all issues
    const channel = supabase.channel('user-issues-all-channel')
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
  }, [user?.email]);

  const loadIssues = async () => {
    // We want to load ALL issues now so the map shows everything
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) {
      setIssues(data as Issue[]);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (activeTab === 'submit') {
      setDraftLocation([lat, lng]);
    }
  };

  const handleImageDemo = () => {
    // Instead of doing file upload UI logic directly, we just open a mock input or we use the demo images to simulate selecting images.
    // The prompt says: "Retrofit the existing demo image button to actually fetch a blob and upload it to Supabase Storage, or convert the button to a file input."
    // Let's create an invisible file input and trigger it.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('issue-images')
        .upload(filePath, file);

      if (uploadError) {
        alert(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from('issue-images')
        .getPublicUrl(filePath);

      setImageUrls((prev) => [...prev, data.publicUrl]);
    };
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftLocation || !user) return;
    
    setIsSubmitting(true);
    const { data, error } = await supabase.from('issues').insert({
      user_id: user.id,
      email: user.email,
      lat: draftLocation[0],
      lng: draftLocation[1],
      issue_type: issueType,
      description,
      image_urls: imageUrls,
      status: 'pending'
    }).select().single();
    
    if (error) {
      alert(error.message);
    } else if (data) {
      setIssues((prev) => [data as Issue, ...prev]);
    }

    // Reset form
    setDraftLocation(null);
    setDescription('');
    setImageUrls([]);
    setIsSubmitting(false);
    setActiveTab('list');
  };

  const userIssues = issues.filter(i => i.email === user?.email); // Filter them in frontend for the list

  return (
    <div className="flex h-screen w-full relative overflow-hidden bg-background">
      {/* Map Background */}
      <MapComponent 
        issues={issues} 
        onMapClick={handleMapClick} 
        draftPin={draftLocation}
        selectedLocation={flyTo}
        currentUserId={user?.id}
      />

      {/* Glassmorphism Sidebar (Left) */}
      <div className="w-full md:w-[400px] h-full z-10 glass flex flex-col shadow-2xl transition-all duration-300 transform translate-x-0 absolute md:relative">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <MapPin className="text-accent" />
              CivicMap
            </h1>
            <p className="font-mono text-xs text-white/50 truncate mt-1">{user?.email}</p>
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-red-400">
            <LogOut size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('submit')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'submit' ? 'bg-accent text-background shadow-lg shadow-accent/20' : 'bg-surface/50 text-white/60 hover:bg-surface'
            }`}
          >
            <PlusCircle size={18} />
            Report Issue
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'list' ? 'bg-surface text-white border border-white/20' : 'bg-surface/50 text-white/60 hover:bg-surface'
            }`}
          >
            <List size={18} />
            My Reports ({userIssues.length})
          </button>
        </div>

        {/* Main Scrollable Area */}
        <div className="flex-1 overflow-y-auto w-full styled-scrollbar">
          
          {/* SUBMIT TAB */}
          {activeTab === 'submit' && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-sm text-accent font-body flex gap-3">
                <Navigation className="shrink-0 mt-0.5" size={18} />
                <p>Click anywhere on the map to drop a pin and set the issue location.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Coordinates */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-body">Location Coordinates</label>
                  <div className="bg-surface/80 border border-white/10 rounded-lg p-4 flex items-center justify-between font-mono text-sm">
                    {draftLocation ? (
                      <span className="text-accent">
                        {draftLocation[0].toFixed(5)}, {draftLocation[1].toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-white/30">Waiting for map click...</span>
                    )}
                    {draftLocation && <CheckCircle size={16} className="text-accent" />}
                  </div>
                </div>

                {/* Issue Type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-body">Issue Type</label>
                  <select 
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full bg-surface/80 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-accent outline-none font-body appearance-none"
                  >
                    <option>Garbage Disposal</option>
                    <option>Pothole</option>
                    <option>Street Light</option>
                    <option>Flooding</option>
                    <option>Graffiti</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-body">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Provide details about the issue..."
                    className="w-full bg-surface/80 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-accent outline-none font-body min-h-[120px] resize-y"
                  />
                </div>

                {/* Images */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-body flex justify-between">
                    <span>Photos</span>
                    <span className="text-accent/60 cursor-pointer hover:text-accent" onClick={handleImageDemo}>+ Upload Image</span>
                  </label>
                  
                  {imageUrls.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {imageUrls.map((url, i) => (
                        <div key={i} className="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-white/20 relative group">
                          <img src={url} alt="Upload preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setImageUrls(imageUrls.filter((_, idx) => idx !== i))}
                            className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          >
                            <LogOut size={16} className="transform rotate-45" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      onClick={handleImageDemo}
                      className="border-2 border-dashed border-white/20 hover:border-accent/50 bg-surface/30 rounded-xl p-8 flex flex-col flex-center items-center justify-center gap-2 cursor-pointer transition-colors text-white/40 hover:text-accent"
                    >
                      <ImageIcon size={24} />
                      <span className="text-sm font-medium">Click to upload images</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 pb-8">
                  <button 
                    type="submit"
                    disabled={!draftLocation || !description || isSubmitting}
                    className="w-full bg-accent hover:bg-accent/80 text-background font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
                  >
                    {isSubmitting ? (
                      <span className="animate-pulse">Submitting...</span>
                    ) : (
                      <>
                        <Send size={18} />
                        Submit Report
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LIST TAB */}
          {activeTab === 'list' && (
            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-left-4 duration-300 pb-8">
              {userIssues.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <div className="w-16 h-16 bg-surface/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <List size={24} />
                  </div>
                  <p>No issues reported yet.</p>
                  <button onClick={() => setActiveTab('submit')} className="text-accent hover:underline mt-2 text-sm">Report your first issue</button>
                </div>
              ) : (
                userIssues.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(issue => (
                  <div 
                    key={issue.id} 
                    onClick={() => setFlyTo([issue.lat, issue.lng])}
                    className="bg-surface/80 border border-white/5 hover:border-accent/50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${issue.status === 'pending' ? 'bg-pending animate-pulse' : issue.status === 'in_progress' ? 'bg-inprogress' : 'bg-resolved'}`} />
                        <h3 className="font-heading font-bold">{issue.issue_type}</h3>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded bg-surface border border-white/10 uppercase tracking-widest ${
                        issue.status === 'pending' ? 'text-pending' : issue.status === 'in_progress' ? 'text-inprogress' : 'text-resolved'
                      }`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-white/60 line-clamp-2 mb-3 leading-relaxed">
                      {issue.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-white/40 font-mono">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-accent/80" title={issue.email}>
                          <span className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent">
                            @
                          </span>
                          <span>You</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {format(new Date(issue.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-accent flex items-center gap-1">
                        View <ArrowRight size={12} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
