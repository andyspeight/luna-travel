'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, AlertTriangle, Search, ChevronRight, X,
  Play, Pause, RefreshCw, Copy, ExternalLink, Filter,
  AlertCircle, Clock,
} from 'lucide-react';

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
  primaryLight: '#2A3F7A',
  accent: '#00B4D8',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

type SyncStatus = 'success' | 'failed' | 'partial';
type SyncEvent = {
  id: string;
  agency: string;
  agencyId: string;
  bookingRef: string;
  status: SyncStatus;
  time: string;
  timestamp: number;
  detail: string;
  errorCode?: string;
  duration: number;
  documentsAdded?: number;
};

let eventCounter = 491203;
function generateEvent(secondsAgo: number, agencyOverride?: { agency: string; agencyId: string; failureRate: number }): SyncEvent {
  const now = Date.now();
  const ts = now - secondsAgo * 1000;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  const AGENCIES = [
    { agency: 'Coast & Crown Travel', agencyId: 'agc_7k2n', failureRate: 0.02 },
    { agency: 'Mercia Holidays',       agencyId: 'agc_3p8m', failureRate: 0.03 },
    { agency: 'Elite Bespoke',         agencyId: 'agc_9w1q', failureRate: 0.01 },
    { agency: 'Brackenwood Travel',    agencyId: 'agc_2v6r', failureRate: 0.40 },
    { agency: 'Northstar Journeys',    agencyId: 'agc_4n7c', failureRate: 0.02 },
  ];
  const a = agencyOverride ?? AGENCIES[eventCounter % AGENCIES.length];
  const failed = Math.random() < a.failureRate;
  const partial = !failed && Math.random() < 0.03;

  eventCounter--;
  const ref = `TG-${491203 - (491203 - eventCounter)}`;
  const status: SyncStatus = failed ? 'failed' : partial ? 'partial' : 'success';
  const docsAdded = status === 'success' ? Math.floor(Math.random() * 4) : 0;

  const successDetails = [
    'Booking updated',
    docsAdded > 0 ? `Booking updated · ${docsAdded} documents added` : 'Booking updated',
    'New booking ingested',
    'Booking updated · flight time changed',
    'Booking updated · hotel modified',
  ];
  const failedDetails = [
    'Travelify 401 — credentials need refresh',
    'Travelify 401 — credentials need refresh',
    'Travelify 500 — upstream timeout',
    'Travelify 404 — booking not found',
  ];
  const partialDetails = [
    'Booking updated · 1 document failed to attach',
    'Booking updated · flight refresh skipped',
  ];

  return {
    id: `evt_${eventCounter}_${ts}`,
    agency: a.agency,
    agencyId: a.agencyId,
    bookingRef: ref,
    status,
    time: `${hh}:${mm}:${ss}`,
    timestamp: ts,
    detail: status === 'failed'
      ? failedDetails[Math.floor(Math.random() * failedDetails.length)]
      : status === 'partial'
      ? partialDetails[Math.floor(Math.random() * partialDetails.length)]
      : successDetails[Math.floor(Math.random() * successDetails.length)],
    errorCode: status === 'failed' ? '401' : undefined,
    duration: status === 'failed' ? 5000 + Math.floor(Math.random() * 3000) : 200 + Math.floor(Math.random() * 800),
    documentsAdded: docsAdded > 0 ? docsAdded : undefined,
  };
}

function generateSeedEvents(count = 30): SyncEvent[] {
  eventCounter = 491203;
  const events: SyncEvent[] = [];
  for (let i = 0; i < count; i++) {
    events.push(generateEvent(i * 47 + Math.floor(Math.random() * 30)));
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

const AGENCY_FILTER_OPTIONS = [
  { value: 'all', label: 'All agencies' },
  { value: 'agc_7k2n', label: 'Coast & Crown' },
  { value: 'agc_3p8m', label: 'Mercia Holidays' },
  { value: 'agc_9w1q', label: 'Elite Bespoke' },
  { value: 'agc_2v6r', label: 'Brackenwood' },
  { value: 'agc_4n7c', label: 'Northstar' },
];

function StatusPill({ status }: { status: SyncStatus }) {
  const config = {
    success: { bg: C.successSoft, fg: C.success, label: 'Success', Icon: CheckCircle2 },
    failed:  { bg: C.errorSoft,   fg: C.error,   label: 'Failed',  Icon: AlertTriangle },
    partial: { bg: C.warningSoft, fg: C.warning, label: 'Partial', Icon: AlertCircle },
  }[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 6,
      fontSize: 12, fontWeight: 600,
      backgroundColor: config.bg, color: config.fg,
      whiteSpace: 'nowrap',
    }}>
      <config.Icon style={{ height: 12, width: 12 }} strokeWidth={2} />
      {config.label}
    </span>
  );
}

function Button({ children, variant = 'primary', onClick, disabled, leftIcon, size = 'md' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; onClick?: () => void; disabled?: boolean; leftIcon?: React.ReactNode; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(false);
  const styles = variant === 'primary'
    ? { bg: disabled ? C.textTertiary : (hover ? C.primaryLight : C.primary), fg: '#fff', border: 'none' }
    : variant === 'ghost'
    ? { bg: hover ? C.bg : 'transparent', fg: C.textSecondary, border: 'none' }
    : { bg: hover && !disabled ? C.bg : C.bgElevated, fg: C.text, border: `1px solid ${C.border}` };
  const heightVal = size === 'sm' ? 32 : 40;
  const padding = size === 'sm' ? '0 12px' : '0 16px';
  const fontSize = size === 'sm' ? 13 : 14;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding, height: heightVal, borderRadius: 8,
        backgroundColor: styles.bg, color: styles.fg, border: styles.border,
        fontSize, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 150ms',
      }}
    >{leftIcon}{children}</button>
  );
}

function DetailDrawer({ event, onClose }: { event: SyncEvent | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<'idle' | 'success' | 'failed'>('idle');

  useEffect(() => {
    if (event) {
      setCopied(false);
      setResyncResult('idle');
    }
  }, [event]);

  if (!event) return null;

  const copyRef = () => {
    navigator.clipboard.writeText(event.bookingRef).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const resync = () => {
    setResyncing(true);
    setResyncResult('idle');
    setTimeout(() => {
      setResyncing(false);
      setResyncResult(event.status === 'failed' && Math.random() < 0.7 ? 'failed' : 'success');
    }, 1500);
  };

  const mockPayload = event.status === 'failed' ? `{
  "error": "Unauthorized",
  "status": 401,
  "message": "Invalid API credentials",
  "request": {
    "method": "GET",
    "url": "https://api.travelify.io/account/order/${event.bookingRef}",
    "headers": {
      "Authorization": "Bearer ***redacted***",
      "Origin": "https://www.travelgenix.io"
    }
  },
  "timestamp": "${new Date(event.timestamp).toISOString()}"
}` : `{
  "status": "ok",
  "booking": {
    "reference": "${event.bookingRef}",
    "agency_id": "${event.agencyId}",
    "lead_passenger": "***redacted***",
    "destination": "***redacted***",
    "departure_date": "***redacted***"
  },
  "duration_ms": ${event.duration},
  "documents_attached": ${event.documentsAdded ?? 0},
  "timestamp": "${new Date(event.timestamp).toISOString()}"
}`;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.4)',
          zIndex: 40,
          animation: 'tg-fade-in 200ms ease-out',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480, maxWidth: '100vw',
        backgroundColor: C.bgElevated,
        boxShadow: '-8px 0 24px rgba(15,23,42,0.15)',
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        animation: 'tg-slide-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
              Sync event
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                {event.bookingRef}
              </h2>
              <button
                onClick={copyRef}
                style={{
                  padding: 4, borderRadius: 4, border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  color: C.textTertiary,
                }}
                aria-label="Copy booking ref"
              >
                {copied
                  ? <CheckCircle2 style={{ height: 14, width: 14, color: C.success }} strokeWidth={1.75} />
                  : <Copy style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                }
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              height: 32, width: 32, borderRadius: 8, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer',
              color: C.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X style={{ height: 16, width: 16 }} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{
          padding: '20px 24px',
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Status</div>
            <StatusPill status={event.status} />
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 14, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{event.duration}ms</div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Agency</div>
            <Link
              href={`/admin/agencies/${event.agencyId}`}
              style={{
                fontSize: 14, color: C.text, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {event.agency}
              <ExternalLink style={{ height: 12, width: 12, color: C.textTertiary }} strokeWidth={1.75} />
            </Link>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Timestamp</div>
            <div style={{ fontSize: 14, color: C.text, fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>
              {event.time}
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>
            Detail
          </div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>{event.detail}</div>
        </div>

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>
            Raw response
          </div>
          <pre style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#0F172A',
            color: '#E2E8F0',
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: 'ui-monospace, monospace',
            overflowX: 'auto',
            maxHeight: '100%',
          }}>{mockPayload}</pre>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: C.bg,
        }}>
          {resyncResult === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.success, fontWeight: 500 }}>
              <CheckCircle2 style={{ height: 14, width: 14 }} strokeWidth={1.75} />
              Re-sync successful
            </div>
          )}
          {resyncResult === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.error, fontWeight: 500 }}>
              <AlertTriangle style={{ height: 14, width: 14 }} strokeWidth={1.75} />
              Re-sync also failed
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button
              onClick={resync}
              disabled={resyncing}
              leftIcon={<RefreshCw style={{ height: 14, width: 14, animation: resyncing ? 'tg-spin 1s linear infinite' : 'none' }} strokeWidth={1.75} />}
            >
              {resyncing ? 'Re-syncing...' : 'Re-sync booking'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SyncMonitorPage() {
  const [events, setEvents] = useState<SyncEvent[]>(() => generateSeedEvents(30));
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SyncStatus>('all');
  const [selected, setSelected] = useState<SyncEvent | null>(null);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const newCount = 1 + Math.floor(Math.random() * 3);
      setEvents(prev => {
        const fresh: SyncEvent[] = [];
        for (let i = 0; i < newCount; i++) {
          fresh.push(generateEvent(i * 2));
        }
        return [...fresh, ...prev].slice(0, 100);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [paused]);

  const filtered = useMemo(() => events.filter(e => {
    if (agencyFilter !== 'all' && e.agencyId !== agencyFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!e.bookingRef.toLowerCase().includes(q) &&
          !e.agency.toLowerCase().includes(q) &&
          !e.detail.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [events, agencyFilter, statusFilter, query]);

  const failedCount = useMemo(() => events.filter(e => e.status === 'failed').length, [events]);
  const failedAgencies = useMemo(() => {
    const map = new Map<string, number>();
    events.filter(e => e.status === 'failed').forEach(e => {
      map.set(e.agency, (map.get(e.agency) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const successPct = events.length > 0
    ? Math.round((events.filter(e => e.status === 'success').length / events.length) * 100)
    : 100;

  const newSinceMount = events.length > 30 ? events.length - 30 : 0;

  return (
    <>
      <style>{`
        @keyframes tg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tg-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes tg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tg-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .tg-row { transition: background-color 150ms; cursor: pointer; }
        .tg-row:hover { background-color: ${C.bg} !important; }
      `}</style>

      <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
              Travelgenix admin
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
              Sync monitor
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: paused ? C.textSecondary : C.success, fontWeight: 500 }}>
              <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
                {!paused && (
                  <span style={{
                    position: 'absolute', display: 'inline-flex', height: '100%', width: '100%',
                    borderRadius: '50%', opacity: 0.6, backgroundColor: C.success,
                    animation: 'tg-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                  }} />
                )}
                <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: '50%', backgroundColor: paused ? C.textTertiary : C.success }} />
              </span>
              {paused ? 'Paused' : `Streaming · ${events.length} events`}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPaused(p => !p)}
              leftIcon={paused
                ? <Play style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                : <Pause style={{ height: 14, width: 14 }} strokeWidth={1.75} />
              }
            >{paused ? 'Resume' : 'Pause'}</Button>
          </div>
        </div>

        {failedCount > 0 && (
          <div style={{
            padding: 16, borderRadius: 12, marginBottom: 20,
            backgroundColor: C.errorSoft,
            border: `1px solid ${C.error}`,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              height: 36, width: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bgElevated, flexShrink: 0,
            }}>
              <AlertTriangle style={{ height: 18, width: 18, color: C.error }} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {failedCount} failed sync{failedCount === 1 ? '' : 's'} in the current view
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
                {failedAgencies.slice(0, 3).map(([agency, count], i) => (
                  <span key={agency}>
                    {i > 0 && ' · '}
                    <strong style={{ color: C.text }}>{agency}</strong> ({count})
                  </span>
                ))}
                {failedAgencies.length > 3 && <span> · and {failedAgencies.length - 3} more</span>}
              </div>
            </div>
            {statusFilter !== 'failed' && (
              <Button variant="secondary" size="sm" onClick={() => setStatusFilter('failed')}>
                View failed only
              </Button>
            )}
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20,
        }}>
          {[
            { label: 'Total events', value: events.length, sub: newSinceMount > 0 ? `+${newSinceMount} since you opened this page` : 'In current view' },
            { label: 'Success rate', value: `${successPct}%`, sub: `${events.filter(e => e.status === 'success').length} successful` },
            { label: 'Failed', value: failedCount, sub: failedCount > 0 ? `${failedAgencies.length} agencies affected` : 'All clear' },
          ].map((m, i) => (
            <div key={i} style={{
              padding: '20px 24px',
              borderRadius: 12,
              backgroundColor: C.bgElevated,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.value}</div>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{
          borderRadius: 12, backgroundColor: C.bgElevated,
          border: `1px solid ${C.border}`, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', minWidth: 280, flex: 1, maxWidth: 360 }}>
              <Search style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                height: 16, width: 16, color: C.textTertiary, pointerEvents: 'none',
              }} strokeWidth={1.75} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search booking ref, agency or detail..."
                style={{
                  width: '100%', height: 36,
                  paddingLeft: 36, paddingRight: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  backgroundColor: C.bgElevated, color: C.text,
                  fontSize: 14, lineHeight: 1.5, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, backgroundColor: C.bgTertiary }}>
              {(['all', 'success', 'failed', 'partial'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '0 12px', height: 28, borderRadius: 6, border: 'none',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: statusFilter === s ? C.bgElevated : 'transparent',
                    color: statusFilter === s ? C.text : C.textSecondary,
                    boxShadow: statusFilter === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >{s === 'all' ? 'All' : s}</button>
              ))}
            </div>

            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              style={{
                height: 36, padding: '0 32px 0 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                color: C.text, fontSize: 14, lineHeight: 1.5,
                outline: 'none', cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              {AGENCY_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {(query || agencyFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQuery(''); setAgencyFilter('all'); setStatusFilter('all'); }}
              >Clear filters</Button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
              {filtered.length} of {events.length}
            </div>
          </div>

          <div style={{
            padding: '10px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'grid', gridTemplateColumns: '180px 1fr 200px 100px 24px',
            gap: 16, alignItems: 'center',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary,
            backgroundColor: C.bg,
          }}>
            <div>Agency · Booking</div>
            <div>Detail</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Time</div>
            <div />
          </div>

          <div>
            {filtered.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <Filter style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>No events match your filters</div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>Try clearing the search or changing the filters above.</div>
              </div>
            ) : (
              filtered.map((e, i) => (
                <div
                  key={e.id}
                  className="tg-row"
                  onClick={() => setSelected(e)}
                  style={{
                    padding: '12px 24px',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    display: 'grid', gridTemplateColumns: '180px 1fr 200px 100px 24px',
                    gap: 16, alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.agency}</div>
                    <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, marginTop: 2 }}>{e.bookingRef}</div>
                  </div>
                  <div style={{ fontSize: 13, color: e.status === 'failed' ? C.error : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</div>
                  <div>
                    <StatusPill status={e.status} />
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{e.time}</div>
                  <ChevronRight style={{ height: 14, width: 14, color: C.textTertiary }} strokeWidth={1.75} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DetailDrawer event={selected} onClose={() => setSelected(null)} />
    </>
  );
}
