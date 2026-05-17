'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield, LogIn, LogOut, AlertCircle, UserPlus, CheckCircle2,
  Search, RefreshCw, ChevronRight, X, FileUp, FileX,
} from 'lucide-react';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
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

type AuditEvent = {
  id: string;
  eventType:
    | 'admin.signin' | 'admin.signin_failed' | 'admin.signout'
    | 'invite.created' | 'invite.redeemed'
    | 'document.uploaded' | 'document.deleted';
  actor: string;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// ────────────────────────────────────────────────────────────────────
// Event type meta — icon, colour, friendly label
// ────────────────────────────────────────────────────────────────────

const EVENT_META: Record<AuditEvent['eventType'], {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  bg: string;
  fg: string;
}> = {
  'admin.signin': { label: 'Sign in', Icon: LogIn, bg: C.successSoft, fg: C.success },
  'admin.signin_failed': { label: 'Sign in failed', Icon: AlertCircle, bg: C.errorSoft, fg: C.error },
  'admin.signout': { label: 'Sign out', Icon: LogOut, bg: C.bgTertiary, fg: C.textSecondary },
  'invite.created': { label: 'Invite created', Icon: UserPlus, bg: C.infoSoft, fg: C.info },
  'invite.redeemed': { label: 'Invite redeemed', Icon: CheckCircle2, bg: C.successSoft, fg: C.success },
  'document.uploaded': { label: 'Document uploaded', Icon: FileUp, bg: C.infoSoft, fg: C.info },
  'document.deleted': { label: 'Document removed', Icon: FileX, bg: C.errorSoft, fg: C.error },
};

// ────────────────────────────────────────────────────────────────────
// Relative-time formatting (just-now, 2m ago, 3h ago, yesterday, etc.)
// ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return 'yesterday';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<Set<AuditEvent['eventType']>>(new Set());
  const [actorFilter, setActorFilter] = useState('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Stable identifier for the current filter — used to ignore stale responses
  // when filters change mid-fetch
  const filterSigRef = useRef('');

  const fetchEvents = useCallback(async (opts: { append?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filterTypes.size > 0) params.set('eventType', Array.from(filterTypes).join(','));
    if (actorFilter.trim()) params.set('actor', actorFilter.trim());
    if (opts.append && nextBefore) params.set('before', nextBefore);

    const sig = params.toString();
    filterSigRef.current = sig;

    if (opts.append) setLoadingMore(true);
    else if (events.length === 0) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/admin/audit?${sig}`, { credentials: 'include' });
      if (!res.ok) {
        setError("Couldn't load the audit log.");
        return;
      }
      const data = await res.json();

      // Drop response if the user changed filters while this request was in flight
      if (filterSigRef.current !== sig && !opts.append) return;

      setError(null);
      setEvents((prev) => opts.append ? [...prev, ...data.events] : data.events);
      setNextBefore(data.nextBefore || null);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  // We deliberately exclude nextBefore from deps — including it would cause
  // infinite re-fetches on pagination. The function reads it from closure
  // at call time, which is fine because we only call from event handlers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTypes, actorFilter]);

  // Initial load and re-load on filter changes
  useEffect(() => {
    setEvents([]);
    setNextBefore(null);
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => {
      fetchEvents();
    }, 30_000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  const toggleType = (t: AuditEvent['eventType']) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterTypes(new Set());
    setActorFilter('');
  };

  const hasFilters = filterTypes.size > 0 || actorFilter.trim().length > 0;

  return (
    <div style={{ padding: '32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
            Travelgenix admin
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
            Audit log
          </h1>
          <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, maxWidth: 540 }}>
            Append-only record of admin activity and traveller redemptions. Auto-refreshes every 30 seconds.
          </div>
        </div>
        <button
          onClick={() => fetchEvents()}
          disabled={refreshing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '0 12px', height: 36, borderRadius: 8,
            backgroundColor: C.bgElevated, color: C.text,
            border: `1px solid ${C.border}`,
            fontSize: 13, fontWeight: 500, cursor: refreshing ? 'wait' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
            flexShrink: 0,
          }}
          title="Refresh now"
        >
          <RefreshCw
            style={{ height: 14, width: 14, animation: refreshing ? 'audit-spin 1s linear infinite' : undefined }}
            strokeWidth={1.75}
          />
          Refresh
        </button>
      </div>

      <style>{`@keyframes audit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Filters */}
      <div style={{
        borderRadius: 12, backgroundColor: C.bgElevated,
        border: `1px solid ${C.border}`, padding: 16, marginBottom: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(EVENT_META) as AuditEvent['eventType'][]).map((t) => {
            const meta = EVENT_META[t];
            const active = filterTypes.has(t);
            const Icon = meta.Icon;
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '0 10px', height: 30, borderRadius: 8,
                  border: `1px solid ${active ? meta.fg : C.border}`,
                  backgroundColor: active ? meta.bg : C.bgElevated,
                  color: active ? meta.fg : C.textSecondary,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms, border-color 150ms',
                }}
              >
                <Icon style={{ height: 12, width: 12 }} strokeWidth={2} />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              height: 14, width: 14, color: C.textTertiary,
            }} strokeWidth={1.75} />
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="Filter by actor (email)"
              style={{
                width: '100%', height: 34, padding: '0 12px 0 30px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                backgroundColor: C.bgElevated, color: C.text,
                fontSize: 13, fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '0 10px', height: 34, borderRadius: 8,
                backgroundColor: 'transparent', color: C.textSecondary,
                border: 'none',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div style={{
        borderRadius: 12, backgroundColor: C.bgElevated,
        border: `1px solid ${C.border}`, overflow: 'hidden',
      }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: C.errorSoft,
            borderBottom: `1px solid ${C.error}`,
            color: C.text, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle style={{ height: 14, width: 14, color: C.error }} strokeWidth={1.75} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: C.textTertiary, fontSize: 14 }}>
            Loading audit events…
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <Shield style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              {hasFilters ? 'No events match your filters' : 'No audit events yet'}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary }}>
              {hasFilters
                ? 'Try clearing the filters or check back later.'
                : 'Events will appear here as admins sign in and invites are created or redeemed.'}
            </div>
          </div>
        ) : (
          <div>
            {events.map((event, idx) => {
              const meta = EVENT_META[event.eventType];
              const Icon = meta.Icon;
              return (
                <button
                  key={event.id}
                  onClick={() => setSelected(event)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
                    backgroundColor: C.bgElevated,
                    border: 'none', borderLeft: 'none', borderRight: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.bgElevated; }}
                >
                  <div style={{
                    height: 32, width: 32, borderRadius: 8,
                    backgroundColor: meta.bg, color: meta.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon style={{ height: 14, width: 14 }} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.actor}
                      </span>
                    </div>
                    {event.targetLabel && (
                      <div style={{
                        fontSize: 12, color: C.textTertiary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {event.targetLabel}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: C.textTertiary }} title={fullTime(event.createdAt)}>
                      {relativeTime(event.createdAt)}
                    </span>
                    <ChevronRight style={{ height: 14, width: 14, color: C.textTertiary }} strokeWidth={1.5} />
                  </div>
                </button>
              );
            })}

            {nextBefore && (
              <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
                <button
                  onClick={() => fetchEvents({ append: true })}
                  disabled={loadingMore}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    backgroundColor: 'transparent', border: `1px solid ${C.border}`,
                    color: C.textSecondary, fontSize: 12, fontWeight: 500,
                    cursor: loadingMore ? 'wait' : 'pointer',
                    opacity: loadingMore ? 0.6 : 1,
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Detail drawer — shows full metadata for a single event
// ────────────────────────────────────────────────────────────────────

function EventDrawer({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  const meta = EVENT_META[event.eventType];
  const Icon = meta.Icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.4)',
          zIndex: 50,
          animation: 'audit-fade-in 150ms ease-out',
        }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: '100%', maxWidth: 480,
        backgroundColor: C.bgElevated,
        zIndex: 51,
        boxShadow: '-12px 0 32px rgba(15,23,42,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'audit-slide-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <style>{`
          @keyframes audit-fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes audit-slide-in { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `}</style>

        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              height: 36, width: 36, borderRadius: 10,
              backgroundColor: meta.bg, color: meta.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon style={{ height: 16, width: 16 }} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{meta.label}</h2>
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{fullTime(event.createdAt)}</div>
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

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <Detail label="Actor" value={event.actor} />
          {event.targetLabel && <Detail label="Target" value={event.targetLabel} />}
          {event.targetId && <Detail label="Target ID" value={event.targetId} mono />}
          <Detail label="Event ID" value={event.id} mono />
          <Detail label="Timestamp" value={event.createdAt} mono />

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: C.textTertiary, marginBottom: 8, fontWeight: 600,
              }}>
                Metadata
              </div>
              <div style={{
                padding: 12, borderRadius: 8,
                backgroundColor: C.bg, border: `1px solid ${C.border}`,
                fontFamily: 'ui-monospace, monospace', fontSize: 12,
                color: C.text,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {JSON.stringify(event.metadata, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: C.textTertiary, marginBottom: 4, fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, color: C.text,
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {value}
      </div>
    </div>
  );
}
