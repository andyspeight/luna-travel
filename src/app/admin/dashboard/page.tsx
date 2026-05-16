'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  PauseCircle,
  Wrench,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';

// Mock data — will be replaced with real Airtable data in Phase 2
const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel', tier: 'Ignite', status: 'live',    travellers: 847,  activeTrips: 124, lastSync: '2m ago',  primary: '#0F4C5C', contact: 'sophie@coastandcrown.co.uk', city: 'Brighton',   joined: 'Feb 2026', deviceInstalls: 612,  last30dActives: 489 },
  { id: 'agc_3p8m', name: 'Mercia Holidays',      tier: 'Boost',  status: 'live',    travellers: 312,  activeTrips: 47,  lastSync: '14m ago', primary: '#1B2B5B', contact: 'bookings@merciaholidays.com', city: 'Worcester',  joined: 'Mar 2026', deviceInstalls: 198,  last30dActives: 156 },
  { id: 'agc_9w1q', name: 'Elite Bespoke',        tier: 'Ignite', status: 'live',    travellers: 1247, activeTrips: 203, lastSync: '47s ago', primary: '#0A0A0A', contact: 'concierge@elitebespoke.travel', city: 'Mayfair', joined: 'Jan 2026', deviceInstalls: 1024, last30dActives: 891 },
  { id: 'agc_2v6r', name: 'Brackenwood Travel',   tier: 'Boost',  status: 'live',    travellers: 234,  activeTrips: 38,  lastSync: '3m ago',  primary: '#2D5016', contact: 'hello@brackenwoodtravel.co.uk', city: 'Kendal',  joined: 'Apr 2026', deviceInstalls: 142,  last30dActives: 98 },
  { id: 'agc_5x4t', name: 'Halcyon Days Travel',  tier: 'Spark',  status: 'setup',   travellers: 0,    activeTrips: 0,   lastSync: 'never',   primary: '#1B2B5B', contact: 'mike@halcyondaystravel.co.uk', city: 'Cheltenham', joined: 'May 2026', deviceInstalls: 0, last30dActives: 0 },
  { id: 'agc_8h3y', name: 'Saltbreeze Travel',    tier: 'Boost',  status: 'paused',  travellers: 178,  activeTrips: 22,  lastSync: '2d ago',  primary: '#264653', contact: 'rachel@saltbreeze.travel',     city: 'St Ives',    joined: 'Mar 2026', deviceInstalls: 89,  last30dActives: 0 },
  { id: 'agc_4n7c', name: 'Northstar Journeys',   tier: 'Ignite', status: 'live',    travellers: 567,  activeTrips: 88,  lastSync: '1m ago',  primary: '#1A1A2E', contact: 'team@northstar.travel',        city: 'Edinburgh',  joined: 'Feb 2026', deviceInstalls: 412, last30dActives: 367 },
];

function cx(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(' ');
}

// Inline component helpers using token CSS variables.
// Will be replaced with imports from @travelgenix/ui once we've
// validated the layout works end-to-end on a real route.

const StatusDot = ({ status, pulse = true }: { status: string; pulse?: boolean }) => {
  const bg = {
    live: 'var(--tg-success)',
    paused: 'var(--tg-text-tertiary)',
    maintenance: 'var(--tg-warning)',
    setup: 'var(--tg-info)',
  }[status] || 'var(--tg-text-tertiary)';

  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && status === 'live' && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping motion-reduce:hidden"
          style={{ backgroundColor: bg }}
          aria-hidden
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: bg }}
      />
    </span>
  );
};

const StatusLabel = ({ status, label, pulse = true }: { status: string; label: string; pulse?: boolean }) => {
  const color = {
    live: 'var(--tg-success)',
    paused: 'var(--tg-text-secondary)',
    maintenance: 'var(--tg-warning)',
    setup: 'var(--tg-info)',
  }[status] || 'var(--tg-text-secondary)';

  return (
    <span
      className="inline-flex items-center gap-2 font-medium"
      style={{ fontSize: 13, color }}
    >
      <StatusDot status={status} pulse={pulse} />
      {label}
    </span>
  );
};

const Pill = ({ variant, children }: { variant: string; children: React.ReactNode }) => {
  const styles = {
    Ignite: { bg: 'var(--tg-warning-soft)', text: 'var(--tg-warning)' },
    Boost:  { bg: 'var(--tg-info-soft)', text: 'var(--tg-info)' },
    Spark:  { bg: 'var(--tg-bg-tertiary)', text: 'var(--tg-text-secondary)' },
  }[variant] || { bg: 'var(--tg-bg-tertiary)', text: 'var(--tg-text-secondary)' };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-semibold uppercase"
      style={{
        fontSize: 11,
        lineHeight: 1.4,
        letterSpacing: '0.04em',
        backgroundColor: styles.bg,
        color: styles.text,
      }}
    >
      {children}
    </span>
  );
};

const Avatar = ({ name, bg }: { name: string; bg: string }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="h-9 w-9 rounded-md flex items-center justify-center text-white font-semibold shrink-0"
      style={{ backgroundColor: bg, fontSize: 13 }}
      aria-label={name}
    >
      {initials}
    </div>
  );
};

export default function DashboardPage() {
  const totals = useMemo(() => ({
    agencies: AGENCIES.length,
    live: AGENCIES.filter(a => a.status === 'live').length,
    travellers: AGENCIES.reduce((s, a) => s + a.travellers, 0),
    activeTrips: AGENCIES.reduce((s, a) => s + a.activeTrips, 0),
    installs: AGENCIES.reduce((s, a) => s + a.deviceInstalls, 0),
    actives: AGENCIES.reduce((s, a) => s + a.last30dActives, 0),
  }), []);

  const installRate = Math.round((totals.installs / totals.travellers) * 100);

  return (
    <div className="px-8 py-8" style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div
            style={{ fontSize: 11, letterSpacing: '0.06em' }}
            className="uppercase mb-1"
          >
            <span style={{ color: 'var(--tg-text-tertiary)' }}>Travelgenix admin</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: 'var(--tg-text-primary)' }}>
            Overview
          </h1>
        </div>
        <StatusLabel status="live" label="Live · refreshed just now" />
      </div>

      {/* KPI strip */}
      <div
        className="rounded-xl mb-6 overflow-hidden"
        style={{ backgroundColor: 'var(--tg-bg-primary)', border: '1px solid var(--tg-border)' }}
      >
        <div className="grid grid-cols-4">
          {[
            { label: 'Active agencies', value: totals.live, sub: `of ${totals.agencies} total` },
            { label: 'Travellers', value: totals.travellers.toLocaleString(), sub: `${totals.actives.toLocaleString()} active in 30d` },
            { label: 'Active trips', value: totals.activeTrips, sub: 'in flight or in-resort' },
            { label: 'PWA installs', value: totals.installs.toLocaleString(), sub: `${installRate}% install rate` },
          ].map((m, i) => (
            <div
              key={i}
              className="px-6 py-5"
              style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--tg-border)' }}
            >
              <div
                style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--tg-text-tertiary)' }}
                className="uppercase mb-2"
              >
                {m.label}
              </div>
              <div
                style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: 'var(--tg-text-primary)' }}
                className="tabular-nums"
              >
                {m.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 4 }}>
                {m.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: needs attention + sync health */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div
          className="col-span-2 rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--tg-bg-primary)', border: '1px solid var(--tg-border)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--tg-border)' }}
          >
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
                Needs attention
              </h2>
              <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 2 }}>
                Agencies with issues in the last 24 hours
              </div>
            </div>
          </div>

          <div>
            {[
              { agency: AGENCIES.find(a => a.id === 'agc_2v6r')!, Icon: AlertTriangle, color: 'var(--tg-warning)', bg: 'var(--tg-warning-soft)', detail: '2 failed Travelify syncs · credentials may need refreshing' },
              { agency: AGENCIES.find(a => a.id === 'agc_8h3y')!, Icon: PauseCircle, color: 'var(--tg-text-secondary)', bg: 'var(--tg-bg-tertiary)', detail: 'Paused for 2 days · 178 travellers without access' },
              { agency: AGENCIES.find(a => a.id === 'agc_5x4t')!, Icon: Wrench, color: 'var(--tg-info)', bg: 'var(--tg-info-soft)', detail: 'In setup since 3 May · Travelify credentials not yet tested' },
            ].map((row, i) => (
              <Link
                key={i}
                href={`/admin/agencies/${row.agency.id}`}
                className="w-full px-6 py-4 flex items-center gap-4 transition-colors"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--tg-border)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--tg-bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: row.bg }}
                >
                  <row.Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: row.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
                    {row.agency.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 2 }}>
                    {row.detail}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--tg-text-tertiary)' }} />
              </Link>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--tg-bg-primary)', border: '1px solid var(--tg-border)' }}
        >
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--tg-border)' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
              Sync health
            </h2>
            <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 2 }}>
              Last 24 hours
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ fontSize: 13, color: 'var(--tg-text-tertiary)' }}>Successful</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tg-text-primary)' }} className="tabular-nums">
                  2,847
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tg-bg-tertiary)' }}>
                <div className="h-full" style={{ width: '97.2%', backgroundColor: 'var(--tg-success)' }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ fontSize: 13, color: 'var(--tg-text-tertiary)' }}>Failed</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tg-text-primary)' }} className="tabular-nums">
                  82
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tg-bg-tertiary)' }}>
                <div className="h-full" style={{ width: '2.8%', backgroundColor: 'var(--tg-warning)' }} />
              </div>
            </div>
            <Link
              href="/admin/sync"
              className="w-full mt-2 flex items-center justify-center gap-1 h-9"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--tg-text-accent)' }}
            >
              Open sync monitor <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </div>

      {/* All agencies table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--tg-bg-primary)', border: '1px solid var(--tg-border)' }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--tg-border)' }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
              All agencies
            </h2>
            <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 2 }}>
              {AGENCIES.length} total
            </div>
          </div>
          <Link
            href="/admin/agencies"
            className="flex items-center gap-1"
            style={{ fontSize: 13, color: 'var(--tg-text-tertiary)' }}
          >
            Manage <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
        <div>
          {AGENCIES.slice(0, 5).map((a, i) => (
            <Link
              key={a.id}
              href={`/admin/agencies/${a.id}`}
              className="w-full px-6 py-4 flex items-center gap-4 transition-colors"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--tg-border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--tg-bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Avatar name={a.name} bg={a.primary} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--tg-text-tertiary)', marginTop: 2 }}>
                  {a.city} · joined {a.joined}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-8 tabular-nums">
                <div className="text-right w-20">
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tg-text-primary)' }}>{a.travellers}</div>
                  <div style={{ fontSize: 11, color: 'var(--tg-text-tertiary)', marginTop: 2, letterSpacing: '0.06em' }} className="uppercase">travellers</div>
                </div>
                <div className="text-right w-20">
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tg-text-primary)' }}>{a.activeTrips}</div>
                  <div style={{ fontSize: 11, color: 'var(--tg-text-tertiary)', marginTop: 2, letterSpacing: '0.06em' }} className="uppercase">trips</div>
                </div>
                <div className="text-right w-24">
                  <div style={{ fontSize: 13, color: 'var(--tg-text-secondary)' }}>{a.lastSync}</div>
                  <div style={{ fontSize: 11, color: 'var(--tg-text-tertiary)', marginTop: 2, letterSpacing: '0.06em' }} className="uppercase">last sync</div>
                </div>
              </div>
              <Pill variant={a.tier}>{a.tier}</Pill>
              <StatusLabel
                status={a.status}
                label={a.status === 'live' ? 'Live' : a.status === 'paused' ? 'Paused' : a.status === 'setup' ? 'Setup' : 'Maintenance'}
              />
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--tg-text-tertiary)' }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
