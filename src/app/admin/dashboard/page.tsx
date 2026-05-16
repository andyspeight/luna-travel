'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, PauseCircle, Wrench, ChevronRight, ArrowUpRight } from 'lucide-react';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textAccent: '#0096B7',
  primary: '#1B2B5B',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel', tier: 'Ignite', status: 'live', travellers: 847, activeTrips: 124, lastSync: '2m ago', primary: '#0F4C5C', city: 'Brighton', joined: 'Feb 2026', deviceInstalls: 612, last30dActives: 489 },
  { id: 'agc_3p8m', name: 'Mercia Holidays', tier: 'Boost', status: 'live', travellers: 312, activeTrips: 47, lastSync: '14m ago', primary: '#1B2B5B', city: 'Worcester', joined: 'Mar 2026', deviceInstalls: 198, last30dActives: 156 },
  { id: 'agc_9w1q', name: 'Elite Bespoke', tier: 'Ignite', status: 'live', travellers: 1247, activeTrips: 203, lastSync: '47s ago', primary: '#0A0A0A', city: 'Mayfair', joined: 'Jan 2026', deviceInstalls: 1024, last30dActives: 891 },
  { id: 'agc_2v6r', name: 'Brackenwood Travel', tier: 'Boost', status: 'live', travellers: 234, activeTrips: 38, lastSync: '3m ago', primary: '#2D5016', city: 'Kendal', joined: 'Apr 2026', deviceInstalls: 142, last30dActives: 98 },
  { id: 'agc_5x4t', name: 'Halcyon Days Travel', tier: 'Spark', status: 'setup', travellers: 0, activeTrips: 0, lastSync: 'never', primary: '#1B2B5B', city: 'Cheltenham', joined: 'May 2026', deviceInstalls: 0, last30dActives: 0 },
  { id: 'agc_8h3y', name: 'Saltbreeze Travel', tier: 'Boost', status: 'paused', travellers: 178, activeTrips: 22, lastSync: '2d ago', primary: '#264653', city: 'St Ives', joined: 'Mar 2026', deviceInstalls: 89, last30dActives: 0 },
];

function StatusDot({ status }: { status: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textTertiary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
      {status === 'live' && (
        <span style={{
          position: 'absolute',
          display: 'inline-flex',
          height: '100%', width: '100%',
          borderRadius: '50%',
          opacity: 0.6,
          backgroundColor: colour,
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

export default function DashboardPage() {
  const totals = {
    agencies: AGENCIES.length,
    live: AGENCIES.filter(a => a.status === 'live').length,
    travellers: AGENCIES.reduce((s, a) => s + a.travellers, 0),
    activeTrips: AGENCIES.reduce((s, a) => s + a.activeTrips, 0),
    installs: AGENCIES.reduce((s, a) => s + a.deviceInstalls, 0),
    actives: AGENCIES.reduce((s, a) => s + a.last30dActives, 0),
  };
  const installRate = Math.round((totals.installs / totals.travellers) * 100);

  return (
    <>
      <style>{`
        @keyframes tg-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
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
              Overview
            </h1>
          </div>
          <StatusLabel status="live" label="Live · refreshed just now" />
        </div>

        {/* KPI strip */}
        <div style={{
          borderRadius: 12, marginBottom: 24,
          backgroundColor: C.bgElevated, border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'Active agencies', value: totals.live, sub: `of ${totals.agencies} total` },
              { label: 'Travellers', value: totals.travellers.toLocaleString(), sub: `${totals.actives.toLocaleString()} active in 30d` },
              { label: 'Active trips', value: totals.activeTrips, sub: 'in flight or in-resort' },
              { label: 'PWA installs', value: totals.installs.toLocaleString(), sub: `${installRate}% install rate` },
            ].map((m, i) => (
              <div key={i} style={{ padding: '20px 24px', borderLeft: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.value}</div>
                <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two columns: needs attention + sync health */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Needs attention</h2>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Agencies with issues in the last 24 hours</div>
            </div>
            <div>
              {[
                { agency: AGENCIES.find(a => a.id === 'agc_2v6r')!, Icon: AlertTriangle, fg: C.warning, bg: C.warningSoft, detail: '2 failed Travelify syncs · credentials may need refreshing' },
                { agency: AGENCIES.find(a => a.id === 'agc_8h3y')!, Icon: PauseCircle, fg: C.textSecondary, bg: C.bgTertiary, detail: 'Paused for 2 days · 178 travellers without access' },
                { agency: AGENCIES.find(a => a.id === 'agc_5x4t')!, Icon: Wrench, fg: C.info, bg: C.infoSoft, detail: 'In setup since 3 May · Travelify credentials not yet tested' },
              ].map((row, i) => (
                <Link key={i} href={`/admin/agencies/${row.agency.id}`} className="tg-row" style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 24px',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                  textDecoration: 'none',
                }}>
                  <div style={{
                    height: 36, width: 36, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, backgroundColor: row.bg,
                  }}>
                    <row.Icon style={{ height: 16, width: 16, color: row.fg }} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{row.agency.name}</div>
                    <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{row.detail}</div>
                  </div>
                  <ChevronRight style={{ height: 16, width: 16, color: C.textTertiary }} strokeWidth={1.75} />
                </Link>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Sync health</h2>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Last 24 hours</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.textTertiary }}>Successful</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>2,847</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: C.bgTertiary, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '97.2%', backgroundColor: C.success }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.textTertiary }}>Failed</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>82</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: C.bgTertiary, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '2.8%', backgroundColor: C.warning }} />
                </div>
              </div>
              <Link href="/admin/sync" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                height: 36, fontSize: 13, fontWeight: 500, color: C.textAccent, textDecoration: 'none',
              }}>
                Open sync monitor <ArrowUpRight style={{ height: 14, width: 14 }} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>

        {/* Agencies table */}
        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>All agencies</h2>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{AGENCIES.length} total</div>
            </div>
            <Link href="/admin/agencies" style={{
              fontSize: 13, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none',
            }}>Manage <ChevronRight style={{ height: 14, width: 14 }} strokeWidth={1.75} /></Link>
          </div>
          <div>
            {AGENCIES.slice(0, 5).map((a, i) => (
              <Link key={a.id} href={`/admin/agencies/${a.id}`} className="tg-row" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 24px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                textDecoration: 'none',
              }}>
                <Avatar name={a.name} bg={a.primary} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.name}</div>
                  <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{a.city} · joined {a.joined}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ textAlign: 'right', width: 80 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.travellers}</div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>travellers</div>
                  </div>
                  <div style={{ textAlign: 'right', width: 80 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.activeTrips}</div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>trips</div>
                  </div>
                  <div style={{ textAlign: 'right', width: 96 }}>
                    <div style={{ fontSize: 13, color: C.textSecondary }}>{a.lastSync}</div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>last sync</div>
                  </div>
                </div>
                <Pill tier={a.tier} />
                <StatusLabel status={a.status} label={a.status === 'live' ? 'Live' : a.status === 'paused' ? 'Paused' : a.status === 'setup' ? 'Setup' : 'Maintenance'} />
                <ChevronRight style={{ height: 16, width: 16, color: C.textTertiary }} strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
