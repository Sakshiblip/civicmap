import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Issue } from '../lib/supabase';
import { format } from 'date-fns';

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
    html: `<div class="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="background:${color};animation-name:drop">
             <div class="w-2 h-2 bg-white rounded-full opacity-60"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const icons = {
  pending: createIcon('#ef4444'),
  in_progress: createIcon('#f59e0b'),
  resolved: createIcon('#10b981')
};

// User location icon
const userLocationIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.25)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Component to handle map clicks
function MapEvents({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
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

// Locate Me button component
function LocateMe({ userLocation }: { userLocation: [number, number] | null }) {
  const map = useMap();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '12px',
        zIndex: 1000,
        background: '#1a1f2e',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        color: '#00d4aa',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
      }}
      onClick={() => {
        if (userLocation) {
          map.flyTo(userLocation, 15, { duration: 1.5 });
        } else {
          alert('Location access denied or unavailable.');
        }
      }}
    >
      ◎ Locate Me
    </div>
  );
}

interface MapComponentProps {
  issues: Issue[];
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
  selectedLocation?: [number, number] | null;
  draftPin?: [number, number] | null;
  currentUserId?: string;
  isAdmin?: boolean;
}

export default function MapComponent({ issues, onMapClick, interactive = true, selectedLocation, draftPin,
  currentUserId, isAdmin }: MapComponentProps) {

  const defaultCenter: [number, number] = [19.0760, 72.8777]; // Mumbai
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => console.log('Location access denied — defaulting to Mumbai')
      );
    }
  }, []);

  return (
    <div className="absolute inset-0 z-0 bg-background pointer-events-auto">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        zoomControl={false}
        className="w-full h-full"
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        {interactive && onMapClick && <MapEvents onMapClick={onMapClick} />}
        {selectedLocation && <FlyToLocation center={selectedLocation} />}
        <LocateMe userLocation={userLocation} />

        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup className="custom-popup">
              <div className="p-1 font-body text-sm font-bold text-black">You are here</div>
            </Popup>
          </Marker>
        )}

        {draftPin && (
          <Marker position={draftPin} icon={icons.pending}>
            <Popup className="custom-popup">
              <div className="p-1 font-body text-sm font-bold">New Issue Location</div>
            </Popup>
          </Marker>
        )}

        {issues.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.lat, issue.lng]}
            icon={icons[issue.status]}
          >
            <Popup className="custom-popup min-w-[200px]">
              <div className="p-1 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold text-white uppercase tracking-wide
                    ${issue.status === 'pending' ? 'bg-red-500' :
                      issue.status === 'in_progress' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {issue.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-white/60 font-mono">
                    {format(new Date(issue.created_at), 'MMM d, yyyy')}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-lg leading-tight">{issue.issue_type}</h3>

                <div className="text-[11px] font-mono font-bold text-white/50 mb-2 border-b border-white/16 mb-2 mt-1">
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
                  <div className="w-full h-24 rounded-lg overflow-hidden bg-white/10 mt-2">
                    <img src={issue.image_urls[0]} alt="Issue" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}