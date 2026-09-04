'use client';

/**
 * Pan/zoom street map for "Find your way around" — Leaflet over
 * OpenStreetMap tiles (no API key). Loaded client-side only: Leaflet touches
 * window at import time, so the module is dynamically imported inside an
 * effect. Markers are teal SVG pins via divIcon — no image assets, so no
 * bundler icon-path problems.
 *
 * `focusId` lets the surrounding page fly the map to a place when its list
 * card is tapped.
 */

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import type { PlaceItem } from '@/lib/trip-content';
import 'leaflet/dist/leaflet.css';

const PIN_HTML = `
<svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0Z" fill="#0F766E"/>
  <circle cx="15" cy="14.5" r="5.5" fill="white"/>
</svg>`;

export function PlacesMap({ places, focusId }: { places: PlaceItem[]; focusId?: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !holder.current) return;

      // Rebuild from scratch when the place list changes — cheap at this scale.
      mapRef.current?.remove();
      markersRef.current = {};

      const map = L.map(holder.current, { scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: PIN_HTML,
        iconSize: [30, 40],
        iconAnchor: [15, 38],
        popupAnchor: [0, -34],
      });

      const bounds = L.latLngBounds([]);
      for (const p of places) {
        const m = L.marker([p.lat, p.lng], { icon, title: p.name })
          .addTo(map)
          .bindPopup(
            `<strong style="font-size:13px">${escapeHtml(p.name)}</strong>`,
            { closeButton: false },
          );
        markersRef.current[p.id] = m;
        bounds.extend([p.lat, p.lng]);
      }

      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], 14);
      } else if (places.length > 1) {
        map.fitBounds(bounds.pad(0.18));
      } else {
        map.setView([20, 0], 2);
      }

      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [places]);

  useEffect(() => {
    if (!focusId) return;
    const map = mapRef.current;
    const marker = markersRef.current[focusId];
    if (map && marker) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
      marker.openPopup();
    }
  }, [focusId]);

  return (
    <div
      ref={holder}
      className="w-full h-[320px] rounded-2xl overflow-hidden border border-line-light relative z-0"
      aria-label="Map of places"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
