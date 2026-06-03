'use client';

import { useEffect, useState } from 'react';
import { IconNavigate } from '@/components/icons';

/**
 * In-app map bottom sheet — keeps the traveller inside the app instead of
 * bouncing them to a separate browser tab.
 *
 * - With coordinates: an OpenStreetMap embed with a pin (keyless, reliable,
 *   designed for embedding).
 * - With only a place name (e.g. an airport): a Google Maps embed by query.
 *
 * A single "Get directions" / "Open in Google Maps" button is the one place we
 * intentionally hand off to a native maps app, because turn-by-turn belongs
 * there — and it's an explicit tap, not a surprise redirect.
 */
export function MapSheet({
  title,
  subtitle,
  lat,
  lng,
  query,
  onClose,
}: {
  title: string;
  subtitle?: string;
  lat?: number;
  lng?: number;
  query?: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const q = (query || title).trim();
  const d = 0.012; // ~1.3km bounding box for a close-but-contextual view

  const embedSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - d}%2C${lat! - d}%2C${lng! + d}%2C${lat! + d}&layer=mapnik&marker=${lat}%2C${lng}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;

  const externalHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const externalLabel = hasCoords ? 'Get directions' : 'Open in Google Maps';

  const openExternal = () => window.open(externalHref, '_blank', 'noopener,noreferrer');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Map: ${title}`}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-ink-3/40" />

        <div className="px-5 pb-3">
          <h2 className="text-base font-semibold text-ink leading-snug truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-ink-3 mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="relative bg-surface-2" style={{ height: '52vh' }}>
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-line-light" aria-hidden="true" />
          )}
          <iframe
            title={`Map of ${title}`}
            src={embedSrc}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setLoaded(true)}
          />
        </div>

        <div className="px-5 pt-4 space-y-2">
          <button
            type="button"
            onClick={openExternal}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-navy text-white text-sm font-semibold tap hover:bg-navy/90 transition-colors"
          >
            <IconNavigate size={16} />
            {externalLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
