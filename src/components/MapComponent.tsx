import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Filter, ChevronDown } from 'lucide-react';
import type { Issue, IssueStatus } from '../lib/supabase';
import { format } from 'date-fns';
import HeatmapLayer from './HeatmapLayer';

// Fix Leaflet icons issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const createIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div class="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-drop" style="background-color: ${color}">
            <div class="w-2 h-2 bg-white rounded-full opacity-60"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const icons = {
  pending: createIcon('#ef4444'),     // tailwind red-500
  in_progress: createIcon('#f59e0b'), // tailwind amber-500
  resolved: createIcon('#10b981')     // tailwind green-500
};

// Component to handle map clicks (Double-click or Long-press to report)
function MapEvents({ 
  onMapClick, 
  windowWidth, 
  setRipple 
}: { 
  onMapClick?: (lat: number, lng: number) => void, 
  windowWidth: number,
  setRipple: (pos: [number, number] | null) => void
}) {
  const map = useMap();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useMapEvents({
    mousedown(e: L.LeafletMouseEvent) {
      if (windowWidth < 640) { // Mobile
        longPressTimer.current = setTimeout(() => {
          if (onMapClick) {
            onMapClick(e.latlng.lat, e.latlng.lng);
            setRipple([e.latlng.lat, e.latlng.lng]);
            setTimeout(() => setRipple(null), 800);
          }
        }, 600);
      }
    },
    mouseup() {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    mousemove() {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    dblclick(e: L.LeafletMouseEvent) {
      if (windowWidth >= 640) { // Desktop
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
        }
        
        map.closePopup();
        if (onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      }
    },
    click() {
        // Single click does nothing as per requirements
    }
  });
  return null;
}

// Component to handle flying to location
function FlyToLocation({ center, zoom }: { center?: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 16, { duration: 1.5 });
    }
  }, [center, zoom, map]); return null;
}


interface MapComponentProps {
  issues: Issue[];
  onMapClick?: (lat: number, lng: number) => void;
  onLocateMe?: () => void;
  interactive?: boolean;
  selectedLocation?: [number, number] | null; // For centering map
  draftPin?: [number, number] | null; // During submission
  userLocation?: [number, number] | null; // Current user position
  currentUserId?: string;
  isAdmin?: boolean;
  showFilters?: boolean;
  compactFilters?: boolean;
  baseLayerUrl?: string;
  showHeatmap?: boolean;
}

// User Location Icon
const userLocationIcon = new L.DivIcon({
  className: 'user-location-marker',
  html: `<div class="pulse-ring"></div><div class="pulse-circle"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapComponent({ 
  issues, 
  onMapClick, 
  onLocateMe,
  interactive = true, 
  selectedLocation, 
  draftPin, 
  userLocation,
  currentUserId, 
  isAdmin,
  showFilters = true,
  compactFilters = false,
  baseLayerUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  showHeatmap = false
}: MapComponentProps) {
  const defaultCenter: [number, number] = [19.0760, 72.8777]; // Mumbai
  const [statusFilter, setStatusFilter] = useState<'all' | IssueStatus>('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [ripple, setRipple] = useState<[number, number] | null>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 640;
  const popupWidth = isMobile ? Math.floor(windowWidth * 0.85) : 320;

  const types = ['All', 'Garbage Disposal', 'Pothole', 'Street Light', 'Flooding', 'Graffiti', 'Other'];

  const filteredIssues = issues.filter(issue => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (typeFilter !== 'All' && issue.issue_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="relative w-full h-full z-0 bg-background pointer-events-auto">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        zoomControl={false}
        className="w-full h-full"
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={false} // Disabled as per requirements to allow pin drop on dblclick
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={baseLayerUrl}
          className="map-tiles"
        />

        {/* Heatmap Layer */}
        <HeatmapLayer issues={issues} visible={showHeatmap} />

        {/* Floating Filter Bar */}
        {showFilters && (
          <div 
            className={`absolute top-4 right-4 z-[9999] flex gap-2 ${compactFilters ? 'scale-90 origin-top-right' : ''}`}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`glass-card flex items-center ${compactFilters ? 'px-3 py-1.5 gap-2' : 'px-4 py-2 gap-3'} border border-white/10 shadow-2xl !bg-surface`}>
              <Filter size={compactFilters ? 12 : 14} className="text-accent" />
              
              <div className="flex gap-2">
                <div className="relative group z-[9999]">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className={`${compactFilters ? 'py-1 pl-2 pr-6 text-[10px]' : 'py-1.5 pl-3 pr-8 text-xs'} bg-surface hover:bg-surface/80 border border-white/10 rounded-lg font-bold text-white/80 appearance-none cursor-pointer focus:outline-none focus:border-accent transition-all uppercase tracking-wider font-mono`}
                  >
                    <option value="all" className="bg-surface text-white">{compactFilters ? 'Status' : 'Status: All'}</option>
                    <option value="pending" className="bg-surface text-white">Pending</option>
                    <option value="in_progress" className="bg-surface text-white">In Progress</option>
                    <option value="resolved" className="bg-surface text-white">Resolved</option>
                  </select>
                  <ChevronDown size={compactFilters ? 10 : 12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>

                <div className="relative group z-[9999]">
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={`${compactFilters ? 'py-1 pl-2 pr-6 text-[10px]' : 'py-1.5 pl-3 pr-8 text-xs'} bg-surface hover:bg-surface/80 border border-white/10 rounded-lg font-bold text-white/80 appearance-none cursor-pointer focus:outline-none focus:border-accent transition-all uppercase tracking-wider font-mono`}
                  >
                    {types.map(t => (
                      <option key={t} value={t} className="bg-surface text-white">
                        {t === 'All' ? (compactFilters ? 'Type' : 'Type: All') : t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={compactFilters ? 10 : 12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              { (statusFilter !== 'all' || typeFilter !== 'All') && (
                <button 
                  onClick={() => { setStatusFilter('all'); setTypeFilter('All'); }}
                  className={`${compactFilters ? 'text-[9px]' : 'text-[10px]'} font-bold text-accent hover:underline uppercase tracking-tight ml-1`}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Ripple Effect for Mobile Longpress */}
        {ripple && (
          <Marker 
            position={ripple} 
            icon={new L.DivIcon({
              className: 'ripple-effect',
              iconSize: [2, 2],
              iconAnchor: [1, 1]
            })} 
          />
        )}

        {/* Render MapEvents unconditionally to handle popup closing on tap */}
        <MapEvents 
          onMapClick={interactive ? onMapClick : undefined} 
          windowWidth={windowWidth}
          setRipple={setRipple}
        />
        {selectedLocation && (
          <FlyToLocation 
            center={selectedLocation} 
            zoom={userLocation && selectedLocation[0] === userLocation[0] && selectedLocation[1] === userLocation[1] ? 15 : 16} 
          />
        )}

        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup className="custom-popup" minWidth={popupWidth} maxWidth={popupWidth}>
              <div className="p-1 font-body text-sm font-bold text-accent">You are here</div>
            </Popup>
          </Marker>
        )}

        {draftPin && (
          <Marker position={draftPin} icon={icons.pending}>
            <Popup className="custom-popup" minWidth={popupWidth} maxWidth={popupWidth}>
              <div className="p-1 font-body text-sm font-bold">New Issue Location</div>
            </Popup>
          </Marker>
        )}

        {filteredIssues.map((issue) => (
          <Marker 
            key={issue.id} 
            position={[issue.lat, issue.lng]} 
            icon={icons[issue.status]}
          >
            <Popup className="custom-popup" minWidth={popupWidth} maxWidth={popupWidth}>
              <div className="p-1 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold text-white uppercase tracking-wider
                    ${issue.status === 'pending' ? 'bg-red-500' : 
                      issue.status === 'in_progress' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {issue.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-white/60 font-mono">
                    {format(new Date(issue.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                
                <h3 className="font-heading font-bold text-lg leading-tight">{issue.issue_type}</h3>
                
                <div className="text-[11px] font-mono font-bold text-white/50 mb-2 border-b border-white/10 pb-2 mt-1">
                  Reported by:{' '}
                  <span className="text-white/80">
                    {isAdmin 
                      ? issue.email 
                      : (currentUserId === issue.user_id ? 'You' : 'Anonymous Citizen')}
                  </span>
                  {isAdmin && <div className="text-[9px] font-normal mt-0.5 opacity-70">ID: {issue.user_id}</div>}
                </div>

                <p className="font-body text-sm text-white/80 leading-relaxed max-h-32 overflow-y-auto mb-2">
                  {issue.description}
                </p>
                {issue.image_urls && issue.image_urls.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Photo</span>
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-white/5 max-w-[200px]">
                      <img src={issue.image_urls[0]} alt="Issue" className="w-full h-auto" />
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <LocateMeControl 
          onLocateMe={onLocateMe}
          userLocation={userLocation}
        />
      </MapContainer>
    </div>
  );
}



function LocateMeControl({ onLocateMe, userLocation }: { onLocateMe?: () => void, userLocation?: [number, number] | null }) {
  const map = useMap();
  return (
    <div className="leaflet-bottom leaflet-right mb-6 mr-6">
      <div className="leaflet-control pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onLocateMe) {
              onLocateMe();
            } else if (userLocation) {
              map.flyTo(userLocation, 15, { duration: 1.5 });
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="locate-me-btn flex items-center justify-center"
          title="Locate Me"
        >
          <Navigation size={20} className="fill-current" />
        </button>
      </div>
    </div>
  );
}
