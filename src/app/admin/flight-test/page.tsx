'use client';

/**
 * Flight Hub test rig — /admin/flight-test
 *
 * Internal tool. Type a flight number + date, do a live AeroDataBox lookup, and
 * see BOTH the normalised "what the traveller sees" view and the full raw
 * response. No booking, no subscription, no DB write — pure live explore.
 *
 * Sits behind the same admin middleware as the rest of /admin. The data route
 * (/api/admin/flight-test) is requireAdmin-gated.
 */

import React, { useState } from 'react';
import { Plane, Search, Clock, MapPin, Luggage, DoorOpen, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Normalised {
  statusCode: string;
  depAirportIcao?: string;
  arrAirportIcao?: string;
  depTerminal?: string;
  depGate?: string;
  arrTerminal?: string;
  baggageBelt?: string;
  checkInDesk?: string;
  estDepTime?: string;
  estArrTime?: string;
}

interface ApiResult {
  found: boolean;
  flight: string;
  date: string;
  normalised?: Normalised;
  coverage?: { departure: boolean; arrival: boolean };
  raw?: unknown;
  error?: string;
  hint?: string;
}

const STATUS_TONE: Record<string, string> = {
  Scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  CheckIn: 'bg-cyan-100 text-cyan-800',
  Boarding: 'bg-cyan-100 text-cyan-800',
  GateClosed: 'bg-amber-100 text-amber-800',
  Departed: 'bg-cyan-100 text-cyan-800',
  Delayed: 'bg-amber-100 text-amber-800',
  Approaching: 'bg-cyan-100 text-cyan-800',
  Landed: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-red-100 text-red-800',
  Diverted: 'bg-red-100 text-red-800',
  CancelledUncertain: 'bg-amber-100 text-amber-800',
  Unknown: 'bg-slate-100 text-slate-600',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function FlightTestPage() {
  const [flight, setFlight] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!flight.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/flight-test?flight=${encodeURIComponent(flight.trim())}&date=${encodeURIComponent(date)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      const data = (await res.json()) as ApiResult;
      if (!res.ok) {
        setError(data.hint ? `${data.error} — ${data.hint}` : data.error || 'Lookup failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const n = result?.normalised;

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-tg-text-primary">
          <Plane size={24} className="text-tg-accent" />
          Flight Hub test rig
        </h1>
        <p className="mt-1 text-sm text-tg-text-secondary">
          Live AeroDataBox lookup. Type a flight number and date to see exactly what data we get back —
          no booking or subscription needed.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="flight" className="block text-[13px] font-medium text-tg-text-secondary mb-1">
            Flight number
          </label>
          <input
            id="flight"
            value={flight}
            onChange={(e) => setFlight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="e.g. BA852"
            className="w-full h-11 px-3 rounded-lg border border-tg-border bg-tg-bg-primary text-tg-text-primary
                       focus:outline-none focus:border-tg-accent focus:ring-2 focus:ring-tg-accent/15"
          />
        </div>
        <div className="min-w-[150px]">
          <label htmlFor="date" className="block text-[13px] font-medium text-tg-text-secondary mb-1">
            Departure date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-tg-border bg-tg-bg-primary text-tg-text-primary
                       focus:outline-none focus:border-tg-accent focus:ring-2 focus:ring-tg-accent/15"
          />
        </div>
        <button
          onClick={run}
          disabled={loading || !flight.trim()}
          className="h-11 px-5 inline-flex items-center gap-2 rounded-lg bg-tg-accent text-white font-medium
                     hover:bg-tg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Search size={16} />
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 text-red-800 text-sm mb-6">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Not found */}
      {result && !result.found && (
        <div className="p-6 rounded-lg border border-tg-border bg-tg-bg-secondary text-center text-tg-text-secondary">
          No flight found for <strong className="text-tg-text-primary">{result.flight}</strong> on {result.date}.
          <div className="text-[13px] mt-1">Try a different date, or check the flight number.</div>
        </div>
      )}

      {/* Result */}
      {result && result.found && n && (
        <div className="space-y-5">
          {/* Traveller view */}
          <section className="rounded-xl border border-tg-border overflow-hidden">
            <div className="px-4 py-3 bg-tg-bg-secondary border-b border-tg-border flex items-center justify-between">
              <span className="text-[13px] font-semibold text-tg-text-secondary uppercase tracking-wide">
                What the traveller sees
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[n.statusCode] || STATUS_TONE.Unknown}`}>
                {n.statusCode}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field icon={<MapPin size={14} />} label="Route">
                {n.depAirportIcao || '—'} → {n.arrAirportIcao || '—'}
              </Field>
              <Field icon={<Clock size={14} />} label="Est. departure">{fmtTime(n.estDepTime)}</Field>
              <Field icon={<Clock size={14} />} label="Est. arrival">{fmtTime(n.estArrTime)}</Field>
              <Field icon={<DoorOpen size={14} />} label="Dep. terminal">{n.depTerminal || '—'}</Field>
              <Field icon={<DoorOpen size={14} />} label="Gate">{n.depGate || '—'}</Field>
              <Field icon={<CheckCircle2 size={14} />} label="Check-in desk">{n.checkInDesk || '—'}</Field>
              <Field icon={<DoorOpen size={14} />} label="Arr. terminal">{n.arrTerminal || '—'}</Field>
              <Field icon={<Luggage size={14} />} label="Baggage belt">{n.baggageBelt || '—'}</Field>
            </div>
          </section>

          {/* Coverage */}
          {result.coverage && (
            <div className="flex gap-3 text-[13px]">
              <CoverageChip label={`Departure (${n.depAirportIcao || '?'})`} live={result.coverage.departure} />
              <CoverageChip label={`Arrival (${n.arrAirportIcao || '?'})`} live={result.coverage.arrival} />
            </div>
          )}

          {/* Raw */}
          <section className="rounded-xl border border-tg-border overflow-hidden">
            <div className="px-4 py-3 bg-tg-bg-secondary border-b border-tg-border">
              <span className="text-[13px] font-semibold text-tg-text-secondary uppercase tracking-wide">
                Full raw response
              </span>
            </div>
            <pre className="p-4 text-[12px] leading-relaxed text-tg-text-primary overflow-x-auto font-mono">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </section>
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div className="p-10 rounded-xl border border-dashed border-tg-border text-center text-tg-text-tertiary">
          <Plane size={28} className="mx-auto mb-2 opacity-40" />
          Enter a flight number above to see its live data.
        </div>
      )}
    </main>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-tg-text-tertiary mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-tg-text-primary tabular-nums">{children}</div>
    </div>
  );
}

function CoverageChip({ label, live }: { label: string; live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
        live ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {label}: {live ? 'live coverage' : 'no live feed'}
    </span>
  );
}
