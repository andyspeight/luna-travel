'use client';

/**
 * /agency/access — the agency sends a traveller access to a booking's app.
 * Creates an invite via POST /api/agency/invites (scoped to this agency by the
 * session) and shows the QR + link for the traveller to open their trip.
 */

import { useState } from 'react';
import QRCode from 'qrcode';
import { Send, Copy, Check, RotateCcw } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn, ghostBtn } from '../portal-chrome';

interface Created {
  inviteId: string;
  qrUrl: string;
  qrDataUrl: string;
  expiresAt: string;
}

function AccessForm() {
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setStatus('creating');
    setErrorMsg('');
    try {
      const res = await fetch('/api/agency/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: bookingRef.trim() || undefined,
          email: email.trim() || undefined,
          departureDate: departureDate.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(prettyError(data.error));
        setStatus('error');
        return;
      }
      const qrDataUrl = await QRCode.toDataURL(data.qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
        color: { dark: '#0d1836', light: '#ffffff' },
      });
      setCreated({ inviteId: data.inviteId, qrUrl: data.qrUrl, qrDataUrl, expiresAt: data.expiresAt });
      setStatus('idle');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const reset = () => {
    setCreated(null);
    setBookingRef('');
    setEmail('');
    setDepartureDate('');
    setCopied(false);
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.qrUrl);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  if (created) {
    return (
      <div>
        <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Access link ready</h1>
        <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
          Send this to your traveller — they scan the QR or open the link to install their trip.
        </p>

        <div style={{ ...card, padding: 24, marginTop: 18, textAlign: 'center' }} className="animate-slide-up">
          <div style={{ display: 'inline-block', padding: 12, borderRadius: 18, background: '#fff', border: `1px solid ${P.line}`, boxShadow: '0 8px 24px -14px rgba(15,23,42,0.25)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={created.qrDataUrl} alt="Invite QR code" style={{ width: 208, height: 208, display: 'block' }} />
          </div>
          {bookingRef.trim() && (
            <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 12 }}>
              Booking <span style={{ fontFamily: 'ui-monospace, monospace', color: P.ink2 }}>{bookingRef.trim()}</span>
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <input readOnly value={created.qrUrl} style={{ ...inputStyle, fontSize: 12, color: P.ink2 }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {copied ? <Check size={15} color="#059669" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <button type="button" onClick={reset} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 18 }}>
          <RotateCcw size={15} /> Send another
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Send app access</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
        Create a sign-in link + QR for a booking so your traveller can open their trip in the app.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="How it works">
          Fill in the booking details you have (all optional), tap <strong>Create access link</strong>,
          then send the traveller the QR or link. They scan it once to install their trip — no
          passwords, no app store.
        </Callout>
      </div>

      <div style={{ ...card, padding: 20, marginTop: 18, display: 'grid', gap: 18 }}>
        <Field label="Booking reference" hint="Optional — pre-fills the traveller's sign-in.">
          <input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="e.g. LT-4837" style={inputStyle} />
        </Field>
        <Field label="Traveller email" hint="Optional.">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="traveller@example.com" style={inputStyle} />
        </Field>
        <Field label="Departure date" hint="Optional.">
          <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      {status === 'error' && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 14 }}>{errorMsg}</p>}

      <button type="button" onClick={create} disabled={status === 'creating'} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, opacity: status === 'creating' ? 0.7 : 1 }}>
        <Send size={16} /> {status === 'creating' ? 'Creating…' : 'Create access link'}
      </button>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'invalid_email': return 'That email address looks invalid.';
    case 'invalid_departure_date': return 'Departure date must be a valid date.';
    case 'agency_inactive': return 'This agency is no longer active — contact Luna Travel.';
    case 'unauthorised': return 'Your session has ended — ask for a fresh access link.';
    default: return 'Could not create the link. Please try again.';
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: P.ink3, marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${P.line}`,
  borderRadius: 11,
  padding: '11px 13px',
  fontSize: 14,
  color: P.ink,
  background: '#fff',
  boxSizing: 'border-box',
  outlineColor: P.teal,
};

export default function AgencyAccessPage() {
  return (
    <AgencyShell active="access">
      <AccessForm />
    </AgencyShell>
  );
}
