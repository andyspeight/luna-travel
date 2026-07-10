'use client';

/**
 * /agency/access — the agency sends a traveller access to a booking's app.
 * Creates an invite via POST /api/agency/invites (scoped to this agency by the
 * session) and shows the QR + link for the traveller to open their trip.
 */

import { useState } from 'react';
import QRCode from 'qrcode';
import { AgencyShell } from '../portal-chrome';

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
        color: { dark: '#0f172a', light: '#ffffff' },
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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Access link ready</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Send this to your traveller. They scan the QR or open the link to install their trip.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginTop: 16, textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={created.qrDataUrl} alt="Invite QR code" style={{ width: 240, height: 240, display: 'block', margin: '0 auto' }} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <input readOnly value={created.qrUrl} style={{ ...inputStyle, fontSize: 12 }} />
            <button type="button" onClick={copy} style={ghostBtn}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {bookingRef.trim() && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>Booking {bookingRef.trim()}</div>
          )}
        </div>
        <button type="button" onClick={reset} style={{ ...primaryBtn, marginTop: 16 }}>Send another</button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Send app access</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
        Create a sign-in link + QR for a booking. The booking reference and email pre-fill the
        traveller&rsquo;s sign-in (all optional).
      </p>

      <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
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

      <button type="button" onClick={create} disabled={status === 'creating'} style={{ ...primaryBtn, marginTop: 18 }}>
        {status === 'creating' ? 'Creating…' : 'Create access link'}
      </button>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'invalid_email': return 'That email address looks invalid.';
    case 'invalid_departure_date': return 'Departure date must be a valid date.';
    case 'unauthorised': return 'Your session has ended — ask for a fresh access link.';
    default: return 'Could not create the link. Please try again.';
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default function AgencyAccessPage() {
  return (
    <AgencyShell active="access">
      <AccessForm />
    </AgencyShell>
  );
}
