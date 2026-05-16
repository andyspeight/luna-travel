'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, PauseCircle, Wrench, ChevronRight, ArrowUpRight } from 'lucide-react';

const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel', tier: 'Ignite', status: 'live', travellers: 847, activeTrips: 124, lastSync: '2m ago', primary: '#0F4C5C', city: 'Brighton', joined: 'Feb 2026', deviceInstalls: 612, last30dActives: 489 },
  { id: 'agc_3p8m', name: 'Mercia Holidays', tier: 'Boost', status: 'live', travellers: 312, activeTrips: 47, lastSync: '14m ago', primary: '#1B2B5B', city: 'Worcester', joined: 'Mar 2026', deviceInstalls: 198, last30dActives: 156 },
  { id: 'agc_9w1q', name: 'Elite Bespoke', tier: 'Ignite', status: 'live', travellers: 1247, activeTrips: 203, lastSync: '47s ago', primary: '#0A0A0A', city: 'Mayfair', joined: 'Jan 2026', deviceInstalls: 1024, last30dActives: 891 },
  { id: 'agc_2v6r', name: 'Brackenwood Travel', tier: 'Boost', status: 'live', travellers: 234, activeTrips: 38, lastSync: '3m ago', primary: '#2D5016', city: 'Kendal', joined: 'Apr 2026', deviceInstalls: 142, last30dActives: 98 },
  { id: 'agc_5x4t', name: 'Halcyon Days Travel', tier: 'Spark', status: 'setup', travellers: 0, activeTrips: 0, lastSync: 'never', primary: '#1B2B5B', city: 'Cheltenham', joined: 'May 2026', deviceInstalls: 0, last30dActives: 0 },
  { id: 'agc_8h3y', name: 'Saltbreeze Travel', tier: 'Boost', status: 'paused', travellers: 178, activeTrips: 22, lastSync: '2d ago', primary: '#264653', city: 'St Ives', joined: 'Mar 2026', deviceInstalls: 89, last30dActives: 0 },
];

function StatusDot({ status }: { status: string }) {
  const color = status === 'live' ? 'bg-tg-success' : status === 'paused' ? 'bg-tg-text-tertiary' : status === 'setup' ? 'bg-tg-info' : 'bg-tg-warning';
  return (
    <span className="relative inline-flex h-2 w-2">
      {status === 'live' && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${color}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function StatusLabel({ status, label }: { status: string; label: string }) {
  const color = status === 'live' ? 'text-tg-success' : status === 'paused' ? 'text-tg-text-secondary' : status === 'setup' ? 'text-tg-info' : 'text-tg-warning';
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${color}`}>
      <StatusDot status={status} />{label}
    </span>
  );
}

function Pill({ tier }: { tier: string }) {
  const style = tier === 'Ignite' ? 'bg-tg-warning-soft text-tg-warning' : tier === 'Boost' ? 'bg-tg-info-soft text-tg-info' : 'bg-tg-bg-tertiary text-tg-text-secondary';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${style}`}>{tier}</span>;
}

function Avatar({ name, bg }: { name: string; bg: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: bg }}>
      {initials}
    </div>
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
    <div className="px-8 py-8 max-w-screen-2xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mb-1">Travelgenix admin</div>
          <h1 className="text-3xl font-semibold tracking-tight text-tg-text">Overview</h1>
        </div>
        <StatusLabel status="live" label="Live · refreshed just now" />
      </div>

      <div className="rounded-xl mb-6 bg-tg-bg border border-tg-border overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-tg-border">
          {[
            { label: 'Active agencies', value: totals.live, sub: `of ${totals.agencies} total` },
            { label: 'Travellers', value: totals.travellers.toLocaleString(), sub: `${totals.actives.toLocaleString()} active in 30d` },
            { label: 'Active trips', value: totals.activeTrips, sub: 'in flight or in-resort' },
            { label: 'PWA installs', value: totals.installs.toLocaleString(), sub: `${installRate}% install rate` },
          ].map((m, i) => (
            <div key={i} className="px-6 py-5">
              <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mb-2">{m.label}</div>
              <div className="text-3xl font-semibold tracking-tight text-tg-text tabular-nums">{m.value}</div>
              <div className="text-sm text-tg-text-tertiary mt-1">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="col-span-2 rounded-xl bg-tg-bg border border-tg-border overflow-hidden">
          <div className="px-6 py-4 border-b border-tg-border">
            <h2 className="text-base font-semibold text-tg-text">Needs attention</h2>
            <div className="text-sm text-tg-text-tertiary mt-0.5">Agencies with issues in the last 24 hours</div>
          </div>
          <div>
            {[
              { agency: AGENCIES.find(a => a.id === 'agc_2v6r')!, Icon: AlertTriangle, color: 'text-tg-warning', bg: 'bg-tg-warning-soft', detail: '2 failed Travelify syncs · credentials may need refreshing' },
              { agency: AGENCIES.find(a => a.id === 'agc_8h3y')!, Icon: PauseCircle, color: 'text-tg-text-secondary', bg: 'bg-tg-bg-tertiary', detail: 'Paused for 2 days · 178 travellers without access' },
              { agency: AGENCIES.find(a => a.id === 'agc_5x4t')!, Icon: Wrench, color: 'text-tg-info', bg: 'bg-tg-info-soft', detail: 'In setup since 3 May · Travelify credentials not yet tested' },
            ].map((row, i) => (
              <Link key={i} href={`/admin/agencies/${row.agency.id}`} className={`flex items-center gap-4 px-6 py-4 hover:bg-tg-bg-secondary transition-colors ${i === 0 ? '' : 'border-t border-tg-border'}`}>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${row.bg}`}>
                  <row.Icon className={`h-4 w-4 ${row.color}`} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-tg-text">{row.agency.name}</div>
                  <div className="text-sm text-tg-text-tertiary mt-0.5">{row.detail}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-tg-text-tertiary" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-tg-bg border border-tg-border overflow-hidden">
          <div className="px-6 py-4 border-b border-tg-border">
            <h2 className="text-base font-semibold text-tg-text">Sync health</h2>
            <div className="text-sm text-tg-text-tertiary mt-0.5">Last 24 hours</div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-tg-text-tertiary">Successful</span>
                <span className="text-base font-semibold text-tg-text tabular-nums">2,847</span>
              </div>
              <div className="h-2 rounded-full bg-tg-bg-tertiary overflow-hidden">
                <div className="h-full bg-tg-success" style={{ width: '97.2%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-tg-text-tertiary">Failed</span>
                <span className="text-base font-semibold text-tg-text tabular-nums">82</span>
              </div>
              <div className="h-2 rounded-full bg-tg-bg-tertiary overflow-hidden">
                <div className="h-full bg-tg-warning" style={{ width: '2.8%' }} />
              </div>
            </div>
            <Link href="/admin/sync" className="flex items-center justify-center gap-1 h-9 text-sm font-medium text-tg-text-accent">
              Open sync monitor <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-tg-bg border border-tg-border overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-tg-border">
          <div>
            <h2 className="text-base font-semibold text-tg-text">All agencies</h2>
            <div className="text-sm text-tg-text-tertiary mt-0.5">{AGENCIES.length} total</div>
          </div>
          <Link href="/admin/agencies" className="text-sm text-tg-text-tertiary flex items-center gap-1">
            Manage <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div>
          {AGENCIES.slice(0, 5).map((a, i) => (
            <Link key={a.id} href={`/admin/agencies/${a.id}`} className={`flex items-center gap-4 px-6 py-4 hover:bg-tg-bg-secondary transition-colors ${i === 0 ? '' : 'border-t border-tg-border'}`}>
              <Avatar name={a.name} bg={a.primary} />
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-tg-text">{a.name}</div>
                <div className="text-sm text-tg-text-tertiary mt-0.5">{a.city} · joined {a.joined}</div>
              </div>
              <div className="hidden md:flex items-center gap-8 tabular-nums">
                <div className="text-right w-20">
                  <div className="text-base font-medium text-tg-text">{a.travellers}</div>
                  <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mt-0.5">travellers</div>
                </div>
                <div className="text-right w-20">
                  <div className="text-base font-medium text-tg-text">{a.activeTrips}</div>
                  <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mt-0.5">trips</div>
                </div>
                <div className="text-right w-24">
                  <div className="text-sm text-tg-text-secondary">{a.lastSync}</div>
                  <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mt-0.5">last sync</div>
                </div>
              </div>
              <Pill tier={a.tier} />
              <StatusLabel status={a.status} label={a.status === 'live' ? 'Live' : a.status === 'paused' ? 'Paused' : a.status === 'setup' ? 'Setup' : 'Maintenance'} />
              <ChevronRight className="h-4 w-4 text-tg-text-tertiary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
