'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import { useI18n } from '@/lib/locale-context';
import {
  IconPlane,
  IconBed,
  IconPin,
  IconNavigate,
  IconExternal,
  IconChevR,
} from '@/components/icons';
import {
  boundsOf,
  makeProjection,
  arcPath,
  type LngLat,
} from '@/lib/geo';
import type { MapNode, TripMapModel } from '@/lib/trip-map';

interface LandData {
  polys: number[][][][]; // polygon -> ring -> point -> [lng,lat]
}

/** Palette per theme — kept here so the SVG reads correctly in light and dark. */
function palette(dark: boolean) {
  return dark
    ? {
        sea: '#0b1220',
        land: '#1e293b',
        landStroke: '#334155',
        graticule: 'rgba(148,163,184,0.10)',
        flight: '#5eead4',
        flightGlow: 'rgba(94,234,212,0.25)',
        transfer: '#64748b',
        airport: '#5eead4',
        hotel: '#38bdf8',
        pinText: '#0f172a',
        ring: 'rgba(94,234,212,0.35)',
      }
    : {
        sea: '#eef4f8',
        land: '#dbe6ef',
        landStroke: '#c6d6e3',
        graticule: 'rgba(100,116,139,0.12)',
        flight: '#0096b7',
        flightGlow: 'rgba(0,180,216,0.20)',
        transfer: '#94a3b8',
        airport: '#0096b7',
        hotel: '#0ea5e9',
        pinText: '#ffffff',
        ring: 'rgba(0,180,216,0.30)',
      };
}

export function TripMap({ model }: { model: TripMapModel }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const dark = theme === 'dark';
  const c = palette(dark);
  const [land, setLand] = useState<LandData | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);

  // Load the bundled basemap once. Cached by the PWA (static-data-assets),
  // so it works offline after first load. A failed fetch degrades gracefully
  // to routes + graticule with no land — the map still renders.
  useEffect(() => {
    let cancelled = false;
    fetch('/data/world-land.json', { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.polys)) setLand(d as LandData);
      })
      .catch(() => {
        /* graticule-only fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const proj = useMemo(() => {
    const bbox =
      boundsOf(model.points) ?? {
        minLng: -20,
        minLat: 20,
        maxLng: 80,
        maxLat: 60,
      };
    return makeProjection(bbox, 1000);
  }, [model.points]);

  const { width, height } = proj;

  // Graticule every 10° within the frame.
  const graticule = useMemo(() => {
    const lines: { d: string }[] = [];
    const step = 10;
    for (let lat = -80; lat <= 80; lat += step) {
      const a = proj.project(-180, lat);
      const b = proj.project(180, lat);
      lines.push({ d: `M ${-50} ${a.y.toFixed(1)} L ${width + 50} ${b.y.toFixed(1)}` });
    }
    for (let lng = -180; lng <= 180; lng += step) {
      const a = proj.project(lng, 85);
      const b = proj.project(lng, -85);
      lines.push({ d: `M ${a.x.toFixed(1)} ${-50} L ${b.x.toFixed(1)} ${height + 50}` });
    }
    return lines;
  }, [proj, width, height]);

  // Project land polygons, culling rings entirely outside the frame.
  const landPaths = useMemo(() => {
    if (!land) return [];
    const paths: string[] = [];
    for (const poly of land.polys) {
      for (const ring of poly) {
        // Quick cull: skip rings whose every vertex is far outside the frame.
        let anyIn = false;
        for (const [lng, lat] of ring) {
          if (proj.inFrame(lng, lat)) {
            anyIn = true;
            break;
          }
        }
        if (!anyIn) continue;
        let d = '';
        for (let i = 0; i < ring.length; i++) {
          const [lng, lat] = ring[i];
          const p = proj.project(lng, lat);
          d += `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        }
        d += 'Z';
        paths.push(d);
      }
    }
    return paths;
  }, [land, proj]);

  return (
    <div className="relative">
      <div
        className="rounded-3xl overflow-hidden border border-line-light shadow-sm"
        style={{ background: c.sea }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Map of your trip: ${model.airportCount} airport${
            model.airportCount === 1 ? '' : 's'
          } and ${model.hotelCount} hotel${model.hotelCount === 1 ? '' : 's'}.`}
          style={{ display: 'block' }}
        >
          {/* Graticule */}
          <g>
            {graticule.map((g, i) => (
              <path key={i} d={g.d} stroke={c.graticule} strokeWidth={1} fill="none" />
            ))}
          </g>

          {/* Land */}
          <g>
            {landPaths.map((d, i) => (
              <path key={i} d={d} fill={c.land} stroke={c.landStroke} strokeWidth={0.75} />
            ))}
          </g>

          {/* Transfer legs (ground) — dashed */}
          <g>
            {model.legs
              .filter((l) => l.kind === 'transfer')
              .map((l) => {
                const a = proj.project(l.from.lng, l.from.lat);
                const b = proj.project(l.to.lng, l.to.lat);
                return (
                  <path
                    key={l.id}
                    d={`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                    stroke={c.transfer}
                    strokeWidth={2}
                    strokeDasharray="4 5"
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
          </g>

          {/* Flight legs — bowed arcs with a soft glow */}
          <g>
            {model.legs
              .filter((l) => l.kind === 'flight')
              .map((l) => {
                const a = proj.project(l.from.lng, l.from.lat);
                const b = proj.project(l.to.lng, l.to.lat);
                const d = arcPath(a, b, 0.16);
                return (
                  <g key={l.id}>
                    <path d={d} stroke={c.flightGlow} strokeWidth={7} fill="none" strokeLinecap="round" />
                    <path d={d} stroke={c.flight} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                  </g>
                );
              })}
          </g>

          {/* Pins */}
          <g>
            {model.nodes.map((n) => {
              const p = proj.project(n.lng, n.lat);
              const isSel = selected?.id === n.id;
              const fill = n.kind === 'hotel' ? c.hotel : c.airport;
              const r = 13;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Stop ${n.order}: ${n.title}`}
                  onClick={() => setSelected(isSel ? null : n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(isSel ? null : n);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {/* Larger transparent hit area for touch */}
                  <circle r={20} fill="transparent" />
                  {isSel && <circle r={r + 6} fill="none" stroke={c.ring} strokeWidth={6} />}
                  <circle r={r} fill={fill} stroke={dark ? '#0b1220' : '#ffffff'} strokeWidth={2.5} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    fontWeight={700}
                    fill={c.pinText}
                    style={{ pointerEvents: 'none' }}
                  >
                    {n.order}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.airport }} />
          {t('map.airport')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.hotel }} />
          {t('map.hotel')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 border-t-2" style={{ borderColor: c.flight }} />
          {t('map.flight')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-5 border-t-2 border-dashed"
            style={{ borderColor: c.transfer }}
          />
          {t('map.transfer')}
        </span>
        <span className="ml-auto text-ink-3">{t('map.tapHint')}</span>
      </div>

      {/* Detail sheet */}
      {selected && (
        <MapSheet node={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function directionsHref({ lng, lat }: LngLat): string {
  // Opens the device's default maps app at the point — no embedded routing,
  // no device-location request (geolocation is disabled at the header level).
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function MapSheet({ node, onClose }: { node: MapNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 glass border-t border-line rounded-t-3xl p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        role="dialog"
        aria-label={node.title}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-start gap-3">
          <span
            className="w-11 h-11 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{
              background:
                node.kind === 'hotel'
                  ? 'linear-gradient(135deg, #0EA5E9, #0369A1)'
                  : 'linear-gradient(135deg, #1B2B5B, #00B4D8)',
            }}
          >
            {node.kind === 'hotel' ? (
              <IconBed size={20} />
            ) : node.kind === 'airport' ? (
              <IconPlane size={20} />
            ) : (
              <IconPin size={20} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
              {t('map.stop')} {node.order}
              {node.code ? ` · ${node.code}` : ''}
            </div>
            <div className="text-[16px] font-semibold text-ink leading-snug">{node.title}</div>
            {node.subtitle && <div className="text-xs text-ink-2 mt-0.5">{node.subtitle}</div>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <a
            href={directionsHref(node)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[48px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 bg-navy text-white dark:bg-teal dark:text-navy-dark"
          >
            <IconNavigate size={18} />
            <span>{t('map.getDirections')}</span>
            <IconExternal size={15} />
          </a>
          {node.href && (
            <Link
              href={node.href}
              className="w-full h-[48px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 bg-surface text-ink border border-line"
            >
              <span>{t('map.viewDetails')}</span>
              <IconChevR size={16} />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
