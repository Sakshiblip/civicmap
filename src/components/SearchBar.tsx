import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MapPin, Navigation2, Loader2 } from 'lucide-react';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    amenity?: string;
    road?: string;
    locality?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface SearchBarProps {
  onSelect: (lat: number, lon: number, name: string) => void;
  userLocation?: [number, number] | null;
}

export default function SearchBar({ onSelect, userLocation }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeout = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Search restricted to Mumbai area (approx bounding box)
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=6&viewbox=72.77,18.89,73.0,19.3&bounded=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      const data = await response.json();
      setResults(data);
      setIsOpen(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchResults(val), 300);
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleNearMe = () => {
    if (userLocation) {
        onSelect(userLocation[0], userLocation[1], 'Current Location');
    } else {
        alert('Location access is required.');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="fixed top-[88px] md:top-16 left-0 md:left-1/2 md:-translate-x-1/2 z-[3000] w-full md:max-w-md">
      <div className="relative group px-0 md:px-0">
        <div className="flex bg-gray-900 md:bg-surface/80 backdrop-blur-xl border-b md:border border-white/5 md:border-white/10 md:rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-accent/30 transition-all duration-300">
          <div className="flex items-center pl-4 text-white/40">
            {isLoading ? <Loader2 size={18} className="animate-spin text-accent" /> : <Search size={18} />}
          </div>
          
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 3 && setIsOpen(true)}
            placeholder="Search NagarSeva locations..."
            className="flex-1 bg-transparent border-none py-3.5 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none font-body"
          />
          
          {query && (
            <button 
              onClick={() => { setQuery(''); setResults([]); }}
              className="p-3.5 text-white/30 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}

          <div className="w-[1px] h-6 bg-white/10 my-auto" />

          <button
            onClick={handleNearMe}
            className="p-3.5 text-accent hover:bg-accent/10 transition-all flex items-center gap-2 group/btn"
            title="Near me"
          >
            <Navigation2 size={16} className="group-hover/btn:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Near me</span>
          </button>
        </div>

        {/* Results Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-0 md:mt-2 w-full glass shadow-2xl md:rounded-2xl overflow-hidden border-b border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
            {results.map((result, idx) => (
              <button
                key={result.place_id}
                onClick={() => handleSelect(result)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-none ${
                    selectedIndex === idx ? 'bg-white/5' : ''
                }`}
              >
                <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 mt-0.5">
                  <MapPin size={14} className="text-accent" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {result.address.locality || result.address.amenity || result.address.road || 'Unknown Locality'}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5 font-medium">
                    {result.address.district || result.address.city}, {result.address.state}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
