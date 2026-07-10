'use client';

/**
 * /agency/trips — the agency's off-platform trips (bookings not in Travelify).
 * List existing trips and build a new one from a manual itinerary. On save the
 * trip is stored and a pending invite is opened so the agency can send access.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Plane, BedDouble, Trash2, Check, MapPin } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn, ghostBtn } from '../portal-chrome';

interface Trip {
  reference: string;
  leadName: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  createdAt: string;
}
interface FlightRow { carrierCode: string; flightNumber: string; fromIata: string; toIata: string; departAt: string; arriveAt: string }
interface HotelRow { name: string; city: string; country: string; checkIn: string; checkOut: string; board: string }

const emptyFlight = (): FlightRow => ({ carrierCode: '', flightNumber: '', fromIata: '', toIata: '', departAt: '', arriveAt: '' });
const emptyHotel = (): HotelRow => ({ name: '', city: '', country: '', checkIn: '', checkOut: '', board: '' });

function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; inviteError: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/bookings', { cache: 'no-store' });
      if (res.ok) setTrips((await res.json()).bookings ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Trips</h1>
          <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
            Build trips that aren&rsquo;t in Travelify. Each becomes a full app for your traveller —
            itinerary, live flights, documents and more.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => { setShowForm(true); setSuccess(null); }} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <Plus size={16} /> Add trip
          </button>
        )}
      </div>

      {success && (
        <div style={{ ...card, padding: 16, marginTop: 16, borderColor: '#a7f3d0', background: '#ecfdf5' }} className="animate-slide-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', fontWeight: 700, fontSize: 14 }}>
            <Check size={16} /> Trip {success.reference} created
          </div>
          <p style={{ fontSize: 13, color: P.ink2, marginTop: 6, lineHeight: 1.5 }}>
            {success.inviteError
              ? 'The trip was saved, but the access invite failed to open — create one from Send access.'
              : 'An access invite is ready. '}
            <Link href="/agency/access" style={{ color: P.tealDark, fontWeight: 600 }}>Send access →</Link>
          </p>
        </div>
      )}

      {showForm && (
        <TripForm
          onCancel={() => setShowForm(false)}
          onCreated={(reference, inviteError) => { setShowForm(false); setSuccess({ reference, inviteError }); void load(); }}
        />
      )}

      {/* Trip list */}
      <div style={{ marginTop: 26 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 20, color: P.ink, margin: 0 }}>Your trips</h2>
        {loading ? (
          <p style={{ color: P.ink3, fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : trips.length === 0 ? (
          <div style={{ ...card, padding: 22, marginTop: 12, textAlign: 'center', color: P.ink3, fontSize: 13.5 }}>
            No trips yet. Add your first above.
          </div>
        ) : (
          <div style={{ ...card, marginTop: 12, overflow: 'hidden' }}>
            {trips.map((t, i) => (
              <div key={t.reference} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: `${P.teal}14`, color: P.tealDark, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>{t.destination || 'Trip'}</div>
                  <div style={{ fontSize: 12, color: P.ink3, marginTop: 2 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{t.reference}</span>
                    {t.leadName ? ` · ${t.leadName}` : ''}{t.departureDate ? ` · ${fmt(t.departureDate)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (ref: string, inviteError: boolean) => void }) {
  const [leadFirstName, setLeadFirstName] = useState('');
  const [leadLastName, setLeadLastName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [flights, setFlights] = useState<FlightRow[]>([emptyFlight()]);
  const [hotels, setHotels] = useState<HotelRow[]>([emptyHotel()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    const cleanFlights = flights.filter((f) => f.carrierCode && f.flightNumber && f.fromIata && f.toIata && f.departAt && f.arriveAt);
    const cleanHotels = hotels.filter((h) => h.name && h.checkIn && h.checkOut);
    try {
      const res = await fetch('/api/agency/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadFirstName, leadLastName, leadEmail, destinationLabel, countryCode,
          flights: cleanFlights.map((f) => ({ ...f, departAt: toIso(f.departAt), arriveAt: toIso(f.arriveAt) })),
          hotels: cleanHotels.map((h) => ({ name: h.name, city: h.city, country: h.country || destinationLabel, checkIn: h.checkIn, checkOut: h.checkOut, board: h.board || undefined })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message || prettyError(data.error)); setSaving(false); return; }
      onCreated(data.reference, !!data.inviteError);
    } catch {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div style={{ ...card, padding: 20, marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Callout title="Add a trip">
          Enter the lead traveller and destination, then the flights and hotels. Leave a section empty
          if it doesn&rsquo;t apply — you need at least one flight or hotel.
        </Callout>
      </div>

      <Grid>
        <Field label="Lead first name"><input value={leadFirstName} onChange={(e) => setLeadFirstName(e.target.value)} style={inp} /></Field>
        <Field label="Lead last name"><input value={leadLastName} onChange={(e) => setLeadLastName(e.target.value)} style={inp} /></Field>
      </Grid>
      <Grid>
        <Field label="Lead email"><input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="traveller@example.com" style={inp} /></Field>
      </Grid>
      <Grid>
        <Field label="Destination" hint="e.g. Santorini"><input value={destinationLabel} onChange={(e) => setDestinationLabel(e.target.value)} style={inp} /></Field>
        <Field label="Country code" hint="2 letters, e.g. GR"><input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} style={inp} /></Field>
      </Grid>

      {/* Flights */}
      <Section icon={<Plane size={15} />} title="Flights" onAdd={() => setFlights((f) => [...f, emptyFlight()])}>
        {flights.map((f, i) => (
          <RepeatRow key={i} onRemove={flights.length > 1 ? () => setFlights((arr) => arr.filter((_, j) => j !== i)) : undefined}>
            <div style={rowGrid}>
              <input placeholder="Airline (BA)" value={f.carrierCode} onChange={(e) => upd(setFlights, i, 'carrierCode', e.target.value.toUpperCase())} style={inpSm} />
              <input placeholder="No. (2119)" value={f.flightNumber} onChange={(e) => upd(setFlights, i, 'flightNumber', e.target.value)} style={inpSm} />
              <input placeholder="From (LHR)" value={f.fromIata} onChange={(e) => upd(setFlights, i, 'fromIata', e.target.value.toUpperCase())} maxLength={3} style={inpSm} />
              <input placeholder="To (JTR)" value={f.toIata} onChange={(e) => upd(setFlights, i, 'toIata', e.target.value.toUpperCase())} maxLength={3} style={inpSm} />
            </div>
            <div style={rowGrid2}>
              <label style={lbl}>Departs <input type="datetime-local" value={f.departAt} onChange={(e) => upd(setFlights, i, 'departAt', e.target.value)} style={inpSm} /></label>
              <label style={lbl}>Arrives <input type="datetime-local" value={f.arriveAt} onChange={(e) => upd(setFlights, i, 'arriveAt', e.target.value)} style={inpSm} /></label>
            </div>
          </RepeatRow>
        ))}
      </Section>

      {/* Hotels */}
      <Section icon={<BedDouble size={15} />} title="Hotels" onAdd={() => setHotels((h) => [...h, emptyHotel()])}>
        {hotels.map((h, i) => (
          <RepeatRow key={i} onRemove={hotels.length > 1 ? () => setHotels((arr) => arr.filter((_, j) => j !== i)) : undefined}>
            <div style={rowGrid}>
              <input placeholder="Hotel name" value={h.name} onChange={(e) => upd(setHotels, i, 'name', e.target.value)} style={{ ...inpSm, gridColumn: '1 / 3' }} />
              <input placeholder="City" value={h.city} onChange={(e) => upd(setHotels, i, 'city', e.target.value)} style={inpSm} />
              <input placeholder="Board (AI)" value={h.board} onChange={(e) => upd(setHotels, i, 'board', e.target.value.toUpperCase())} style={inpSm} />
            </div>
            <div style={rowGrid2}>
              <label style={lbl}>Check-in <input type="date" value={h.checkIn} onChange={(e) => upd(setHotels, i, 'checkIn', e.target.value)} style={inpSm} /></label>
              <label style={lbl}>Check-out <input type="date" value={h.checkOut} onChange={(e) => upd(setHotels, i, 'checkOut', e.target.value)} style={inpSm} /></label>
            </div>
          </RepeatRow>
        ))}
      </Section>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Create trip'}
        </button>
        <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function upd<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, key: keyof T, value: any) {
  setter((arr) => arr.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
}
function toIso(local: string): string {
  // datetime-local yields "YYYY-MM-DDTHH:mm" (no zone); treat as UTC-ish ISO.
  return local ? `${local}:00` : '';
}
function fmt(d: string): string {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}
function prettyError(code?: string): string {
  switch (code) {
    case 'lead_required': return 'Lead traveller name is required.';
    case 'email_invalid': return 'A valid lead email is required.';
    case 'destination_required': return 'Destination is required.';
    case 'country_code_invalid': return 'Country code must be 2 letters (e.g. GR).';
    case 'empty_booking': return 'Add at least one flight or hotel.';
    case 'reference_exists': return 'That booking reference already exists.';
    case 'agency_inactive': return 'This agency is no longer active — contact Luna Travel.';
    default: return 'Could not save the trip. Please try again.';
  }
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>{children}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: '1 1 160px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: P.ink3, marginTop: 4 }}>{hint}</div>}
    </label>
  );
}
function Section({ icon, title, onAdd, children }: { icon: React.ReactNode; title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, borderTop: `1px solid ${P.line}`, paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: P.tealDark }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>{title}</span>
        <button type="button" onClick={onAdd} style={{ ...ghostBtn, marginLeft: 'auto', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Add
        </button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}
function RepeatRow({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ background: P.bg, border: `1px solid ${P.line}`, borderRadius: 12, padding: 12, position: 'relative' }}>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove" style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: P.ink3, cursor: 'pointer' }}>
          <Trash2 size={15} />
        </button>
      )}
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', border: `1px solid ${P.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: P.ink, background: '#fff', boxSizing: 'border-box', outlineColor: P.teal };
const inpSm: React.CSSProperties = { ...inp, padding: '8px 10px', fontSize: 13 };
const rowGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 };
const rowGrid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: P.ink3, display: 'grid', gap: 4 };

export default function AgencyTripsPage() {
  return (
    <AgencyShell active="trips">
      <Trips />
    </AgencyShell>
  );
}
