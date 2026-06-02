'use client';

/**
 * Flight Hub test rig — /admin/flight-test
 *
 * Renders the REAL traveller flight card (shared component) in a phone frame
 * plus the full raw response. The synthesised leg uses SCHEDULED times only as
 * its baseline, while the live overlay carries the REVISED times — so the
 * card's strike-through logic shows revisions correctly (same as production,
 * where booked time and live time are genuinely independent sources).
 */

import React, { useState } from 'react';
import { Plane, Search, AlertTriangle } from 'lucide-react';
import { FlightHero, LiveNowPanel, AircraftPanel } from '@/components/flight-card';
import type { FlightLeg, FlightLiveStatus } from '@/types/booking';

interface Normalised {
  statusCode: string;
  airlineName?: string;
  depAirportIata?: string;
  depAirportIcao?: string;
  depAirportName?: string;
  arrAirportIata?: string;
  arrAirportIcao?: string;
  arrAirportName?: string;
  depTerminal?: string;
  depGate?: string;
  arrTerminal?: string;
  baggageBelt?: string;
  checkInDesk?: string;
  schedDepTime?: string;
  estDepTime?: string;
  schedArrTime?: string;
  estArrTime?: string;
  aircraftModel?: string;
  aircraftReg?: string;
  liveLat?: number;
  liveLon?: number;
  liveAltitudeFt?: number;
  liveSpeedKt?: number;
  liveReportedAt?: string;
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Leg baseline = SCHEDULED times only (so revised shows as a change). */
function toFlightLeg(flightLabel: string, n: Normalised): FlightLeg {
  const carrierMatch = flightLabel.match(/^([A-Z0-9]{2,3}?)(\d.*)$/);
  const carrierCode = carrierMatch?.[1] ?? flightLabel.slice(0, 2);
  const flightNumber = carrierMatch?.[2] ?? flightLabel;
  const depISO = n.schedDepTime || n.estDepTime || new Date().toISOString();
  const arrISO = n.schedArrTime || n.estArrTime || depISO;
  const durMin = Math.max(
    0,
    Math.round((new Date(arrISO).getTime() - new Date(depISO).getTime()) / 60000),
  );
  return {
    id: 'rig-preview',
    carrierCode,
    carrierName: n.airlineName || carrierCode,
    flightNumber,
    cabin: 'Economy',
    depAirport: n.depAirportIata || n.depAirportIcao || '—',
    depAirportName: n.depAirportName || '',
    depCity: '',
    depTime: depISO,
    depTerminal: n.depTerminal,
    arrAirport: n.arrAirportIata || n.arrAirportIcao || '—',
    arrAirportName: n.arrAirportName || '',
    arrCity: '',
    arrTime: arrISO,
    arrTerminal: n.arrTerminal,
    durationMinutes: durMin,
    aircraft: n.aircraftModel,
  };
}

/** Overlay = REVISED times + live ops + aircraft + position. */
function toLive(n: Normalised): FlightLiveStatus {
  return {
    flightLegId: 'rig-preview',
    statusCode: n.statusCode as FlightLiveStatus['statusCode'],
    estDepTime: n.estDepTime,
    estArrTime: n.estArrTime,
    depTerminalLive: n.depTerminal,
    depGate: n.depGate,
    arrTerminalLive: n.arrTerminal,
    baggageBelt: n.baggageBelt,
    checkInDesk: n.checkInDesk,
    aircraftModel: n.aircraftModel,
    aircraftReg: n.aircraftReg,
    liveLat: n.liveLat,
    liveLon: n.liveLon,
    liveAltitudeFt: n.liveAltitudeFt,
    liveSpeedKt: n.liveSpeedKt,
    liveReportedAt: n.liveReportedAt,
    hasLiveCoverage: true,
    lastUpdated: new Date().toISOString(),
    watchState: 'active',
  };
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
  const leg = result?.found && n ? toFlightLeg(result.flight, n) : null;
  const live = result?.found && n ? toLive(n) : null;

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-tg-text-primary">
          <Plane size={24} className="text-tg-accent" />
          Flight Hub test rig
        </h1>
        <p className="mt-1 text-sm text-tg-text-secondary">
          Live AeroDataBox lookup. Type a flight number and date to preview the real traveller card and
          see the full data — no booking or subscription needed.
        </p>
      </header>

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

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 text-red-800 text-sm mb-6">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && !result.found && (
        <div className="p-6 rounded-lg border border-tg-border bg-tg-bg-secondary text-center text-tg-text-secondary">
          No flight found for <strong className="text-tg-text-primary">{result.flight}</strong> on {result.date}.
          <div className="text-[13px] mt-1">Try a different date, or check the flight number.</div>
        </div>
      )}

      {result && result.found && leg && live && (
        <div className="grid md:grid-cols-[380px_1fr] gap-6 items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-tg-text-tertiary mb-2">
              What the traveller sees
            </div>
            <div className="mx-auto w-[360px] max-w-full rounded-[2rem] border-4 border-slate-800 bg-surface overflow-hidden shadow-xl">
              <FlightHero flight={leg} live={live} />
              <div className="px-5 py-4 space-y-3">
                <LiveNowPanel flight={leg} live={live} />
                <AircraftPanel live={live} />
              </div>
            </div>
            {result.coverage && (
              <div className="flex flex-wrap gap-2 mt-3">
                <CoverageChip label={`Dep ${leg.depAirport}`} live={result.coverage.departure} />
                <CoverageChip label={`Arr ${leg.arrAirport}`} live={result.coverage.arrival} />
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-tg-text-tertiary mb-2">
              Full raw response
            </div>
            <pre className="p-4 rounded-xl border border-tg-border bg-tg-bg-secondary text-[12px] leading-relaxed
                            text-tg-text-primary overflow-x-auto font-mono max-h-[640px]">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <div className="p-10 rounded-xl border border-dashed border-tg-border text-center text-tg-text-tertiary">
          <Plane size={28} className="mx-auto mb-2 opacity-40" />
          Enter a flight number above to preview its live card.
        </div>
      )}
    </main>
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
      {label}: {live ? 'live' : 'no feed'}
    </span>
  );
}
