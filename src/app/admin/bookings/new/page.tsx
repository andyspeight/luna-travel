'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Plane, BedDouble, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';

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
  accentDark: '#0096B7',
  success: '#10B981',
  error: '#EF4444',
};

interface Agency { id: string; name: string; contact?: string }
interface FlightRow { carrierCode: string; flightNumber: string; fromIata: string; toIata: string; departAt: string; arriveAt: string; cabin: string }
interface HotelRow { name: string; city: string; country: string; checkIn: string; checkOut: string; board: string }

const BOARDS = [
  { v: '', label: 'Board (optional)' },
  { v: 'RO', label: 'Room only' },
  { v: 'BB', label: 'Bed & breakfast' },
  { v: 'HB', label: 'Half board' },
  { v: 'FB', label: 'Full board' },
  { v: 'AI', label: 'All inclusive' },
];
const CABINS = ['Economy', 'PremiumEconomy', 'Business', 'First'];

const emptyFlight = (): FlightRow => ({ carrierCode: '', flightNumber: '', fromIata: '', toIata: '', departAt: '', arriveAt: '', cabin: 'Economy' });
const emptyHotel = (): HotelRow => ({ name: '', city: '', country: '', checkIn: '', checkOut: '', board: '' });

function toIso(local: string): string {
  // datetime-local => "YYYY-MM-DDTHH:mm"; treat as the airport-local wall time.
  return local ? `${local}:00.000Z` : '';
}

interface Result { reference: string; inviteId: string | null; destinationLabel: string; leadName: string }

export default function NewBookingPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [leadFirstName, setLeadFirstName] = useState('');
  const [leadLastName, setLeadLastName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [reference, setReference] = useState('');
  const [flights, setFlights] = useState<FlightRow[]>([emptyFlight()]);
  const [hotels, setHotels] = useState<HotelRow[]>([emptyHotel()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agencies', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.agencies) setAgencies(data.agencies); })
      .catch(() => {});
  }, []);

  const installUrl = result?.inviteId && typeof window !== 'undefined'
    ? `${window.location.origin}/install?invite=${result.inviteId}`
    : '';

  const submit = async () => {
    setError(null);
    if (!agencyId) return setError('Choose an agency.');
    if (!leadFirstName || !leadLastName) return setError('Lead traveller name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) return setError('A valid lead email is required.');
    if (!destinationLabel) return setError('Destination is required.');
    if (!/^[A-Za-z]{2}$/.test(countryCode)) return setError('Country code must be 2 letters (ISO-2), e.g. ES.');

    const cleanFlights = flights
      .filter((f) => f.carrierCode && f.flightNumber && f.fromIata && f.toIata && f.departAt && f.arriveAt)
      .map((f) => ({ ...f, departAt: toIso(f.departAt), arriveAt: toIso(f.arriveAt) }));
    const cleanHotels = hotels.filter((h) => h.name && h.city && h.checkIn && h.checkOut);
    if (!cleanFlights.length && !cleanHotels.length) return setError('Add at least one complete flight or hotel.');

    const agency = agencies.find((a) => a.id === agencyId);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/bookings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference || undefined,
          agencyName: agency?.name, agencyEmail: agency?.contact,
          leadFirstName, leadLastName, leadEmail,
          destinationLabel, countryCode,
          flights: cleanFlights, hotels: cleanHotels,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || 'Could not save booking.');
        return;
      }
      const r: Result = { reference: data.reference, inviteId: data.inviteId, destinationLabel: data.booking?.destinationLabel || destinationLabel, leadName: data.booking?.leadName || '' };
      setResult(r);
      if (data.inviteId) {
        try {
          setQr(await QRCode.toDataURL(`${window.location.origin}/install?invite=${data.inviteId}`, { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#0F172A', light: '#FFFFFF' } }));
        } catch { /* QR optional */ }
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null); setQr(''); setError(null);
    setLeadFirstName(''); setLeadLastName(''); setLeadEmail('');
    setDestinationLabel(''); setCountryCode(''); setReference('');
    setFlights([emptyFlight()]); setHotels([emptyHotel()]);
  };

  if (result) {
    return (
      <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.success, fontWeight: 600, fontSize: 15 }}>
            <CheckCircle2 style={{ height: 18, width: 18 }} strokeWidth={1.75} /> Booking created
          </div>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8 }}>
            <strong>{result.destinationLabel}</strong>{result.leadName ? ` · ${result.leadName}` : ''} · reference <span style={{ fontFamily: 'ui-monospace, monospace' }}>{result.reference}</span>.
            It&rsquo;s now live in the app — the traveller scans the QR, enters their email, and the booking appears.
          </p>

          {qr && (
            <div style={{ marginTop: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Onboarding QR" style={{ height: 160, width: 160, borderRadius: 10, border: `1px solid ${C.border}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traveller redeems with</div>
                <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>{leadEmail || result.leadName}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <a href={installUrl} target="_blank" rel="noopener noreferrer" style={btnPrimary}>Open install <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={1.75} /></a>
                  <button onClick={() => { navigator.clipboard.writeText(installUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={btnSecondary(copied)}>
                    {copied ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} /> : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />}{copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button onClick={reset} style={{ ...btnSecondary(false), marginTop: 24 }}>Add another booking</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Add booking</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, maxWidth: 640 }}>
          Load a booking that isn&rsquo;t on Travelgenix. Enter the details below; the traveller onboards with a QR and gets
          the full app — itinerary, live flights, Luna and the destination guide.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, backgroundColor: '#FEF2F2', border: `1px solid ${C.error}`, color: C.error, fontSize: 13 }}>{error}</div>
      )}

      <Card title="Agency & traveller">
        <Field label="Agency">
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} style={selectStyle}>
            <option value="">Select an agency…</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
          </select>
        </Field>
        <Grid>
          <Field label="Lead first name"><Input value={leadFirstName} onChange={setLeadFirstName} /></Field>
          <Field label="Lead last name"><Input value={leadLastName} onChange={setLeadLastName} /></Field>
        </Grid>
        <Field label="Lead email" helper="The traveller enters this to redeem."><Input value={leadEmail} onChange={setLeadEmail} type="email" /></Field>
      </Card>

      <Card title="Trip">
        <Grid>
          <Field label="Destination label" helper="e.g. Mallorca"><Input value={destinationLabel} onChange={setDestinationLabel} /></Field>
          <Field label="Country code (ISO-2)" helper="e.g. ES — drives the guide, weather & hero"><Input value={countryCode} onChange={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} /></Field>
        </Grid>
        <Field label="Booking reference (optional)" helper="Leave blank to auto-generate (LT-XXXXXX)."><Input value={reference} onChange={(v) => setReference(v.toUpperCase())} /></Field>
      </Card>

      <Card title="Flights" icon={<Plane style={{ height: 15, width: 15 }} strokeWidth={1.75} />}>
        {flights.map((f, i) => (
          <RowWrap key={i} onRemove={flights.length > 1 ? () => setFlights(flights.filter((_, j) => j !== i)) : undefined}>
            <Grid cols={4}>
              <Field label="Carrier"><Input value={f.carrierCode} onChange={(v) => setFlights(upd(flights, i, { carrierCode: v.toUpperCase().slice(0, 3) }))} placeholder="BA" /></Field>
              <Field label="Flight no."><Input value={f.flightNumber} onChange={(v) => setFlights(upd(flights, i, { flightNumber: v.toUpperCase() }))} placeholder="2070" /></Field>
              <Field label="From (IATA)"><Input value={f.fromIata} onChange={(v) => setFlights(upd(flights, i, { fromIata: v.toUpperCase().slice(0, 3) }))} placeholder="LGW" /></Field>
              <Field label="To (IATA)"><Input value={f.toIata} onChange={(v) => setFlights(upd(flights, i, { toIata: v.toUpperCase().slice(0, 3) }))} placeholder="PMI" /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Departs"><Input value={f.departAt} onChange={(v) => setFlights(upd(flights, i, { departAt: v }))} type="datetime-local" /></Field>
              <Field label="Arrives"><Input value={f.arriveAt} onChange={(v) => setFlights(upd(flights, i, { arriveAt: v }))} type="datetime-local" /></Field>
              <Field label="Cabin">
                <select value={f.cabin} onChange={(e) => setFlights(upd(flights, i, { cabin: e.target.value }))} style={selectStyle}>
                  {CABINS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </Grid>
          </RowWrap>
        ))}
        <AddButton label="Add flight" onClick={() => setFlights([...flights, emptyFlight()])} />
      </Card>

      <Card title="Hotels" icon={<BedDouble style={{ height: 15, width: 15 }} strokeWidth={1.75} />}>
        {hotels.map((h, i) => (
          <RowWrap key={i} onRemove={hotels.length > 1 ? () => setHotels(hotels.filter((_, j) => j !== i)) : undefined}>
            <Grid>
              <Field label="Hotel name"><Input value={h.name} onChange={(v) => setHotels(upd(hotels, i, { name: v }))} /></Field>
              <Field label="City"><Input value={h.city} onChange={(v) => setHotels(upd(hotels, i, { city: v }))} /></Field>
            </Grid>
            <Grid cols={4}>
              <Field label="Country"><Input value={h.country} onChange={(v) => setHotels(upd(hotels, i, { country: v }))} placeholder="Spain" /></Field>
              <Field label="Check-in"><Input value={h.checkIn} onChange={(v) => setHotels(upd(hotels, i, { checkIn: v }))} type="date" /></Field>
              <Field label="Check-out"><Input value={h.checkOut} onChange={(v) => setHotels(upd(hotels, i, { checkOut: v }))} type="date" /></Field>
              <Field label="Board">
                <select value={h.board} onChange={(e) => setHotels(upd(hotels, i, { board: e.target.value }))} style={selectStyle}>
                  {BOARDS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                </select>
              </Field>
            </Grid>
          </RowWrap>
        ))}
        <AddButton label="Add hotel" onClick={() => setHotels([...hotels, emptyHotel()])} />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, height: 40, padding: '0 20px', opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Creating…' : 'Create booking'}
        </button>
      </div>
    </div>
  );
}

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
}

const selectStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text,
  fontSize: 14, outline: 'none', cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
  borderRadius: 8, backgroundColor: C.primary, color: '#fff', border: 'none',
  fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer',
};
function btnSecondary(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
    borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: active ? '#ECFDF5' : C.bgElevated,
    color: active ? C.success : C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: C.text }}>
        {icon && <span style={{ color: C.accentDark }}>{icon}</span>}
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>{children}</div>;
}
function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>{label}</label>
      {children}
      {helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 5 }}>{helper}</div>}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, outline: 'none' }}
    />
  );
}
function RowWrap({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', padding: 14, borderRadius: 10, backgroundColor: C.bg, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" style={{ position: 'absolute', top: 10, right: 10, height: 28, width: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: C.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 style={{ height: 15, width: 15 }} strokeWidth={1.75} />
        </button>
      )}
      {children}
    </div>
  );
}
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: `1px dashed ${C.border}`, backgroundColor: 'transparent', color: C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-start' }}>
      <Plus style={{ height: 14, width: 14 }} strokeWidth={1.75} />{label}
    </button>
  );
}
