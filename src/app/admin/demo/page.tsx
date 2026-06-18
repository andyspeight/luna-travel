'use client';

import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle2, ExternalLink, QrCode, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { BOOKINGS } from '@/data/mock-bookings';
import type { Booking } from '@/types/booking';

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
};

interface DemoBooking {
  inviteId: string;
  agencyId: string;
  bookingRef: string;
  email: string | null;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
  leadName: string | null;
}

const STEPS = [
  'Scan the QR — install page, booking reference pre-filled.',
  'Enter the email + departure date — validates against the agency’s own Travelify and reveals the Holiday Pass.',
  'Add to Home Screen — install the PWA.',
  'Open the app — full booking: itinerary, flights, hotels, documents.',
  'Live flights, agency messages, and Luna’s answers all work on the live booking.',
];

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00Z' : d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function leadOf(b: Booking): string {
  const lead = b.travellers.find((t) => t.isLead) ?? b.travellers[0];
  return lead ? `${lead.firstName} ${lead.lastName}`.trim() : '—';
}

function shapeOf(b: Booking): string {
  const pax = b.travellers.length;
  const flights = b.flights.length > 0 ? `${b.flights.length} flight${b.flights.length === 1 ? '' : 's'}` : 'hotel only';
  const hotels = `${b.hotels.length} hotel${b.hotels.length === 1 ? '' : 's'}`;
  return `${pax} ${pax === 1 ? 'traveller' : 'travellers'} · ${flights} · ${hotels}`;
}

async function makeQr(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  } catch {
    return '';
  }
}

export default function DemoPage() {
  const [live, setLive] = useState<DemoBooking[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Sample-trip QRs (deep-link straight into the app on that booking).
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        BOOKINGS.map(async (b) => [`mock:${b.reference}`, await makeQr(`${window.location.origin}/?demo=${b.reference}`)] as const),
      );
      if (alive) setQr((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Live onboarding invites + their QRs.
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/demo', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data: { bookings?: DemoBooking[] } | null) => {
        if (!alive || !data?.bookings) return;
        setLive(data.bookings);
        const entries = await Promise.all(
          data.bookings.map(async (b) => [b.inviteId, await makeQr(`${window.location.origin}/install?invite=${b.inviteId}`)] as const),
        );
        if (alive) setQr((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Demo</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, maxWidth: 760 }}>
          One place to show the product. Scan a <strong>sample trip</strong> to open the traveller app straight onto that
          holiday, or run the <strong>full onboarding</strong> below from QR to live booking.
        </p>
      </div>

      {/* ── Sample trips ── */}
      <SectionHeading
        icon={<Smartphone style={{ height: 15, width: 15 }} strokeWidth={1.75} />}
        title="Sample trips"
        subtitle="Scan to open the app on that holiday — no login needed. Great for a quick walk-through."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, marginBottom: 32 }}>
        {BOOKINGS.map((b) => {
          const key = `mock:${b.reference}`;
          const appUrl = `/?demo=${b.reference}`;
          return (
            <div key={b.reference} style={cardStyle}>
              <QrBox dataUrl={qr[key]} alt={`Open ${b.destinationLabel}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{b.destinationLabel}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                  {leadOf(b)} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{b.reference}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                  {fmt(b.tripStart)} → {fmt(b.tripEnd)}
                </div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 6 }}>{shapeOf(b)}</div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={appUrl} target="_blank" rel="noopener noreferrer" style={linkBtnStyle}>
                    Open in app <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                  </a>
                  <button onClick={() => copy(`${origin}${appUrl}`, key)} style={copyBtnStyle(copied === key)}>
                    {copied === key ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} /> : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />}
                    {copied === key ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Full onboarding (live) ── */}
      <SectionHeading
        icon={<QrCode style={{ height: 15, width: 15 }} strokeWidth={1.75} />}
        title="Full onboarding (live)"
        subtitle="The complete QR → redeem → live Travelify booking journey."
      />

      <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
          {STEPS.map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, height: 18, width: 18, borderRadius: 5, backgroundColor: C.bgTertiary, color: C.primary, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {live.length === 0 ? (
        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: '32px 24px', textAlign: 'center', color: C.textTertiary, fontSize: 13 }}>
          No live onboarding booking seeded yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
          {live.map((b) => (
            <div key={b.inviteId} style={cardStyle}>
              <QrBox dataUrl={qr[b.inviteId]} alt={`QR for ${b.bookingRef}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{b.destination || 'Destination'}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                  {b.leadName || '—'} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{b.bookingRef}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{fmt(b.departureDate)} → {fmt(b.returnDate)}</div>
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>To redeem, enter</div>
                  <Row label="Email" value={b.email || '—'} />
                  <Row label="Departure" value={fmt(b.departureDate)} />
                </div>
                <button onClick={() => copy(`${origin}/install?invite=${b.inviteId}`, b.inviteId)} style={{ ...copyBtnStyle(copied === b.inviteId), marginTop: 12 }}>
                  {copied === b.inviteId ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} /> : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />}
                  {copied === b.inviteId ? 'Install link copied' : 'Copy install link'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  backgroundColor: C.bgElevated,
  border: `1px solid ${C.border}`,
  padding: 20,
  display: 'flex',
  gap: 18,
};

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 32, padding: '0 12px', borderRadius: 8,
  backgroundColor: C.primary, color: '#fff',
  fontSize: 13, fontWeight: 500, textDecoration: 'none',
};

function copyBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 32, padding: '0 12px', borderRadius: 8,
    border: `1px solid ${C.border}`,
    backgroundColor: active ? '#ECFDF5' : C.bgElevated,
    color: active ? C.success : C.textSecondary,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
}

function QrBox({ dataUrl, alt }: { dataUrl?: string; alt: string }) {
  return (
    <div style={{ flexShrink: 0, height: 150, width: 150, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={alt} style={{ height: '100%', width: '100%' }} />
      ) : (
        <QrCode style={{ height: 26, width: 26, color: C.textTertiary }} strokeWidth={1.5} />
      )}
    </div>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
        <span style={{ color: C.accentDark }}>{icon}</span>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>{subtitle}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{ width: 80, flexShrink: 0, fontSize: 12, color: C.textTertiary }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
