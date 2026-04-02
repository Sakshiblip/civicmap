import { useState } from 'react';
import { Layers, ChevronDown, SlidersHorizontal, Flame, Check } from 'lucide-react';

interface LayerControlPanelProps {
  overlays: {
    heatmap: boolean;
  };
  onOverlayToggle: (key: keyof LayerControlPanelProps['overlays']) => void;
  opacities: {
    heatmap: number;
  };
  onOpacityChange: (key: keyof LayerControlPanelProps['opacities'], val: number) => void;
}

export default function LayerControlPanel({ 
  overlays, onOverlayToggle,
  opacities, onOpacityChange
}: LayerControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-[3000] flex flex-col items-end pointer-events-auto">
      {/* Expanded Menu */}
      <div className={`mb-3 glass-card border border-white/10 shadow-2xl bg-surface/90 backdrop-blur-2xl rounded-3xl overflow-hidden transition-all duration-500 ease-out origin-bottom-right ${
          isExpanded ? 'scale-100 opacity-100 max-h-[300px] w-64 p-5' : 'scale-75 opacity-0 max-h-0 w-0 p-0'
      }`}>
         <div className="space-y-6">
            {/* Active Base Layer (Static) */}
            <div className="space-y-2">
               <div className="flex items-center gap-2 text-[10px] font-black text-white/40 tracking-[0.2em] uppercase px-1">
                  <Layers size={12} className="text-accent" />
                  Base Layer
               </div>
               <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                    <img src="https://a.tile.openstreetmap.org/13/4193/2747.png" alt="OSM" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">Default Map</span>
               </div>
            </div>

            {/* Overlays */}
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-[10px] font-black text-white/40 tracking-[0.2em] uppercase px-1">
                  <SlidersHorizontal size={12} className="text-accent" />
                  Overlay Stack
               </div>
               
               {/* Heatmap Toggle */}
               <div className="space-y-2">
                  <button 
                    onClick={() => onOverlayToggle('heatmap')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${
                       overlays.heatmap ? 'bg-accent/10 border border-accent/20' : 'bg-white/5 border border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                     <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg bg-surface flex items-center justify-center border border-white/5`}>
                           <Flame size={14} className={overlays.heatmap ? 'text-accent' : 'text-white/30'} />
                        </div>
                        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Density Map</span>
                     </div>
                     <div className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                        overlays.heatmap ? 'bg-accent border-accent text-background scale-110 shadow-lg shadow-accent/20' : 'border-white/20'
                     }`}>
                        {overlays.heatmap && <Check size={12} strokeWidth={4} />}
                     </div>
                  </button>
                  
                  {overlays.heatmap && (
                    <div className="px-2 pb-1 animate-in slide-in-from-top-1 duration-200">
                       <input 
                         type="range" min="0" max="1" step="0.01" 
                         value={opacities.heatmap}
                         onChange={(e) => onOpacityChange('heatmap', parseFloat(e.target.value))}
                         className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent"
                       />
                    </div>
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* Main Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-2 active:scale-95 group ${
          isExpanded 
            ? 'bg-white border-white text-background rotate-180 scale-110' 
            : 'bg-surface border-white/10 text-white hover:border-accent hover:glow-accent'
        }`}
      >
        {isExpanded ? <ChevronDown size={24} /> : <Layers size={24} className="group-hover:scale-110 transition-transform duration-300" />}
      </button>
    </div>
  );
}
