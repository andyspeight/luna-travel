'use client';

import React, { useState, useMemo } from 'react';
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

const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel', tier: 'Ignite', status: 'live', travellers: 847, activeTrips: 124, lastSync: '2m ago', primary: '#0F4C5C', contact: 'sophie@coastandcrown.co.uk', city: 'Brighton', joined: 'Feb 2026', deviceInstalls: 612 },
  { id: 'agc_3p8m', name: 'Mercia Holidays', tier: 'Boost', status: 'live', travellers: 312, activeTrips: 47, lastSync: '14m ago', primary: '#1B2B5B', contact: 'bookings@merciaholidays.com', city: 'Worcester', joined: 'Mar 2026', deviceInstalls: 198 },
  { id: 'agc_9w1q', name: 'Elite Bespoke', tier: 'Ignite', status: 'live', travellers: 1247, activeTrips: 203, lastSync: '47s ago', primary: '#0A0A0A', contact: 'concierge@elitebespoke.travel', city: 'Mayfair', joined: 'Jan 2026', deviceInstalls: 1024 },
  { id: 'agc_2v6r', name: 'Brackenwood Travel', tier: 'Boost', status: 'live', travellers: 234, activeTrips: 38, lastSync: '3m ago', primary: '#2D5016', contact: 'hello@brackenwoodtravel.co.uk', city: 'Kendal', joined: 'Apr 2026', deviceInstalls: 142 },
  { id: 'agc_5x4t', name: 'Halcyon Days Travel', tier: 'Spark', status: 'setup', travellers: 0, activeTrips: 0, lastSync: 'never', primary: '#1B2B5B', contact: 'mike@halcyondaystravel.co.uk', city: 'Cheltenham', joined: 'May 2026', deviceInstalls: 0 },
  { id: 'agc_8h3y', name: 'Saltbreeze Travel', tier: 'Boost', status: 'paused', travellers: 178, activeTrips: 22, lastSync: '2d ago', primary: '#264653', contact: 'rachel@saltbreeze.travel', city: 'St Ives', joined: 'Mar 2026', deviceInstalls: 89 },
  { id: 'agc_4n7c', name: 'Northstar Journeys', tier: 'Ignite', status: 'live', travellers: 567, activeTrips: 88, lastSync: '1m ago', primary: '#1A1A2E', contact: 'team@northstar.travel', city: 'Edinburgh', joined: 'Feb 2026', deviceInstalls: 412 },
];

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

export default function AgenciesListPage() {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | 'Spark' | 'Boost' | 'Ignite'>('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const filtered = useMemo(() => AGENCIES.filter(a =>
    (tier === 'all' || a.tier === tier) &&
    (query === '' || a.name.toLowerCase().includes(query.toLowerCase()) || a.city.toLowerCase().includes(query.toLowerCase()))
  ), [query, tier]);

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
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 16px', height: 40, borderRadius: 8,
              backgroundColor: C.primary, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.primaryLight}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = C.primary}
          >
            <Sparkles style={{ height: 16, width: 16 }} strokeWidth={1.75} />
            New agency
          </button>
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
                placeholder="Search by name or city..."
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
            }}>{filtered.length} results</div>
          </div>

          {/* Rows */}
          <div>
            {filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>No agencies match your filter</div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>Try clearing your search or changing the tier filter.</div>
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
                  <Avatar name={a.name} bg={a.primary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.name}</span>
                      <Pill tier={a.tier} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                      <span>{a.city}</span>
                      <span>·</span>
                      <span>{a.contact}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.travellers.toLocaleString()}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>travellers</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.activeTrips}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>trips</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.deviceInstalls.toLocaleString()}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>installs</div>
                    </div>
                    <div style={{ textAlign: 'right', width: 80 }}>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{a.lastSync}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>last sync</div>
                    </div>
                  </div>
                  <StatusLabel
                    status={a.status}
                    label={a.status === 'live' ? 'Live' : a.status === 'paused' ? 'Paused' : a.status === 'setup' ? 'Setup' : 'Maintenance'}
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
