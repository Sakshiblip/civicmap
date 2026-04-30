import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import type { Issue } from '../lib/supabase';
import MapComponent from './MapComponent';
import ThemeToggle from './ThemeToggle';
import { format } from 'date-fns';
import SearchBar from './SearchBar';
import AnalyticsPanel from './AnalyticsPanel';
import LayerControlPanel from './LayerControlPanel';
import { Clock, Send, LogOut, ArrowRight, Loader2, ImageIcon, Share2, List, CheckCircle, MapPin, PlusCircle, Navigation, X, ChevronDown } from 'lucide-react';
import ProfileSidebar from './ProfileSidebar';
import type { IssueStatus } from '../lib/supabase';

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
  const [_uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'success' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [dailyIssueCount, setDailyIssueCount] = useState(0);
  const [formStep, setFormStep] = useState(1);
  const objectUrlsRef = useRef<string[]>([]);

  // Map Controls State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || '');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [overlays, setOverlays] = useState({
    heatmap: false
  });
  const [opacities, setOpacities] = useState({
    heatmap: 0.8
  });
  const [submittedIssue, setSubmittedIssue] = useState<Issue | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Removal & Undo State
  const [lastDeletedLocation, setLastDeletedLocation] = useState<[number, number] | null>(null);
  const [lastDeletedAddress, setLastDeletedAddress] = useState<string>('');
  const [isDraftRemoving, setIsDraftRemoving] = useState(false);
  const [showRemovedInline, setShowRemovedInline] = useState(false);
  const [undoToast, setUndoToast] = useState<{ visible: boolean } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // Filter State (Lifted from MapComponent)
  const [statusFilter, setStatusFilter] = useState<'all' | IssueStatus>('all');
  const [typeFilter, setTypeFilter] = useState('All');

  const baseLayerUrls = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{x}/{y}'
  };

  useEffect(() => {
    loadIssues();
    checkDailyLimit();
    fetchProfile();
    handleGeolocation();

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
      // Cleanup preview URLs on unmount
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [user?.email]);

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        // fly map to user location
        setFlyTo([latitude, longitude]);
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
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
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

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (data?.display_name) {
      setDisplayName(data.display_name);
    }
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

  const fetchAddress = async (lat: number, lng: number) => {
    setIsLocating(true);
    setSelectedAddress('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: {
          'User-Agent': 'NagarSeva-Citizen-App/1.0 (contact: support@nagarseva.example.com)'
        }
      });
      const data = await response.json();
      if (data && data.display_name) {
        setSelectedAddress(data.display_name);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (activeTab === 'submit') {
      // Clear any pending removal/undo states when a new pin is placed
      setIsDraftRemoving(false);
      setShowRemovedInline(false);
      setUndoToast(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

      setDraftLocation([lat, lng]);
      fetchAddress(lat, lng);
    }
  };

  const handleCancelDraft = () => {
    if (!draftLocation) return;

    setIsDraftRemoving(true);
    // Visual feedback for marker removal
    setTimeout(() => {
      setLastDeletedLocation(draftLocation);
      setLastDeletedAddress(selectedAddress);
      setDraftLocation(null);
      setSelectedAddress('');
      setIsDraftRemoving(false);
      setShowRemovedInline(true);

      // Inline message duration
      setTimeout(() => setShowRemovedInline(false), 2000);

      // Undo snackbar logic
      setUndoToast({ visible: true });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoToast(null);
      }, 5000);
    }, 300);
  };

  const handleUndoCancel = () => {
    if (lastDeletedLocation) {
      setDraftLocation(lastDeletedLocation);
      setSelectedAddress(lastDeletedAddress);
      setUndoToast(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
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
    if (!error) {
      await sendEmailNotification(data)
    }

    if (error) {
      alert(error.message);
    } else if (data) {
      setIssues((prev) => [data as Issue, ...prev]);
      setSubmittedIssue(data as Issue);

      // Cleanup preview URLs
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];

      // Update daily limit count
      await checkDailyLimit();
    }

    setIsSubmitting(false);
  };

  const handleSearchSelect = (lat: number, lng: number) => {
    setFlyTo([lat, lng]);
  };

  const userIssues = issues.filter(i => i.email === user?.email);


  async function sendEmailNotification(data: any) {
    await fetch("https://qluqaqlwtbjsdhikcfwv.supabase.co/functions/v1/send-issue-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issue: {
          title: "New Issue Created",
          description: "New Issue Created with Issue type " + data.issue_type,
        },
      }),
    });
  }


  return (
    <div className="flex flex-col md:flex-row h-screen w-full relative overflow-hidden bg-background">

      {/* Row 1: Navbar (Fixed 48px on mobile) */}
      <div className="fixed top-0 left-0 right-0 z-[5000] flex items-center justify-between bg-gray-900 border-b border-white/5 px-4 h-[48px] md:h-auto md:top-3 md:left-3 md:right-auto md:w-auto md:rounded-xl md:shadow-lg md:px-3 md:py-2">
        <div className="flex items-center gap-2">
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
          <button
            onClick={logout}
            className="w-8 h-8 flex items-center justify-center bg-red-500/10 rounded-lg text-red-500 hover:bg-red-500/20 transition-all"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
        <button
          onClick={() => setIsProfileOpen(true)}
          className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg text-accent text-[9px] font-black uppercase tracking-widest transition-all md:block"
        >
          My Account
        </button>
      </div>

      {/* Row 2: Filters (Mobile Only, 40px) */}
      <div className="md:hidden fixed top-[48px] left-0 right-0 z-[4500] h-[40px] bg-gray-900 border-b border-white/5 flex items-center px-2 gap-2">
        <div className="flex-1 relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-surface/50 border border-accent/30 rounded-full py-1.5 px-3 text-[10px] font-black text-white/80 appearance-none focus:outline-none focus:border-accent uppercase tracking-wider font-mono"
          >
            <option value="all">Status: All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
        </div>
        <div className="flex-1 relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-surface/50 border border-accent/30 rounded-full py-1.5 px-3 text-[10px] font-black text-white/80 appearance-none focus:outline-none focus:border-accent uppercase tracking-wider font-mono"
          >
            {['All', 'Garbage Disposal', 'Pothole', 'Street Light', 'Flooding', 'Graffiti', 'Other'].map(t => (
              <option key={t} value={t}>{t === 'All' ? 'Type: All' : t}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
        </div>
      </div>

      {/* Map Section (Full screen) */}
      <div className="relative md:absolute inset-0 z-0 flex-1">
        <MapComponent
          issues={issues}
          onMapClick={handleMapClick}
          onLocateMe={handleGeolocation}
          draftPin={draftLocation}
          onCancelDraft={handleCancelDraft}
          isDraftRemoving={isDraftRemoving}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          showFilters={typeof window !== 'undefined' && window.innerWidth >= 768}
          selectedLocation={flyTo}
          userLocation={userLocation}
          baseLayerUrl={baseLayerUrls['osm']}
          showHeatmap={overlays.heatmap}
        />
      </div>

      {/* Floating Search Bar */}
      <SearchBar onSelect={handleSearchSelect} userLocation={userLocation} />

      {/* Analytics Panel */}
      <AnalyticsPanel
        issues={issues}
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />

      {/* Layer Control Panel */}
      <LayerControlPanel
        overlays={overlays}
        onOverlayToggle={(key) => setOverlays(prev => ({ ...prev, [key]: !prev[key] }))}
        opacities={opacities}
        onOpacityChange={(key, val) => setOpacities(prev => ({ ...prev, [key]: val }))}
      />

      {/* Analytics Trigger Button */}
      {!isAnalyticsOpen && (
        <button
          onClick={() => setIsAnalyticsOpen(true)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full glass border border-white/10 shadow-2xl flex items-center justify-center text-accent hover:glow-accent transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 z-[3000]"
          title="Open Analytics"
        >
          <List size={24} />
        </button>
      )}

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

      {/* Undo Snackbar */}
      {undoToast?.visible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-6 text-white min-w-[320px] justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              <p className="text-sm font-bold tracking-wide">Issue location removed.</p>
            </div>
            <button
              onClick={handleUndoCancel}
              className="text-xs font-black uppercase tracking-[0.2em] text-accent hover:text-white transition-colors py-2 px-4 bg-accent/10 hover:bg-accent/20 rounded-lg border border-accent/20"
            >
              Tap to undo
            </button>
          </div>
        </div>
      )}

      {/* Floating Draggable Sidebar / Bottom Sheet */}
      <div
        style={{
          left: typeof window !== 'undefined' && window.innerWidth >= 768 ? '24px' : '0',
          top: typeof window !== 'undefined' && window.innerWidth >= 768 ? '100px' : 'auto',
          cursor: 'auto',
          transform: !sheetOpen && typeof window !== 'undefined' && window.innerWidth < 768 ? 'translateY(calc(100% - 72px))' : 'translateY(0)',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), left 0.1s, top 0.1s'
        }}
        className="fixed md:w-[320px] w-full bottom-0 md:bottom-auto z-[2000] glass flex flex-col shadow-2xl rounded-t-[32px] md:rounded-[32px] overflow-hidden select-none max-h-[75vh] md:max-h-[calc(100vh-80px)] animate-in slide-in-from-bottom-10 duration-500 pb-0"
      >
        {/* Minimal Centered Drag Handle */}
        <div
          onClick={() => setSheetOpen(s => !s)}
          className="w-10 h-1 bg-gray-400/50 rounded-full mx-auto my-3 cursor-pointer hover:bg-gray-400 transition-colors"
        />

        {/* Tabs - Smaller (Always Visible) */}
        <div className="flex items-center p-3 gap-4 border-b border-white/5">
          <button
            onClick={() => { setActiveTab('submit'); setFormStep(1); setSheetOpen(true); }}
            className={`flex-1 h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'submit' ? 'bg-accent text-background shadow-lg shadow-accent/20' : 'bg-surface/50 text-white/40 hover:bg-surface'
              }`}
          >
            <PlusCircle size={16} />
            Report Issue
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'list' ? 'bg-accent text-background shadow-lg shadow-accent/20' : 'bg-surface/50 text-white/40 hover:bg-surface'
              }`}
          >
            <List size={16} />
            <span className="md:inline">My Reports ({issues.filter(i => i.email === user?.email).length})</span>
          </button>
        </div>

        {/* Conditional Content Wrapping everything else */}
        {sheetOpen && (
          <div className="flex-1 overflow-y-auto w-full flex flex-col styled-scrollbar">
            {/* Header Info */}
            <div className="px-5 pt-1 pb-4 border-b border-white/5 flex flex-col bg-surface/30 backdrop-blur-xl">
              <div className="hidden md:block">
                <h1 className="font-heading text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                    <MapPin size={16} className="text-accent" />
                  </div>
                  NagarSeva
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-[9px] text-white/40 truncate uppercase tracking-widest px-0.5">Verified: {displayName}</p>
                </div>
              </div>
            </div>

            {/* Instruction Banner */}
            {activeTab === 'submit' && !submittedIssue && (
              <div className="px-5 pt-3">
                <p className="text-xs text-white/40 font-medium flex items-center gap-2">
                  <Navigation size={12} className="text-accent/50" />
                  Tap & hold map to drop a pin.
                </p>
              </div>
            )}

            {/* Legend */}
            {activeTab === 'submit' && !submittedIssue && (
              <div className="px-5 py-2.5 flex items-center gap-4 bg-white/[0.02] border-y border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Resolved</span>
                </div>
              </div>
            )}

            {/* Stepper Component - Smaller */}
            {activeTab === 'submit' && !submittedIssue && (
              <div className="px-8 pt-4 pb-2">
                {/* Stepper logic */}
                <div className="relative flex justify-between gap-4">
                  {/* Stepper Progress Lines */}
                  <div className="stepper-line w-full" />
                  <div className="stepper-line-active" style={{ width: `${((formStep - 1) / 2) * 100}%` }} />

                  {/* Steps */}
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="relative z-20 flex flex-col items-center flex-1">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 font-bold border-2 text-[10px] ${formStep === step
                            ? 'bg-accent border-accent text-white shadow-lg shadow-accent/30 scale-110'
                            : formStep > step
                              ? 'bg-accent border-accent text-background'
                              : 'bg-surface border-white/20 text-white/40'
                          }`}
                      >
                        {formStep > step ? <CheckCircle size={14} strokeWidth={3} /> : step}
                      </div>
                      <span className={`text-xs mt-1.5 font-bold uppercase tracking-widest transition-colors duration-300 ${formStep === step ? 'text-white' : 'text-white/40'
                        }`}>
                        {step === 1 ? 'Map' : step === 2 ? 'Details' : 'Media'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBMIT TAB - Compact */}
            {activeTab === 'submit' && !submittedIssue && (
              <div className="px-5 py-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <form onSubmit={handleSubmit} className="space-y-2">
                  {/* STEP 1: LOCATION */}
                  {formStep === 1 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-2">
                        <div
                          className={`premium-card p-2.5 bg-gradient-to-br from-surface to-surface/50 border-white/10 transition-all duration-500 ${draftLocation ? 'scale-[1.01] border-accent/20 glow-accent' : 'opacity-80'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <label className="text-[9px] font-black text-accent uppercase tracking-[0.2em] font-mono">
                              Selected Location
                            </label>
                            <div className="flex items-center gap-2">
                              {draftLocation && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                                  <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
                                  <span className="text-[8px] font-bold text-accent uppercase tracking-wider">High precision</span>
                                </div>
                              )}
                              {draftLocation && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleCancelDraft(); }}
                                  className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 rounded-full transition-all"
                                  title="Remove location"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-h-[32px] flex items-center">
                              {showRemovedInline ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                  <span className="text-xs text-red-500 font-bold uppercase tracking-wider">Location removed.</span>
                                </div>
                              ) : isLocating ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 size={14} className="animate-spin text-accent" />
                                  <span className="text-sm text-white/50 font-medium italic text-[11px]">Locating...</span>
                                </div>
                              ) : selectedAddress ? (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-white leading-tight">
                                    {selectedAddress}
                                  </p>
                                  <p className="text-[8px] text-accent font-bold flex items-center gap-1">
                                    <CheckCircle size={8} /> Location locked
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[11px] text-white/30 font-medium italic">Drop a pin on map...</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="sticky bottom-0 bg-surface/90 backdrop-blur-md -mx-5 px-5 py-3 border-t border-white/5 z-30 mt-4">
                        <button
                          type="button"
                          disabled={!draftLocation}
                          onClick={() => setFormStep(2)}
                          className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-[11px] group ${!draftLocation
                              ? 'bg-transparent border border-white/10 text-white/30 hover:bg-white/5 cursor-not-allowed shadow-none'
                              : 'bg-gradient-to-r from-accent to-emerald-400 hover:to-accent text-background shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                          Next: Issue Type
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </button>
                        {!draftLocation && (
                          <p className="text-[9px] text-white/40 text-center animate-pulse font-bold tracking-wider uppercase mt-2">
                            Drop a pin on the map to continue
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: DETAILS */}
                  {formStep === 2 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-2">
                        {/* Issue Type */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] font-mono ml-1">Select Category</label>
                          <div className="grid grid-cols-3 gap-1">
                            {['Pothole', 'Garbage', 'Street Light', 'Flooding', 'Graffiti', 'Other'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setIssueType(type)}
                                className={`p-1.5 rounded-lg border text-[10px] font-bold transition-all ${issueType === type
                                    ? 'bg-accent text-background border-accent shadow-lg shadow-accent/10'
                                    : 'bg-surface/50 border-white/5 text-white/60 hover:border-white/20'
                                  }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] font-mono ml-1">Describe Situation</label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            rows={3}
                            placeholder="What needs attention?"
                            className="w-full bg-surface/50 border border-white/10 rounded-xl p-2.5 text-[11px] text-white focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-body min-h-[80px] transition-all resize-none"
                          />
                        </div>
                      </div>

                      <div className="sticky bottom-0 bg-surface/90 backdrop-blur-md -mx-5 px-5 py-3 border-t border-white/5 z-30 mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormStep(1)}
                          className="px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 text-[10px]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={!description || description.length < 5}
                          onClick={() => setFormStep(3)}
                          className="flex-1 bg-gradient-to-r from-accent to-emerald-400 text-background font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 shadow-xl shadow-accent/20 group text-[11px]"
                        >
                          Add Photos
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PHOTOS & SUBMIT */}
                  {formStep === 3 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] font-mono ml-1">Evidence (Optional)</label>

                        {imageUrls.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {imageUrls.map((url, i) => (
                              <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 relative group">
                                <img src={url} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
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
                                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl transform scale-0 group-hover:scale-100 transition-transform"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            <div
                              onClick={handleImageDemo}
                              className="aspect-square rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group"
                            >
                              <PlusCircle size={16} className="text-white/20 group-hover:text-accent" />
                              <span className="text-[8px] font-bold text-white/30 group-hover:text-accent uppercase tracking-widest text-center px-1">Add More</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={handleImageDemo}
                            className="premium-card p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all group border-dashed"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:bg-accent/10">
                              <ImageIcon size={20} className="text-white/20 group-hover:text-accent" />
                            </div>
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-white group-hover:text-accent transition-colors">Select Photos</p>
                              <p className="text-[8px] text-white/30 uppercase tracking-widest mt-0.5">PNG, JPG up to 10MB</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Summary Card - even smaller */}
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10 space-y-1">
                        <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Summary</p>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-white/60">Type:</span>
                          <span className="font-bold text-accent">{issueType}</span>
                        </div>
                      </div>

                      <div className="sticky bottom-0 bg-surface/90 backdrop-blur-md -mx-5 px-5 py-3 border-t border-white/5 z-30 mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormStep(2)}
                          className="px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 text-[10px]"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || dailyIssueCount >= 3}
                          className="flex-1 bg-accent text-background font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-accent/20 text-[11px]"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Wait...
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              Complete
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* LIST TAB */}
            {activeTab === 'submit' && submittedIssue && (
              <div className="p-8 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center border border-accent/20 shadow-2xl shadow-accent/20 group">
                  <CheckCircle size={40} className="text-accent group-hover:scale-110 transition-transform" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Report submitted!</h3>
                  <p className="text-sm text-white/40 leading-relaxed max-w-[240px] mx-auto">
                    Our team has been notified. You can track its progress in your reports.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 w-full space-y-1">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Issue ID</label>
                  <p className="text-sm font-mono font-bold text-accent">{submittedIssue.id.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="flex flex-col gap-3 w-full pt-4">
                  <button
                    onClick={() => {
                      setActiveTab('list');
                      setSubmittedIssue(null);
                      setDraftLocation(null);
                      setIssueType('Pothole');
                      setDescription('');
                      setImageUrls([]);
                      setSelectedFiles([]);
                      setFormStep(1);
                    }}
                    className="w-full bg-accent text-background font-black py-4 rounded-2xl shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <List size={16} />
                    Track this issue
                  </button>
                  <button
                    onClick={() => {
                      setSubmittedIssue(null);
                      setDraftLocation(null);
                      setIssueType('Pothole');
                      setDescription('');
                      setImageUrls([]);
                      setSelectedFiles([]);
                      setFormStep(1);
                    }}
                    className="text-xs font-bold text-white/40 hover:text-accent transition-colors py-2"
                  >
                    Report another issue
                  </button>
                </div>
              </div>
            )}

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
        )}
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


      {/* Profile Sidebar Integrated */}
      <ProfileSidebar
        user={user}
        isOpen={isProfileOpen}
        displayName={displayName}
        setDisplayName={setDisplayName}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}
