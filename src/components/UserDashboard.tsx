import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import type { Issue } from '../lib/supabase';
import MapComponent from './MapComponent';
import ThemeToggle from './ThemeToggle';
import { LogOut, PlusCircle, List, MapPin, Image as ImageIcon, Send, Navigation, Clock, CheckCircle, ArrowRight, Loader2, Share2 } from 'lucide-react';
import { format } from 'date-fns';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'submit' | 'list'>('submit');

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') !== 'light';
    }
    return true;
  });

  useEffect(() => {
    if (!isDark) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isDark]);

  // Submission Form State
  const [draftLocation, setDraftLocation] = useState<[number, number] | null>(null);
  const [issueType, setIssueType] = useState('Pothole');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'success' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [dailyIssueCount, setDailyIssueCount] = useState(0);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    loadIssues();
    checkDailyLimit();
    const watchId = handleGeolocation();

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
      if (typeof watchId === 'number') {
        navigator.geolocation.clearWatch(watchId);
      }
      // Cleanup preview URLs on unmount
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [user?.email]);

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;

    return navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        // Only set flyTo initially if we haven't already
        setFlyTo(prev => prev ? prev : [latitude, longitude]);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
        setToast({ message: 'Location access denied — defaulting to Mumbai', type: 'info' });
        setTimeout(() => setToast(null), 4000);
        }
        // Fallback to Mumbai if we don't have a location yet
        setFlyTo(prev => prev ? prev : [19.0760, 72.8777]);
      },
      { enableHighAccuracy: true }
    );
  };

  const loadIssues = async () => {
    setIsLoading(true);
    // We want to load ALL issues now so the map shows everything
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setIssues(data as Issue[]);
    }
    setIsLoading(false);
  };
  
  const checkDailyLimit = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count, error } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());

    if (!error && count !== null) {
      setDailyIssueCount(count);
    }
  };

  const handleShare = (id: string) => {
    const url = `https://nagarseva-mumbai.vercel.app/issue/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ message: 'Link copied to clipboard', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    });
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (activeTab === 'submit') {
      setDraftLocation([lat, lng]);
    }
  };

  const handleImageDemo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files as FileList);
      if (files.length === 0) return;

      // Add to selected files
      setSelectedFiles(prev => [...prev, ...files]);

      // Create preview URLs
      const newPreviews = files.map(file => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        return url;
      });
      setImageUrls(prev => [...prev, ...newPreviews]);
    };
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftLocation || !user) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    const uploadedUrls: string[] = [];

    // Upload files if any
    if (selectedFiles.length > 0) {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('issue-images')
          .upload(filePath, file, {
            onUploadProgress: (progress: any) => {
              const currentFileProgress = (progress.loaded / progress.total) * 100;
              const overallProgress = ((i / selectedFiles.length) * 100) + (currentFileProgress / selectedFiles.length);
              setUploadProgress(Math.round(overallProgress));
            }
          } as any);

        if (uploadError) {
          alert('Failed to upload image: ' + uploadError.message);
          setIsSubmitting(false);
          setUploadProgress(null);
          return;
        }

        const { data } = supabase.storage
          .from('issue-images')
          .getPublicUrl(filePath);
        
        uploadedUrls.push(data.publicUrl);
      }
    }

    setUploadProgress(null);

    const { data, error } = await supabase.from('issues').insert({
      user_id: user.id,
      email: user.email,
      lat: draftLocation[0],
      lng: draftLocation[1],
      issue_type: issueType,
      description,
      image_urls: uploadedUrls,
      status: 'pending'
    }).select().single();

    if (error) {
      alert(error.message);
    } else if (data) {
      setIssues((prev) => [data as Issue, ...prev]);
      setToast({ message: 'Issue reported successfully!', type: 'success' });
      setTimeout(() => setToast(null), 5000);
      
      // Cleanup preview URLs
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      
      // Update daily limit count
      await checkDailyLimit();
    }

    // Reset form
    setDraftLocation(null);
    setIssueType('Pothole');
    setDescription('');
    setImageUrls([]);
    setSelectedFiles([]);
    setIsSubmitting(false);
    setActiveTab('list');
  };

  const userIssues = issues.filter(i => i.email === user?.email); // Filter them in frontend for the list

  return (
    <div className="flex flex-col md:flex-row h-screen w-full relative overflow-hidden bg-background">
      {/* Map Section */}
      <div className="h-[50vh] md:h-full md:flex-1 relative order-1 md:order-2">
        <MapComponent
          issues={issues}
          onMapClick={handleMapClick}
          draftPin={draftLocation}
          selectedLocation={flyTo}
          userLocation={userLocation}
          currentUserId={user?.id}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[2000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`${toast.type === 'success' ? 'toast-success' : 'bg-surface/90'} backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-white`}>
            {toast.type === 'success' ? (
              <CheckCircle size={18} className="text-white" />
            ) : (
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Sidebar Section */}
      <div className="h-[50vh] md:h-full w-full md:w-[400px] z-10 glass flex flex-col shadow-2xl order-2 md:order-1 relative shrink-0">

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <MapPin className="text-accent" />
              NagarSeva
            </h1>
            <p className="font-mono text-xs text-white/50 truncate mt-1">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
            <button onClick={logout} className="p-3 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-red-400" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2 border-b border-white/5">
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 py-4 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'submit' ? 'bg-accent text-background shadow-lg shadow-accent/20' : 'bg-surface/50 text-white/60 hover:bg-surface'
              }`}
          >
            <PlusCircle size={18} />
            Report Issue
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-4 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'list' ? 'bg-surface text-white border border-white/20' : 'bg-surface/50 text-white/60 hover:bg-surface'
              }`}
          >
            <List size={18} />
            My Reports ({userIssues.length})
          </button>
        </div>

        {/* Instruction Banner (Sticky on Mobile) */}
        {activeTab === 'submit' && (
          <div className="px-6 py-4 border-b border-white/5 bg-accent/5">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-sm text-accent font-body flex gap-3">
              <Navigation className="shrink-0 mt-0.5" size={18} />
              <p>Click anywhere on the map to drop a pin and set the issue location.</p>
            </div>
          </div>
        )}

        {/* Main Scrollable Area */}
        <div className="flex-1 overflow-y-auto w-full styled-scrollbar">

          {/* SUBMIT TAB */}
          {activeTab === 'submit' && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
                            onClick={() => {
                              const newFiles = [...selectedFiles];
                              newFiles.splice(i, 1);
                              setSelectedFiles(newFiles);
                              const newUrls = [...imageUrls];
                              URL.revokeObjectURL(newUrls[i]);
                              newUrls.splice(i, 1);
                              setImageUrls(newUrls);
                            }}
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

                <div className="pt-4 pb-8 space-y-4">
                  {uploadProgress !== null && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between text-xs font-bold text-accent uppercase tracking-wider font-mono">
                        <span>Uploading images...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/10">
                        <div 
                          className="bg-accent h-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={!draftLocation || !description || isSubmitting || dailyIssueCount >= 3}
                      className="w-full bg-accent hover:bg-accent/80 text-background font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Submit Report
                        </>
                      )}
                    </button>
                    
                    {dailyIssueCount >= 3 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-xs text-red-400 font-bold text-center tracking-tight leading-relaxed">
                          You have reached the daily limit of 3 issue reports. <br />
                          Please try again tomorrow.
                        </p>
                      </div>
                    )}
                  </div>
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
                userIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(issue => (
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
                      <span className={`text-xs font-bold px-2 py-1 rounded bg-surface border border-white/10 uppercase tracking-widest ${issue.status === 'pending' ? 'text-pending' : issue.status === 'in_progress' ? 'text-inprogress' : 'text-resolved'
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
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleShare(issue.id)}
                          className="p-1.5 text-white/20 hover:text-accent hover:bg-accent/10 rounded transition-all"
                          title="Share Issue"
                        >
                          <Share2 size={14} />
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-accent flex items-center gap-1">
                          View <ArrowRight size={12} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-x-0 top-0 bottom-0 z-[100] bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="glass-card px-6 py-4 flex items-center gap-3 border border-white/10 shadow-2xl">
              <Loader2 className="text-accent animate-spin" size={20} />
              <span className="font-bold text-sm text-white/80 uppercase tracking-widest font-mono">Fetching Issues...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
