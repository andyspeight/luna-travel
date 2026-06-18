'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Plane, BedDouble, Compass, Image as ImageIcon, CheckCircle2, Copy, ExternalLink, X, FileUp, Sparkles, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

const C = {
  bg: '#F8FAFC', bgElevated: '#FFFFFF', bgTertiary: '#F1F5F9', border: '#E2E8F0',
  text: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
  primary: '#1B2B5B', accent: '#00B4D8', accentDark: '#0096B7', success: '#10B981', error: '#EF4444',
};

interface Agency { id: string; name: string; contact?: string }
interface FlightRow { carrierCode: string; flightNumber: string; fromIata: string; toIata: string; departAt: string; arriveAt: string; cabin: string }
interface HotelRow { name: string; city: string; country: string; checkIn: string; checkOut: string; board: string; photos: string[] }
interface ExpRow { kind: string; title: string; supplier: string; location: string; startAt: string; endAt: string; notes: string; photos: string[] }

// Form-ready draft returned by /api/admin/import-pdf (photos are added by the admin).
interface ImportedDraft {
  leadFirstName: string; leadLastName: string; leadEmail: string;
  destinationLabel: string; countryCode: string; reference: string;
  flights: FlightRow[];
  hotels: Omit<HotelRow, 'photos'>[];
  experiences: Omit<ExpRow, 'photos'>[];
  warnings: string[];
  source: string;
}

// What we send back at save time so the agency's profile learns from the review.
interface ProfileDraft {
  leadFirstName: string; leadLastName: string; leadEmail: string;
  destinationLabel: string; countryCode: string; reference: string;
  flights: FlightRow[];
  hotels: Omit<HotelRow, 'photos'>[];
  experiences: Omit<ExpRow, 'photos'>[];
}

const BOARDS = [
  { v: '', label: 'Board (optional)' }, { v: 'RO', label: 'Room only' }, { v: 'BB', label: 'Bed & breakfast' },
  { v: 'HB', label: 'Half board' }, { v: 'FB', label: 'Full board' }, { v: 'AI', label: 'All inclusive' },
];
const CABINS = ['Economy', 'PremiumEconomy', 'Business', 'First'];
const EXP_KINDS = [
  { v: 'excursion', label: 'Excursion' }, { v: 'car-hire', label: 'Car hire' },
  { v: 'transfer', label: 'Transfer' }, { v: 'activity', label: 'Activity' }, { v: 'other', label: 'Other' },
];

const emptyFlight = (): FlightRow => ({ carrierCode: '', flightNumber: '', fromIata: '', toIata: '', departAt: '', arriveAt: '', cabin: 'Economy' });
const emptyHotel = (): HotelRow => ({ name: '', city: '', country: '', checkIn: '', checkOut: '', board: '', photos: [] });
const emptyExp = (): ExpRow => ({ kind: 'excursion', title: '', supplier: '', location: '', startAt: '', endAt: '', notes: '', photos: [] });

const toIso = (local: string): string => (local ? `${local}:00.000Z` : '');

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
  const [experiences, setExperiences] = useState<ExpRow[]>([]);

  // The raw draft from the last PDF import (if any) — sent back at save so the
  // agency's profile can learn from whatever the admin corrected.
  const [importedDraft, setImportedDraft] = useState<ImportedDraft | null>(null);
  const [detectedSource, setDetectedSource] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agencies', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.agencies) setAgencies(data.agencies); })
      .catch(() => {});
  }, []);

  const installUrl = result?.inviteId && typeof window !== 'undefined' ? `${window.location.origin}/install?invite=${result.inviteId}` : '';

  // Pre-fill from a PDF import. Only overwrite a field when the draft has a
  // value, and only replace a section's rows when the draft actually has rows —
  // so a flights-only confirmation never wipes a hotel the admin already typed.
  const applyDraft = (d: ImportedDraft) => {
    if (d.leadFirstName) setLeadFirstName(d.leadFirstName);
    if (d.leadLastName) setLeadLastName(d.leadLastName);
    if (d.leadEmail) setLeadEmail(d.leadEmail);
    if (d.destinationLabel) setDestinationLabel(d.destinationLabel);
    if (d.countryCode) setCountryCode(d.countryCode);
    if (d.reference) setReference(d.reference);
    if (d.flights?.length) setFlights(d.flights.map((f) => ({ ...emptyFlight(), ...f })));
    if (d.hotels?.length) setHotels(d.hotels.map((h) => ({ ...emptyHotel(), ...h, photos: [] })));
    if (d.experiences?.length) setExperiences(d.experiences.map((e) => ({ ...emptyExp(), ...e, photos: [] })));
    setImportedDraft(d);
    setDetectedSource(d.source || '');
  };

  // Current form rows as a profile-comparable draft (no photos), for the learn step.
  const buildFinalDraft = (): ProfileDraft => ({
    leadFirstName, leadLastName, leadEmail, destinationLabel, countryCode, reference,
    flights: flights.filter((f) => f.carrierCode || f.flightNumber || f.fromIata || f.toIata),
    hotels: hotels.filter((h) => h.name || h.city).map((h) => ({ name: h.name, city: h.city, country: h.country, checkIn: h.checkIn, checkOut: h.checkOut, board: h.board })),
    experiences: experiences.filter((e) => e.title).map((e) => ({ kind: e.kind, title: e.title, supplier: e.supplier, location: e.location, startAt: e.startAt, endAt: e.endAt, notes: e.notes })),
  });

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
    const cleanExps = experiences
      .filter((e) => e.title && e.startAt)
      .map((e) => ({ kind: e.kind, title: e.title, supplier: e.supplier, location: e.location, startDate: toIso(e.startAt), endDate: toIso(e.endAt), notes: e.notes, photos: e.photos }));
    if (!cleanFlights.length && !cleanHotels.length) return setError('Add at least one complete flight or hotel.');

    const agency = agencies.find((a) => a.id === agencyId);
    const learn = importedDraft
      ? {
          imported: {
            leadFirstName: importedDraft.leadFirstName, leadLastName: importedDraft.leadLastName, leadEmail: importedDraft.leadEmail,
            destinationLabel: importedDraft.destinationLabel, countryCode: importedDraft.countryCode, reference: importedDraft.reference,
            flights: importedDraft.flights, hotels: importedDraft.hotels, experiences: importedDraft.experiences,
          },
          final: buildFinalDraft(),
          source: detectedSource,
        }
      : undefined;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/bookings`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference || undefined, agencyName: agency?.name, agencyEmail: agency?.contact,
          leadFirstName, leadLastName, leadEmail, destinationLabel, countryCode,
          flights: cleanFlights, hotels: cleanHotels, experiences: cleanExps,
          learn,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message || data?.error || 'Could not save booking.'); return; }
      setResult({ reference: data.reference, inviteId: data.inviteId, destinationLabel: data.booking?.destinationLabel || destinationLabel, leadName: data.booking?.leadName || '' });
      if (data.inviteId) {
        try { setQr(await QRCode.toDataURL(`${window.location.origin}/install?invite=${data.inviteId}`, { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#0F172A', light: '#FFFFFF' } })); } catch { /* QR optional */ }
      }
    } catch { setError('Network error — please try again.'); } finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.success, fontWeight: 600, fontSize: 15 }}>
            <CheckCircle2 style={{ height: 18, width: 18 }} strokeWidth={1.75} /> Booking created
          </div>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8 }}>
            <strong>{result.destinationLabel}</strong>{result.leadName ? ` · ${result.leadName}` : ''} · ref <span style={{ fontFamily: 'ui-monospace, monospace' }}>{result.reference}</span>. It&rsquo;s live in the app — scan, enter the email, and it appears.
          </p>
          {qr && (
            <div style={{ marginTop: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Onboarding QR" style={{ height: 160, width: 160, borderRadius: 10, border: `1px solid ${C.border}` }} />
              <div>
                <div style={{ fontSize: 12, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Redeems with</div>
                <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>{leadEmail}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <a href={installUrl} target="_blank" rel="noopener noreferrer" style={btnPrimary}>Open install <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={1.75} /></a>
                  <button onClick={() => { navigator.clipboard.writeText(installUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={btnSecondary(copied)}>
                    {copied ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} /> : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />}{copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => window.location.reload()} style={{ ...btnSecondary(false), marginTop: 24 }}>Add another booking</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Add booking</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, maxWidth: 640 }}>
          Load a full booking that isn&rsquo;t on Travelgenix — flights, hotels, excursions, car hire, transfers, with photos.
          Watch it build in the preview, then onboard the traveller with a QR.
        </p>
      </div>

      <Card title="Client">
        <Field label="Agency" helper="Pick the client first — it applies and improves that client&rsquo;s learned PDF profile.">
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} style={selectStyle}>
            <option value="">Select an agency…</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
          </select>
        </Field>
      </Card>

      <PdfImport agencyId={agencyId} onApply={applyDraft} />

      {error && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, backgroundColor: '#FEF2F2', border: `1px solid ${C.error}`, color: C.error, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* ── Form ── */}
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <Card title="Lead traveller">
            <Grid>
              <Field label="Lead first name"><Input value={leadFirstName} onChange={setLeadFirstName} /></Field>
              <Field label="Lead last name"><Input value={leadLastName} onChange={setLeadLastName} /></Field>
            </Grid>
            <Field label="Lead email" helper="The traveller enters this to redeem."><Input value={leadEmail} onChange={setLeadEmail} type="email" /></Field>
          </Card>

          <Card title="Trip">
            <Grid>
              <Field label="Destination label" helper="e.g. Mallorca"><Input value={destinationLabel} onChange={setDestinationLabel} /></Field>
              <Field label="Country code (ISO-2)" helper="e.g. ES — drives guide, weather & hero"><Input value={countryCode} onChange={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} /></Field>
            </Grid>
            <Field label="Booking reference (optional)" helper="Blank = auto-generate (LT-XXXXXX)."><Input value={reference} onChange={(v) => setReference(v.toUpperCase())} /></Field>
          </Card>

          <Card title="Flights" icon={<Plane style={{ height: 15, width: 15 }} strokeWidth={1.75} />}>
            {flights.map((f, i) => (
              <RowWrap key={i} onRemove={flights.length > 1 ? () => setFlights(flights.filter((_, j) => j !== i)) : undefined}>
                <Grid cols={4}>
                  <Field label="Carrier"><Input value={f.carrierCode} onChange={(v) => setFlights(upd(flights, i, { carrierCode: v.toUpperCase().slice(0, 3) }))} placeholder="BA" /></Field>
                  <Field label="Flight no."><Input value={f.flightNumber} onChange={(v) => setFlights(upd(flights, i, { flightNumber: v.toUpperCase() }))} placeholder="2070" /></Field>
                  <Field label="From"><Input value={f.fromIata} onChange={(v) => setFlights(upd(flights, i, { fromIata: v.toUpperCase().slice(0, 3) }))} placeholder="LGW" /></Field>
                  <Field label="To"><Input value={f.toIata} onChange={(v) => setFlights(upd(flights, i, { toIata: v.toUpperCase().slice(0, 3) }))} placeholder="PMI" /></Field>
                </Grid>
                <Grid cols={3}>
                  <Field label="Departs"><Input value={f.departAt} onChange={(v) => setFlights(upd(flights, i, { departAt: v }))} type="datetime-local" /></Field>
                  <Field label="Arrives"><Input value={f.arriveAt} onChange={(v) => setFlights(upd(flights, i, { arriveAt: v }))} type="datetime-local" /></Field>
                  <Field label="Cabin"><select value={f.cabin} onChange={(e) => setFlights(upd(flights, i, { cabin: e.target.value }))} style={selectStyle}>{CABINS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                </Grid>
              </RowWrap>
            ))}
            <AddButton label="Add flight" onClick={() => setFlights([...flights, emptyFlight()])} />
          </Card>

          <Card title="Hotels" icon={<BedDouble style={{ height: 15, width: 15 }} strokeWidth={1.75} />}>
            {hotels.map((h, i) => (
              <RowWrap key={i} onRemove={hotels.length > 1 ? () => setHotels(hotels.filter((_, j) => j !== i)) : undefined}>
                <Grid><Field label="Hotel name"><Input value={h.name} onChange={(v) => setHotels(upd(hotels, i, { name: v }))} /></Field><Field label="City"><Input value={h.city} onChange={(v) => setHotels(upd(hotels, i, { city: v }))} /></Field></Grid>
                <Grid cols={4}>
                  <Field label="Country"><Input value={h.country} onChange={(v) => setHotels(upd(hotels, i, { country: v }))} placeholder="Spain" /></Field>
                  <Field label="Check-in"><Input value={h.checkIn} onChange={(v) => setHotels(upd(hotels, i, { checkIn: v }))} type="date" /></Field>
                  <Field label="Check-out"><Input value={h.checkOut} onChange={(v) => setHotels(upd(hotels, i, { checkOut: v }))} type="date" /></Field>
                  <Field label="Board"><select value={h.board} onChange={(e) => setHotels(upd(hotels, i, { board: e.target.value }))} style={selectStyle}>{BOARDS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select></Field>
                </Grid>
                <PhotoUploader agencyId={agencyId} photos={h.photos} onChange={(p) => setHotels(upd(hotels, i, { photos: p }))} />
              </RowWrap>
            ))}
            <AddButton label="Add hotel" onClick={() => setHotels([...hotels, emptyHotel()])} />
          </Card>

          <Card title="Excursions, car hire & transfers" icon={<Compass style={{ height: 15, width: 15 }} strokeWidth={1.75} />}>
            {experiences.length === 0 && <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>None yet — add excursions, car hire, transfers or activities.</p>}
            {experiences.map((e, i) => (
              <RowWrap key={i} onRemove={() => setExperiences(experiences.filter((_, j) => j !== i))}>
                <Grid cols={3}>
                  <Field label="Type"><select value={e.kind} onChange={(ev) => setExperiences(upd(experiences, i, { kind: ev.target.value }))} style={selectStyle}>{EXP_KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select></Field>
                  <Field label="Title"><Input value={e.title} onChange={(v) => setExperiences(upd(experiences, i, { title: v }))} placeholder="Catamaran day trip" /></Field>
                  <Field label="Supplier"><Input value={e.supplier} onChange={(v) => setExperiences(upd(experiences, i, { supplier: v }))} /></Field>
                </Grid>
                <Grid cols={3}>
                  <Field label="Location"><Input value={e.location} onChange={(v) => setExperiences(upd(experiences, i, { location: v }))} placeholder="Port d'Alcúdia" /></Field>
                  <Field label="Starts"><Input value={e.startAt} onChange={(v) => setExperiences(upd(experiences, i, { startAt: v }))} type="datetime-local" /></Field>
                  <Field label="Ends (optional)"><Input value={e.endAt} onChange={(v) => setExperiences(upd(experiences, i, { endAt: v }))} type="datetime-local" /></Field>
                </Grid>
                <Field label="Notes (optional)"><Input value={e.notes} onChange={(v) => setExperiences(upd(experiences, i, { notes: v }))} /></Field>
                <PhotoUploader agencyId={agencyId} photos={e.photos} onChange={(p) => setExperiences(upd(experiences, i, { photos: p }))} />
              </RowWrap>
            ))}
            <AddButton label="Add experience" onClick={() => setExperiences([...experiences, emptyExp()])} />
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, height: 40, padding: '0 20px', opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Creating…' : 'Create booking'}</button>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div style={{ flex: '0 0 320px', position: 'sticky', top: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>Live preview</div>
          <Preview destinationLabel={destinationLabel} flights={flights} hotels={hotels} experiences={experiences} leadName={`${leadFirstName} ${leadLastName}`.trim()} />
        </div>
      </div>
    </div>
  );
}

// ───────── Live preview ─────────

interface PreviewItem { kind: string; title: string; sub: string; date: string; photo?: string }

function Preview({ destinationLabel, flights, hotels, experiences, leadName }: { destinationLabel: string; flights: FlightRow[]; hotels: HotelRow[]; experiences: ExpRow[]; leadName: string }) {
  const items: PreviewItem[] = [];
  flights.forEach((f) => { if (f.fromIata && f.toIata && f.departAt) items.push({ kind: 'flight', title: `${f.carrierCode}${f.flightNumber} · ${f.fromIata} → ${f.toIata}`, sub: 'Flight', date: f.departAt }); });
  hotels.forEach((h) => { if (h.name && h.checkIn) items.push({ kind: 'hotel', title: h.name, sub: [h.city, 'check-in'].filter(Boolean).join(' · '), date: h.checkIn, photo: h.photos[0] }); });
  experiences.forEach((e) => { if (e.title && e.startAt) items.push({ kind: e.kind, title: e.title, sub: EXP_KINDS.find((k) => k.v === e.kind)?.label || 'Experience', date: e.startAt, photo: e.photos[0] }); });
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const heroPhoto = hotels.find((h) => h.photos[0])?.photos[0] || experiences.find((e) => e.photos[0])?.photos[0];
  const allDates = items.map((i) => i.date.slice(0, 10)).filter(Boolean).sort();
  const dateRange = allDates.length ? `${fmtD(allDates[0])} – ${fmtD(allDates[allDates.length - 1])}` : 'Dates appear here';

  return (
    <div style={{ width: 300, borderRadius: 28, border: `8px solid #0F172A`, overflow: 'hidden', backgroundColor: C.bg, boxShadow: '0 12px 30px rgba(15,23,42,0.18)' }}>
      {/* hero */}
      <div style={{ height: 150, position: 'relative', background: heroPhoto ? `center/cover no-repeat url("${heroPhoto}")` : 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.65) 100%)' }} />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{destinationLabel || 'Your destination'}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3 }}>{dateRange}</div>
        </div>
      </div>
      {/* body */}
      <div style={{ padding: 14 }}>
        {leadName && <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Welcome, {leadName.split(' ')[0]}</div>}
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textTertiary, textAlign: 'center', padding: '24px 0' }}>Add flights, hotels or experiences to see the itinerary build here.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: C.bgElevated, border: `1px solid ${C.border}` }}>
                {it.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.photo} alt="" style={{ height: 38, width: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ height: 38, width: 38, borderRadius: 8, backgroundColor: C.bgTertiary, color: C.accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{previewIcon(it.kind)}</div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: C.textTertiary }}>{it.sub} · {fmtD(it.date.slice(0, 10))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function previewIcon(kind: string) {
  const s = { height: 16, width: 16 } as const;
  if (kind === 'flight') return <Plane style={s} strokeWidth={1.75} />;
  if (kind === 'hotel') return <BedDouble style={s} strokeWidth={1.75} />;
  return <Compass style={s} strokeWidth={1.75} />;
}
function fmtD(d: string): string {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ───────── Photo uploader ─────────

function PhotoUploader({ agencyId, photos, onChange }: { agencyId: string; photos: string[]; onChange: (p: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!agencyId) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`/api/admin/agencies/${agencyId}/booking-photo`, { method: 'POST', credentials: 'include', body: fd });
        const data = await res.json();
        if (res.ok && data.url) added.push(data.url);
      } catch { /* skip this file */ }
    }
    onChange([...photos, ...added]);
    setBusy(false);
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {photos.map((src, i) => (
          <div key={i} style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={{ height: 48, width: 48, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
            <button onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label="Remove photo" style={{ position: 'absolute', top: -6, right: -6, height: 18, width: 18, borderRadius: 9, border: 'none', background: C.text, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <X style={{ height: 11, width: 11 }} strokeWidth={2.5} />
            </button>
          </div>
        ))}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 48, padding: '0 12px', borderRadius: 8, border: `1px dashed ${C.border}`, color: agencyId ? C.textSecondary : C.textTertiary, fontSize: 12, fontWeight: 500, cursor: agencyId ? 'pointer' : 'not-allowed', backgroundColor: 'transparent' }}>
          <ImageIcon style={{ height: 15, width: 15 }} strokeWidth={1.75} />
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple disabled={!agencyId || busy} onChange={(e) => onFiles(e.target.files)} style={{ display: 'none' }} />
        </label>
      </div>
      {!agencyId && <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>Choose an agency first to upload photos.</div>}
    </div>
  );
}

// ───────── PDF import ─────────

interface ProfileSummary { hints: string; bookingsLearned: number; exampleCount: number; lastLearnedAt: string | null; sources: string[] }

function PdfImport({ agencyId, onApply }: { agencyId: string; onApply: (d: ImportedDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'error'; title: string; lines: string[] } | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [hints, setHints] = useState('');
  const [showHints, setShowHints] = useState(false);
  const [savingHints, setSavingHints] = useState(false);
  const [hintsSaved, setHintsSaved] = useState(false);

  // Load the agency's learned profile whenever the selected client changes.
  useEffect(() => {
    setProfile(null); setShowHints(false); setHintsSaved(false);
    if (!agencyId) return;
    let live = true;
    fetch(`/api/admin/agencies/${agencyId}/extraction-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileSummary | null) => { if (live && data) { setProfile(data); setHints(data.hints || ''); } })
      .catch(() => {});
    return () => { live = false; };
  }, [agencyId]);

  const saveHints = async () => {
    if (!agencyId) return;
    setSavingHints(true); setHintsSaved(false);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/extraction-profile`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hints }),
      });
      const data = await res.json();
      if (res.ok && data.summary) { setProfile(data.summary); setHintsSaved(true); setTimeout(() => setHintsSaved(false), 1500); }
    } catch { /* ignore */ } finally { setSavingHints(false); }
  };

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    if (agencyId) fd.append('agencyId', agencyId);
    try {
      const res = await fetch('/api/admin/import-pdf', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (res.ok && data.ok && data.draft) {
        const d = data.draft as ImportedDraft;
        onApply(d);
        const counts = [
          `${d.flights.length} flight${d.flights.length === 1 ? '' : 's'}`,
          `${d.hotels.length} hotel${d.hotels.length === 1 ? '' : 's'}`,
          ...(d.experiences.length ? [`${d.experiences.length} experience${d.experiences.length === 1 ? '' : 's'}`] : []),
        ].join(' · ');
        const src = d.source ? ` Detected: ${d.source}.` : '';
        setMsg({
          kind: d.warnings?.length ? 'warn' : 'ok',
          title: `Imported ${file.name} — ${counts}.${src} Review and edit below, then create.`,
          lines: d.warnings || [],
        });
      } else {
        setMsg({ kind: 'error', title: data?.error || data?.message || 'Could not read this PDF.', lines: [] });
      }
    } catch {
      setMsg({ kind: 'error', title: 'Network error reading the PDF — please try again.', lines: [] });
    } finally {
      setBusy(false);
    }
  };

  const tone = msg?.kind === 'error'
    ? { bg: '#FEF2F2', border: C.error, text: C.error }
    : msg?.kind === 'warn'
      ? { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' }
      : { bg: '#ECFDF5', border: C.success, text: '#047857' };

  return (
    <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px dashed ${C.accent}`, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ height: 40, width: 40, borderRadius: 10, backgroundColor: '#E0F7FC', color: C.accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles style={{ height: 20, width: 20 }} strokeWidth={1.75} />
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Import from PDF</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            Upload a supplier confirmation, e-ticket or itinerary — Luna reads it and fills in the booking for you to check.
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 8, backgroundColor: busy ? C.bgTertiary : C.primary, color: busy ? C.textSecondary : '#fff', fontSize: 13, fontWeight: 500, cursor: busy ? 'wait' : 'pointer', flexShrink: 0 }}>
          <FileUp style={{ height: 15, width: 15 }} strokeWidth={1.75} />
          {busy ? 'Reading…' : 'Choose PDF'}
          <input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(e) => { onFile(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
        </label>
      </div>

      {/* learned-profile status + notes */}
      {!agencyId && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.textTertiary }}>Choose the client above to apply and improve its learned profile.</div>
      )}
      {agencyId && !profile && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.textTertiary }}>Loading this client&rsquo;s profile…</div>
      )}
      {agencyId && profile && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: C.textSecondary }}>
          <Sparkles style={{ height: 14, width: 14, color: C.accentDark, flexShrink: 0 }} strokeWidth={1.75} />
          {profile.bookingsLearned > 0 ? (
            <span>Luna has learned this client&rsquo;s layout from <strong>{profile.bookingsLearned}</strong> reviewed booking{profile.bookingsLearned === 1 ? '' : 's'}{profile.sources.length ? ` · ${profile.sources.join(', ')}` : ''}.</span>
          ) : (
            <span>No layout learned for this client yet — the first reviewed import starts the profile.</span>
          )}
          <button onClick={() => setShowHints((s) => !s)} style={{ border: 'none', background: 'none', padding: 0, color: C.accentDark, fontSize: 12, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
            {showHints ? 'Hide notes' : 'Extraction notes'}
          </button>
        </div>
      )}
      {agencyId && showHints && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>
            Layout notes for Luna — e.g. &ldquo;dates are DD/MM/YYYY&rdquo;, &ldquo;lead is labelled &lsquo;Lead Pax&rsquo;&rdquo;, &ldquo;board shows as &lsquo;Meal Plan&rsquo;&rdquo;. Applied to every import for this client.
          </label>
          <textarea value={hints} onChange={(e) => setHints(e.target.value)} rows={4} placeholder="No notes yet." style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={saveHints} disabled={savingHints} style={{ ...btnPrimary, height: 32, opacity: savingHints ? 0.6 : 1, cursor: savingHints ? 'not-allowed' : 'pointer' }}>{savingHints ? 'Saving…' : hintsSaved ? 'Saved' : 'Save notes'}</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, backgroundColor: tone.bg, border: `1px solid ${tone.border}`, color: tone.text, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {msg.kind === 'error' || msg.kind === 'warn'
              ? <AlertTriangle style={{ height: 15, width: 15, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
              : <CheckCircle2 style={{ height: 15, width: 15, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />}
            <div>
              <div style={{ fontWeight: 500 }}>{msg.title}</div>
              {msg.lines.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {msg.lines.map((l, i) => <li key={i} style={{ marginTop: 2 }}>{l}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── primitives ─────────

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] { return arr.map((x, j) => (j === i ? { ...x, ...patch } : x)); }

const selectStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, outline: 'none', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, backgroundColor: C.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' };
function btnSecondary(active: boolean): React.CSSProperties { return { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: active ? '#ECFDF5' : C.bgElevated, color: active ? C.success : C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }; }

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: C.text }}>{icon && <span style={{ color: C.accentDark }}>{icon}</span>}<h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) { return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>{children}</div>; }
function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (<div><label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>{label}</label>{children}{helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 5 }}>{helper}</div>}</div>);
}
function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, outline: 'none' }} />;
}
function RowWrap({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', padding: 14, borderRadius: 10, backgroundColor: C.bg, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {onRemove && <button onClick={onRemove} aria-label="Remove" style={{ position: 'absolute', top: 10, right: 10, height: 28, width: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: C.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 style={{ height: 15, width: 15 }} strokeWidth={1.75} /></button>}
      {children}
    </div>
  );
}
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: `1px dashed ${C.border}`, backgroundColor: 'transparent', color: C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-start' }}><Plus style={{ height: 14, width: 14 }} strokeWidth={1.75} />{label}</button>;
}
