import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { Issue } from '../lib/supabase';

interface HeatmapLayerProps {
  issues: Issue[];
  visible?: boolean;
}

const HEATMAP_CONFIG = {
  radius: 60,
  blur: 45,
  minOpacity: 0.5,
  max: 0.8,
  maxZoom: 18,
  gradient: {
    0.4: '#00bcd4',  // Teal/Cyan
    0.65: '#00e676', // Green
    1: '#ff5722'    // Deep Orange
  }
};

export default function HeatmapLayer({ issues, visible = false }: HeatmapLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  // Initialize and update points
  useEffect(() => {
    if (!map) return;

    // Create layer if it doesn't exist
    if (!heatLayerRef.current) {
        heatLayerRef.current = (L as any).heatLayer([], HEATMAP_CONFIG);
    }

    const points: Array<[number, number, number]> = issues.map(issue => {
        // Simple weight calculation
        let weight = 0.5;
        if (issue.status === 'pending') weight = 0.8;
        if (issue.status === 'in_progress') weight = 0.6;
        return [issue.lat, issue.lng, weight];
    });

    // Update the points
    heatLayerRef.current.setLatLngs(points);

    // Manage addition/removal from map
    if (visible) {
        if (!map.hasLayer(heatLayerRef.current)) {
            heatLayerRef.current.addTo(map);
        }
    } else {
        if (map.hasLayer(heatLayerRef.current)) {
            map.removeLayer(heatLayerRef.current);
        }
    }

  }, [issues, map, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map]);

  return null;
}
