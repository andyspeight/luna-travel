'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, RefreshCw, AlertCircle, Loader2, Search, X, MessageSquare } from 'lucide-react';
import MessageComposer from './MessageComposer';

// Agency-scoped Travellers list. Pure read view: who has joined for this
// agency, live from GET /api/admin/agencies/[id]/travellers (a traveller row
// is created when an invite is redeemed). Shows engagement (status dot, total
// opens, last opened) and a per-row Message action that opens the composer.
// Creating invites lives on the Invite tab. Full-width rows + client-side search.

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
  warning: '#F59E0B',
  error: '#EF4444',
};

type Traveller = {
  id: string;
  name: string | null;
  bookingRef: string | null;
  destination: string | null;
  departureDate: string | null;
  redeemedAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeOpened(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const ms = Date.now() - d.getTime();
  if (ms < 60 * 1000) return 'Just now';
  const days = daysSince(iso) ?? 0;
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

function engagement(t: Traveller): { color: string; label: string } {
  const opens = t.openCount ?? 0;
  if (opens === 0 || !t.lastOpenedAt) return { color: C.textTertiary, label: 'Not opened yet' };
  const days = daysSince(t.lastOpenedAt) ?? 999;
  if (days <= 7) return { color: C.success, label: 'Active' };
  return { color: C.warning, label: `Quiet — last opened ${relativeOpened(t.lastOpenedAt).toLowerCase()}` };
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GRID = '1.8fr 1fr 1.1fr 0.9fr 0.6fr 1fr auto';

export default function TravellersTab({ agency }: { agency: { id: string; name?: string } }) {
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [composeFor, setComposeFor] = useState<Traveller | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agency.id}/travellers`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Could not load travellers (${res.status})`);
      setTravellers(Array.isArray(data.travellers) ? data.travellers : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load travellers');
    } finally {
      setLoading(false);
    }
  }, [agency.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return travellers;
    return travellers.filter((t) =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.bookingRef || '').toLowerCase().includes(q) ||
      (t.destination || '').toLowerCase().includes(q),
    );
  }, [travellers, query]);

  const subtitle = loading ? 'Loading…'
    : error ? 'Could not load'
    : travellers.length === 0 ? 'No travellers have joined yet'
    : query.trim()
      ? `${filtered.length} of ${travellers.length} shown`
      : `${travellers.length} traveller${travellers.length === 1 ? '' : 's'} have joined`;

  return (
    <>
      <style>{`@keyframes tg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{
        borderRadius: 12, backgroundColor: C.bgElevated,
        border: `1px solid ${C.border}`, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Travellers</h2>
            <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{subtitle}</div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              height: 32, padding: '0 12px', borderRadius: 8, flexShrink: 0,
              border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
              color: C.textSecondary, fontSize: 13, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: loading ? 0.6 : 1,
            }}
            aria-label="Refresh travellers"
          >
            <RefreshCw style={{ height: 14, width: 14, animation: loading ? 'tg-spin 1s linear infinite' : 'none' }} strokeWidth={1.75} />
            Refresh
          </button>
        </div>

        {/* Search — only once there is something to search */}
        {!loading && !error && travellers.length > 0 && (
          <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: 16, width: 16, color: C.textTertiary, pointerEvents: 'none' }} strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, booking ref or destination"
                style={{
                  width: '100%', height: 38, padding: '0 36px', borderRadius: 8,
                  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                  color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    height: 24, width: 24, borderRadius: 6, border: 'none',
                    backgroundColor: 'transparent', cursor: 'pointer', color: C.textTertiary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-label="Clear search"
                >
                  <X style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div style={{ padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.textTertiary, fontSize: 14 }}>
            <Loader2 style={{ height: 16, width: 16, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} />
            Loading travellers…
          </div>
        ) : error ? (
          <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertCircle style={{ height: 16, width: 16, color: C.error, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
            <div style={{ fontSize: 13, color: C.text }}>{error}</div>
          </div>
        ) : travellers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Users style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
            <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
              No travellers have joined yet. Create an invite from the Invite tab, then redeem it on a phone to see the traveller appear here.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 14, color: C.textTertiary }}>
            No travellers match &ldquo;{query.trim()}&rdquo;.
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '10px 24px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.textTertiary, fontWeight: 500,
            }}>
              <div>Traveller</div>
              <div>Booking ref</div>
              <div>Destination</div>
              <div>Departs</div>
              <div>Opens</div>
              <div>Last opened</div>
              <div />
            </div>
            {filtered.map((t) => {
              const eng = engagement(t);
              const opens = t.openCount ?? 0;
              return (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '14px 24px', alignItems: 'center',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      title={eng.label}
                      style={{ height: 8, width: 8, borderRadius: '50%', backgroundColor: eng.color, flexShrink: 0 }}
                    />
                    <div style={{
                      height: 32, width: 32, borderRadius: 8, flexShrink: 0,
                      backgroundColor: C.primary, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                    }}>{initials(t.name)}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || 'Unnamed traveller'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.bookingRef || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.destination || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{formatDate(t.departureDate)}</div>
                  <div style={{ fontSize: 13, color: opens === 0 ? C.textTertiary : C.text, fontWeight: opens === 0 ? 400 : 600 }}>
                    {opens}
                  </div>
                  <div
                    style={{ fontSize: 13, color: t.lastOpenedAt ? C.textSecondary : C.textTertiary }}
                    title={t.firstOpenedAt ? `First opened ${formatDate(t.firstOpenedAt)}` : 'Not opened yet'}
                  >
                    {relativeOpened(t.lastOpenedAt)}
                  </div>
                  <div style={{ justifySelf: 'end' }}>
                    <button
                      onClick={() => setComposeFor(t)}
                      style={{
                        height: 30, padding: '0 10px', borderRadius: 7,
                        border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                        color: C.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                      }}
                      aria-label={`Message ${t.name || 'traveller'}`}
                    >
                      <MessageSquare style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                      Message
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {composeFor && (
        <MessageComposer
          agency={agency}
          traveller={{ id: composeFor.id, name: composeFor.name || 'Traveller' }}
          onClose={() => setComposeFor(null)}
        />
      )}
    </>
  );
}
