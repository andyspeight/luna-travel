'use client';

/**
 * /agency/flights — read-only live status of the agency's travellers' upcoming
 * flights (gate, terminal, delays, cancellations), so the agent can see at a
 * glance if anyone's trip needs attention. Scoped to the session's agency.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plane, RefreshCw, MapPin } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card } from '../portal-chrome';

interface Flight {
  bookingRef: string | null;
  travellerName: string | null;
  destination: string | null;
  flightNumber: string | null;
  depIcao: string | null;
  arrIcao: string | null;
  depDate: string | null;
  statusCode: string;
  estDepTime: string | null;
  actualDepTime: string | null;
  depTerminal: string | null;
  depGate: string | null;
  checkInDesk: string | null;
  boardingAt: string | null;
  hasLiveCoverage: boolean;
  lastUpdated: string | null;
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted';
const TONE: Record<Tone, { fg: string; bg: string }> = {
  ok: { fg: '#047857', bg: '#d1fae5' },
  warn: { fg: '#b45309', bg: '#fef3c7' },
  bad: { fg: '#b91c1c', bg: '#fee2e2' },
  muted: { fg: '#64748b', bg: '#f1f5f9' },
};

function statusMeta(code: string): { label: string; tone: Tone } {
  switch (code) {
    case 'Cancelled': return { label: 'Cancelled', tone: 'bad' };
    case 'Delayed': return { label: 'Delayed', tone: 'warn' };
    case 'GateClosed': return { label: 'Gate closed', tone: 'warn' };
    case 'Diverted': return { label: 'Diverted', tone: 'warn' };
    case 'CancelledUncertain': return { label: 'Cancellation risk', tone: 'warn' };
    case 'Boarding': return { label: 'Boarding', tone: 'ok' };
    case 'CheckIn': return { label: 'Check-in open', tone: 'ok' };
    case 'Departed': return { label: 'Departed', tone: 'ok' };
    case 'Approaching': return { label: 'Approaching', tone: 'ok' };
    case 'Landed': return { label: 'Landed', tone: 'ok' };
    case 'Scheduled': return { label: 'On time', tone: 'ok' };
    default: return { label: 'Scheduled', tone: 'muted' };
  }
}

function FlightsPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agency/flights', { cache: 'no-store' });
      if (res.ok) setFlights((await res.json()).flights ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const needsAttention = flights.filter((f) => ['Cancelled', 'Delayed', 'Diverted', 'CancelledUncertain', 'GateClosed'].includes(f.statusCode)).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Flights</h1>
          <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
            Live status of your travellers&rsquo; upcoming flights — gates, delays and cancellations,
            the moment they change.
          </p>
        </div>
        <button type="button" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${P.line}`, background: '#fff', color: P.ink2, fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {!loading && flights.length > 0 && needsAttention > 0 && (
        <div style={{ marginTop: 16, padding: '11px 15px', borderRadius: 12, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: 13.5, fontWeight: 600 }}>
          {needsAttention} {needsAttention === 1 ? 'flight needs' : 'flights need'} attention (delay, gate change or cancellation).
        </div>
      )}

      {loading && flights.length === 0 ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : flights.length === 0 ? (
        <div style={{ marginTop: 18 }}>
          <Callout title="No flights being tracked yet" icon={<Plane size={16} />}>
            Once a traveller&rsquo;s trip includes a flight we&rsquo;re watching, its live status shows
            up here — no action needed from you.
          </Callout>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {flights.map((f, i) => <FlightCard key={i} f={f} />)}
        </div>
      )}

      <style>{`.spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function FlightCard({ f }: { f: Flight }) {
  const s = statusMeta(f.statusCode);
  const revised = f.actualDepTime || f.estDepTime;
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${P.navy}0d`, color: P.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plane size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: P.ink, fontFamily: 'ui-monospace, monospace' }}>{f.flightNumber || 'Flight'}</span>
            {(f.depIcao || f.arrIcao) && (
              <span style={{ fontSize: 12.5, color: P.ink3, fontFamily: 'ui-monospace, monospace' }}>{f.depIcao || '???'} → {f.arrIcao || '???'}</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {f.travellerName && <span>{f.travellerName}</span>}
            {f.destination && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>· <MapPin size={11} /> {f.destination}</span>}
            {f.depDate && <span>· {fmtDate(f.depDate)}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: TONE[s.tone].fg, background: TONE[s.tone].bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {s.label}
        </span>
      </div>

      {/* details */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.line}` }}>
        <Detail label="Terminal" value={f.depTerminal} />
        <Detail label="Gate" value={f.depGate} />
        <Detail label="Check-in" value={f.checkInDesk} />
        <Detail label="Departs" value={revised ? fmtTime(revised) : null} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: P.ink3 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: f.hasLiveCoverage ? '#10b981' : '#cbd5e1', display: 'inline-block' }} />
        {f.hasLiveCoverage ? 'Live tracking' : 'Scheduled data'}
        {f.lastUpdated && <span>· updated {fmtTime(f.lastUpdated)}</span>}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ minWidth: 54 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: P.ink3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: value ? P.ink : P.ink3, marginTop: 1 }}>{value || '—'}</div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AgencyFlightsPage() {
  return (
    <AgencyShell active="flights">
      <FlightsPage />
    </AgencyShell>
  );
}
