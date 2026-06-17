'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, AlertTriangle, Search, ChevronRight, X,
  Play, Pause, RefreshCw, ExternalLink, Filter, AlertCircle,
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
  agencyId: string;
  travellerId: string | null;
  bookingRef: string;
  status: SyncStatus;
  detail: string;
  errorCode: string | null;
  durationMs: number;
  documentsAdded: number;
  source: 'cron' | 'manual' | 'redeem';
  syncedAt: string;
};
type Stats = {
  total: number;
  success: number;
  partial: number;
  failed: number;
  successPct: number;
  failedByAgency: Record<string, number>;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: C.text }}>{children}</div>
    </div>
  );
}

function DetailDrawer({
  event,
  agencyName,
  onClose,
  onResynced,
}: {
  event: SyncEvent | null;
  agencyName: string;
  onClose: () => void;
  onResynced: () => void;
}) {
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ status: SyncStatus; detail: string } | null>(null);

  useEffect(() => {
    setResyncResult(null);
  }, [event]);

  if (!event) return null;

  const resync = async () => {
    if (!event.travellerId) return;
    setResyncing(true);
    setResyncResult(null);
    try {
      const res = await fetch('/api/admin/sync/booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travellerId: event.travellerId }),
      });
      const data = await res.json();
      if (res.ok && data.event) {
        setResyncResult({ status: data.event.status, detail: data.event.detail });
        onResynced();
      } else {
        setResyncResult({ status: 'failed', detail: 'Re-sync request failed' });
      }
    } catch {
      setResyncResult({ status: 'failed', detail: 'Re-sync request failed' });
    } finally {
      setResyncing(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', zIndex: 40, animation: 'tg-fade-in 200ms ease-out' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480, maxWidth: '100vw',
        backgroundColor: C.bgElevated,
        boxShadow: '-8px 0 24px rgba(15,23,42,0.15)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'tg-slide-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Sync event</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0, fontFamily: 'ui-monospace, monospace' }}>{event.bookingRef}</h2>
          </div>
          <button onClick={onClose} style={{ height: 32, width: 32, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label="Close">
            <X style={{ height: 16, width: 16 }} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, borderBottom: `1px solid ${C.border}` }}>
          <Field label="Status"><StatusPill status={event.status} /></Field>
          <Field label="Duration"><span style={{ fontVariantNumeric: 'tabular-nums' }}>{event.durationMs}ms</span></Field>
          <Field label="Agency">
            <Link href={`/admin/agencies/${event.agencyId}`} style={{ color: C.text, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {agencyName}
              <ExternalLink style={{ height: 12, width: 12, color: C.textTertiary }} strokeWidth={1.75} />
            </Link>
          </Field>
          <Field label="Time"><span style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(event.syncedAt)}</span></Field>
          <Field label="Source"><span style={{ textTransform: 'capitalize' }}>{event.source}</span></Field>
          {event.errorCode && <Field label="Error code"><span style={{ color: C.error, fontFamily: 'ui-monospace, monospace' }}>{event.errorCode}</span></Field>}
        </div>

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>Detail</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>{event.detail}</div>
          {event.documentsAdded > 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: C.textSecondary }}>{event.documentsAdded} document{event.documentsAdded === 1 ? '' : 's'} added</div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.bg }}>
          {resyncResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: resyncResult.status === 'failed' ? C.error : C.success }}>
              {resyncResult.status === 'failed'
                ? <AlertTriangle style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                : <CheckCircle2 style={{ height: 14, width: 14 }} strokeWidth={1.75} />}
              {resyncResult.status === 'failed' ? 'Re-sync failed' : 'Re-sync successful'}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button
              onClick={resync}
              disabled={resyncing || !event.travellerId}
              leftIcon={<RefreshCw style={{ height: 14, width: 14, animation: resyncing ? 'tg-spin 1s linear infinite' : 'none' }} strokeWidth={1.75} />}
            >
              {resyncing ? 'Re-syncing…' : 'Re-sync booking'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SyncMonitorPage() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SyncStatus>('all');
  const [selected, setSelected] = useState<SyncEvent | null>(null);

  const agencyName = useCallback((id: string) => agencyNames[id] || id, [agencyNames]);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-events?limit=100', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setStats(data.stats ?? null);
    } catch {
      /* keep last known */
    } finally {
      setLoading(false);
    }
  }, []);

  // Agency id → name (so events read as names, not Control record ids).
  useEffect(() => {
    fetch('/api/admin/agencies', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.agencies) return;
        const map: Record<string, string> = {};
        for (const a of data.agencies) map[a.id] = a.name || a.id;
        setAgencyNames(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Live refresh every 30s unless paused.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(fetchFeed, 30000);
    return () => clearInterval(id);
  }, [paused, fetchFeed]);

  const runNow = async () => {
    setRunning(true);
    try {
      await fetch('/api/admin/sync/run', { method: 'POST', credentials: 'include' });
      await fetchFeed();
    } catch {
      /* ignore */
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => events.filter((e) => {
    if (agencyFilter !== 'all' && e.agencyId !== agencyFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!e.bookingRef.toLowerCase().includes(q) &&
          !agencyName(e.agencyId).toLowerCase().includes(q) &&
          !e.detail.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [events, agencyFilter, statusFilter, query, agencyName]);

  const agencyOptions = useMemo(() => {
    const ids = Array.from(new Set(events.map((e) => e.agencyId)));
    return [{ value: 'all', label: 'All agencies' }, ...ids.map((id) => ({ value: id, label: agencyName(id) }))];
  }, [events, agencyName]);

  const failedByAgency = useMemo(() => {
    const map = stats?.failedByAgency ?? {};
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const failedCount = stats?.failed ?? 0;
  const successPct = stats?.successPct ?? 100;

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
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Sync monitor</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: paused ? C.textSecondary : C.success, fontWeight: 500 }}>
              <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
                {!paused && (
                  <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', opacity: 0.6, backgroundColor: C.success, animation: 'tg-ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                )}
                <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: '50%', backgroundColor: paused ? C.textTertiary : C.success }} />
              </span>
              {paused ? 'Paused' : `Live · ${events.length} events`}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)} leftIcon={paused ? <Play style={{ height: 14, width: 14 }} strokeWidth={1.75} /> : <Pause style={{ height: 14, width: 14 }} strokeWidth={1.75} />}>
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" onClick={runNow} disabled={running} leftIcon={<RefreshCw style={{ height: 14, width: 14, animation: running ? 'tg-spin 1s linear infinite' : 'none' }} strokeWidth={1.75} />}>
              {running ? 'Syncing…' : 'Run sync now'}
            </Button>
          </div>
        </div>

        {failedCount > 0 && (
          <div style={{ padding: 16, borderRadius: 12, marginBottom: 20, backgroundColor: C.errorSoft, border: `1px solid ${C.error}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ height: 36, width: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgElevated, flexShrink: 0 }}>
              <AlertTriangle style={{ height: 18, width: 18, color: C.error }} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{failedCount} failed sync{failedCount === 1 ? '' : 's'} recently</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
                {failedByAgency.slice(0, 3).map(([id, count], i) => (
                  <span key={id}>{i > 0 && ' · '}<strong style={{ color: C.text }}>{agencyName(id)}</strong> ({count})</span>
                ))}
                {failedByAgency.length > 3 && <span> · and {failedByAgency.length - 3} more</span>}
              </div>
            </div>
            {statusFilter !== 'failed' && <Button variant="secondary" size="sm" onClick={() => setStatusFilter('failed')}>View failed only</Button>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Recent events', value: stats?.total ?? events.length, sub: 'Last 500 syncs' },
            { label: 'Success rate', value: `${successPct}%`, sub: `${stats?.success ?? 0} successful` },
            { label: 'Failed', value: failedCount, sub: failedCount > 0 ? `${failedByAgency.length} agencies affected` : 'All clear' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '20px 24px', borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.value}</div>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 280, flex: 1, maxWidth: 360 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: 16, width: 16, color: C.textTertiary, pointerEvents: 'none' }} strokeWidth={1.75} />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search booking ref, agency or detail…" style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, backgroundColor: C.bgTertiary }}>
              {(['all', 'success', 'failed', 'partial'] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '0 12px', height: 28, borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: statusFilter === s ? C.bgElevated : 'transparent', color: statusFilter === s ? C.text : C.textSecondary, boxShadow: statusFilter === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', textTransform: 'capitalize' }}>{s === 'all' ? 'All' : s}</button>
              ))}
            </div>

            <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} style={{ height: 36, padding: '0 32px 0 12px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, lineHeight: 1.5, outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
              {agencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {(query || agencyFilter !== 'all' || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setAgencyFilter('all'); setStatusFilter('all'); }}>Clear filters</Button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{filtered.length} of {events.length}</div>
          </div>

          <div style={{ padding: '10px 24px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '180px 1fr 200px 100px 24px', gap: 16, alignItems: 'center', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, backgroundColor: C.bg }}>
            <div>Agency · Booking</div>
            <div>Detail</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Time</div>
            <div />
          </div>

          <div>
            {loading ? (
              <div style={{ padding: '64px 24px', textAlign: 'center', fontSize: 14, color: C.textTertiary }}>Loading sync events…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <Filter style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  {events.length === 0 ? 'No sync events yet' : 'No events match your filters'}
                </div>
                <div style={{ fontSize: 13, color: C.textTertiary }}>
                  {events.length === 0 ? 'Run a sync to pull bookings from Travelify and populate the feed.' : 'Try clearing the search or changing the filters above.'}
                </div>
              </div>
            ) : (
              filtered.map((e, i) => (
                <div key={e.id} className="tg-row" onClick={() => setSelected(e)} style={{ padding: '12px 24px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '180px 1fr 200px 100px 24px', gap: 16, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agencyName(e.agencyId)}</div>
                    <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, marginTop: 2 }}>{e.bookingRef}</div>
                  </div>
                  <div style={{ fontSize: 13, color: e.status === 'failed' ? C.error : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</div>
                  <div><StatusPill status={e.status} /></div>
                  <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(e.syncedAt)}</div>
                  <ChevronRight style={{ height: 14, width: 14, color: C.textTertiary }} strokeWidth={1.75} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DetailDrawer event={selected} agencyName={selected ? agencyName(selected.agencyId) : ''} onClose={() => setSelected(null)} onResynced={fetchFeed} />
    </>
  );
}
