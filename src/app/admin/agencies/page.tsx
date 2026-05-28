'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, Sparkles, ChevronRight } from 'lucide-react';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
  primaryLight: '#2A3F7A',
  accent: '#00B4D8',
  success: '#10B981',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

// Agency shape returned by /api/admin/agencies (sourced from Control).
// Stats (travellers/activeTrips/deviceInstalls/lastSync) are Luna-Travel-derived
// and may be null until that data layer is wired — render '—' when null.
interface Agency {
  id: string;
  name: string;
  legalName: string;
  tier: string;
  status: string;
  contact: string;
  contactName: string;
  website: string;
  travelifyAppId: string;
  travelifySiteId: string;
  travellers: number | null;
  activeTrips: number | null;
  deviceInstalls: number | null;
  lastSync: string | null;
}

// Deterministic brand colour per agency for the avatar (no Control field yet).
const AVATAR_COLOURS = ['#0F4C5C', '#1B2B5B', '#0A0A0A', '#2D5016', '#264653', '#1A1A2E', '#3B2F5B'];
function avatarColour(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

function StatusDot({ status }: { status: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textTertiary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
      {status === 'live' && (
        <span style={{
          position: 'absolute', display: 'inline-flex', height: '100%', width: '100%',
          borderRadius: '50%', opacity: 0.6, backgroundColor: colour,
          animation: 'tg-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
      <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: '50%', backgroundColor: colour }} />
    </span>
  );
}

function StatusLabel({ status, label }: { status: string; label: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textSecondary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: colour }}>
      <StatusDot status={status} />{label}
    </span>
  );
}

function Pill({ tier }: { tier: string }) {
  const style = tier === 'Ignite'
    ? { bg: C.warningSoft, fg: C.warning }
    : tier === 'Boost'
    ? { bg: C.infoSoft, fg: C.info }
    : { bg: C.bgTertiary, fg: C.textSecondary };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
      backgroundColor: style.bg, color: style.fg,
    }}>{tier}</span>
  );
}

function Avatar({ name, bg }: { name: string; bg: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      height: 36, width: 36, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 13, fontWeight: 600,
      flexShrink: 0, backgroundColor: bg,
    }}>{initials}</div>
  );
}

function statDisplay(v: number | null): string {
  return v === null || v === undefined ? '—' : v.toLocaleString();
}

export default function AgenciesListPage() {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | 'Spark' | 'Boost' | 'Ignite'>('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/agencies', { credentials: 'include', cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          setError('Your session has expired. Please sign in again.');
          return;
        }
        if (!res.ok) {
          setError('Could not load agencies from Control. Please try again.');
          return;
        }
        const data = await res.json();
        if (!cancelled) setAgencies(Array.isArray(data.agencies) ? data.agencies : []);
      } catch {
        if (!cancelled) setError('Could not reach the server. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => agencies.filter(a =>
    (tier === 'all' || a.tier === tier) &&
    (query === '' || a.name.toLowerCase().includes(query.toLowerCase()) || (a.contact || '').toLowerCase().includes(query.toLowerCase()))
  ), [agencies, query, tier]);

  return (
    <>
      <style>{`
        @keyframes tg-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .tg-row { transition: background-color 150ms; }
        .tg-row:hover { background-color: ${C.bg} !important; }
      `}</style>
      <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
              Travelgenix admin
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
              Agencies
            </h1>
          </div>
          <Link
            href="/admin/agencies/new"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 16px', height: 40, borderRadius: 8,
              backgroundColor: C.primary, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.primaryLight}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = C.primary}
          >
            <Sparkles style={{ height: 16, width: 16 }} strokeWidth={1.75} />
            New agency
          </Link>
        </div>

        {/* Filters bar */}
        <div style={{
          borderRadius: 12,
          backgroundColor: C.bgElevated,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: `1px solid ${C.border}`,
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                height: 16, width: 16, color: C.textTertiary, pointerEvents: 'none',
              }} strokeWidth={1.75} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search by name or contact..."
                style={{
                  width: '100%', height: 36,
                  paddingLeft: 36, paddingRight: 12,
                  borderRadius: 8,
                  border: `1px solid ${searchFocused ? C.accent : C.border}`,
                  backgroundColor: C.bgElevated, color: C.text,
                  fontSize: 14, lineHeight: 1.5,
                  outline: 'none',
                  boxShadow: searchFocused ? '0 0 0 3px rgba(0, 180, 216, 0.15)' : 'none',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
              />
            </div>

            {/* Tier filter — segmented */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: 2, borderRadius: 8, backgroundColor: C.bgTertiary,
            }}>
              {(['all', 'Spark', 'Boost', 'Ignite'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  style={{
                    padding: '0 12px', height: 28, borderRadius: 6, border: 'none',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: tier === t ? C.bgElevated : 'transparent',
                    color: tier === t ? C.text : C.textSecondary,
                    boxShadow: tier === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                >{t === 'all' ? 'All' : t}</button>
              ))}
            </div>

            <div style={{
              marginLeft: 'auto', fontSize: 13, color: C.textTertiary,
              fontVariantNumeric: 'tabular-nums',
            }}>{loading ? 'Loading…' : `${filtered.length} results`}</div>
          </div>

          {/* Rows */}
          <div>
            {loading ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>Loading agencies…</div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>Reading from Control.</div>
              </div>
            ) : error ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>Couldn&apos;t load agencies</div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>{error}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  {agencies.length === 0 ? 'No agencies have Luna Travel yet' : 'No agencies match your filter'}
                </div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>
                  {agencies.length === 0
                    ? 'Enable Luna Travel for a client in Control and they will appear here.'
                    : 'Try clearing your search or changing the tier filter.'}
                </div>
              </div>
            ) : (
              filtered.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/admin/agencies/${a.id}`}
                  className="tg-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 24px',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    textDecoration: 'none',
                  }}
                >
                  <Avatar name={a.name} bg={avatarColour(a.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.name}</span>
                      {a.tier ? <Pill tier={a.tier} /> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                      <span>{a.contact || a.legalName}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{statDisplay(a.travellers)}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>travellers</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{statDisplay(a.activeTrips)}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>trips</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{statDisplay(a.deviceInstalls)}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>installs</div>
                    </div>
                    <div style={{ textAlign: 'right', width: 80 }}>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{a.lastSync || '—'}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>last sync</div>
                    </div>
                  </div>
                  <StatusLabel
                    status={a.status}
                    label={a.status === 'live' ? 'Live' : a.status === 'paused' ? 'Paused' : a.status === 'setup' ? 'Setup' : a.status === 'active' ? 'Active' : 'Maintenance'}
                  />
                  <ChevronRight style={{ height: 16, width: 16, color: C.textTertiary }} strokeWidth={1.75} />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
