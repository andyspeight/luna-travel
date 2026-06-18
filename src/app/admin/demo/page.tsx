'use client';

import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle2, ExternalLink, QrCode } from 'lucide-react';
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
  'Scan the QR — lands on the install page with the booking reference pre-filled.',
  'Enter the email + departure date below — validates against the agency’s own Travelify and reveals the Holiday Pass.',
  'Add to Home Screen — install the PWA on the phone.',
  'Open the app — full booking: itinerary, flights, hotels, documents.',
  'Live flights — flight cards update with status, gate and baggage belt.',
  'Messages — send one from the agency’s Messages tab; it lands on the traveller’s home.',
  'Luna — ask about the destination; live weather, holidays and verified answers.',
];

function fmt(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00Z' : d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DemoPage() {
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/demo', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data: { bookings?: DemoBooking[] } | null) => {
        if (!alive || !data?.bookings) {
          setLoading(false);
          return;
        }
        setBookings(data.bookings);
        setLoading(false);
        const origin = window.location.origin;
        const entries = await Promise.all(
          data.bookings.map(async (b) => {
            const url = `${origin}/install?invite=${b.inviteId}`;
            try {
              const dataUrl = await QRCode.toDataURL(url, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 512,
                color: { dark: '#0F172A', light: '#FFFFFF' },
              });
              return [b.inviteId, dataUrl] as const;
            } catch {
              return [b.inviteId, ''] as const;
            }
          }),
        );
        if (alive) setQr(Object.fromEntries(entries));
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };

  const installUrl = (id: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/install?invite=${id}` : `/install?invite=${id}`;

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Demo</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, maxWidth: 720 }}>
          One place to show the whole journey. Scan a booking&rsquo;s QR on a phone, then follow the steps to take it from
          QR to a live, installed app with flights, messages and Luna.
        </p>
      </div>

      {/* How to run it */}
      <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 12 }}>The run-through</div>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {STEPS.map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, height: 20, width: 20, borderRadius: 6, backgroundColor: C.bgTertiary, color: C.primary, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Booking cards */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: C.textTertiary, fontSize: 14 }}>Loading demo bookings…</div>
      ) : bookings.length === 0 ? (
        <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: '48px 24px', textAlign: 'center' }}>
          <QrCode style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>No demo bookings seeded yet</div>
          <div style={{ fontSize: 13, color: C.textTertiary }}>Seed a demo invite (created_by &lsquo;demo-seed&rsquo;) and it appears here with a QR.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
          {bookings.map((b) => (
            <div key={b.inviteId} style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 20, display: 'flex', gap: 20 }}>
              {/* QR */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ height: 160, width: 160, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qr[b.inviteId] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr[b.inviteId]} alt={`QR for ${b.bookingRef}`} style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <QrCode style={{ height: 28, width: 28, color: C.textTertiary }} strokeWidth={1.5} />
                  )}
                </div>
                <button
                  onClick={() => copy(installUrl(b.inviteId), b.inviteId)}
                  style={{ marginTop: 10, width: 160, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: copied === b.inviteId ? '#ECFDF5' : C.bgElevated, color: copied === b.inviteId ? C.success : C.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {copied === b.inviteId ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} /> : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />}
                  {copied === b.inviteId ? 'Link copied' : 'Copy install link'}
                </button>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{b.destination || 'Destination'}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                  {b.leadName || '—'} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{b.bookingRef}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                  {fmt(b.departureDate)} → {fmt(b.returnDate)}
                </div>

                <div style={{ marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>To redeem, enter</div>
                  <Row label="Booking ref" value={b.bookingRef} note="(pre-filled)" />
                  <Row label="Email" value={b.email || '—'} />
                  <Row label="Departure" value={fmt(b.departureDate)} />
                </div>

                <a
                  href={installUrl(b.inviteId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.accentDark, textDecoration: 'none', fontWeight: 500 }}
                >
                  Open install page <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mock showcase note */}
      <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 12, backgroundColor: C.bgTertiary, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Showing UI breadth without a phone</div>
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
          The four sample trips (Maldives, Mallorca, Dubai, Athens) are built in for design walk-throughs — open the
          traveller app and long-press the Luna logo on the home screen to switch between them. The QR bookings above are
          the live, end-to-end path (real Travelify booking → live app).
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{ width: 90, flexShrink: 0, fontSize: 12, color: C.textTertiary }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{value}</span>
      {note && <span style={{ fontSize: 11, color: C.textTertiary }}>{note}</span>}
    </div>
  );
}
