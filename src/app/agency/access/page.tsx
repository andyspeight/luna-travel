'use client';

/**
 * /agency/access — the agency sends a traveller access to a booking's app and
 * manages the invites it has sent (status/stats + revoke). All scoped to the
 * signed-in agency by the session.
 */

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Send, Copy, Check, RotateCcw, Ban } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn, ghostBtn } from '../portal-chrome';

interface Invite {
  id: string;
  bookingRef: string | null;
  email: string | null;
  status: 'pending' | 'redeemed' | 'expired' | 'revoked';
  opened: boolean;
  createdAt: string;
  expiresAt: string;
  qrUrl: string;
}

interface Created {
  inviteId: string;
  qrUrl: string;
  qrDataUrl: string;
}

function AccessPage() {
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/invites', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

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
      const qrDataUrl = await QRCode.toDataURL(data.qrUrl, { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#0d1836', light: '#ffffff' } });
      setCreated({ inviteId: data.inviteId, qrUrl: data.qrUrl, qrDataUrl });
      setStatus('idle');
      setBookingRef('');
      setEmail('');
      setDepartureDate('');
      setCopied(false);
      void loadInvites();
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await fetch(`/api/agency/invites/${id}/revoke`, { method: 'POST' });
      await loadInvites();
    } catch {
      /* ignore */
    } finally {
      setRevoking(null);
    }
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
          passwords, no app store. You can track and revoke every invite below.
        </Callout>
      </div>

      {/* Create OR the just-created QR */}
      {created ? (
        <div style={{ ...card, padding: 22, marginTop: 18, textAlign: 'center' }} className="animate-slide-up">
          <div style={{ fontWeight: 700, color: P.ink, fontSize: 15 }}>Access link ready</div>
          <div style={{ display: 'inline-block', padding: 12, borderRadius: 18, background: '#fff', border: `1px solid ${P.line}`, boxShadow: '0 8px 24px -14px rgba(15,23,42,0.25)', marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={created.qrDataUrl} alt="Invite QR code" style={{ width: 188, height: 188, display: 'block' }} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            <input readOnly value={created.qrUrl} onFocus={(e) => e.currentTarget.select()} style={{ ...inputStyle, fontSize: 12, color: P.ink2 }} />
            <button type="button" onClick={copy} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {copied ? <Check size={15} color="#059669" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button type="button" onClick={() => setCreated(null)} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16 }}>
            <Send size={15} /> Send another
          </button>
        </div>
      ) : (
        <>
          <div style={{ ...card, padding: 20, marginTop: 18, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Booking reference" hint="Optional — pre-fills the sign-in." style={{ flex: '1 1 160px' }}>
                <input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="e.g. LT-4837" style={inputStyle} />
              </Field>
              <Field label="Departure date" hint="Optional." style={{ flex: '1 1 140px' }}>
                <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <Field label="Traveller email" hint="Optional.">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="traveller@example.com" style={inputStyle} />
            </Field>
            {status === 'error' && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{errorMsg}</p>}
            <div>
              <button type="button" onClick={create} disabled={status === 'creating'} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: status === 'creating' ? 0.7 : 1 }}>
                <Send size={16} /> {status === 'creating' ? 'Creating…' : 'Create access link'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sent invites */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, color: P.ink, margin: 0 }}>Invites you&rsquo;ve sent</h2>
          {invites.length > 0 && <span style={{ fontSize: 12, color: P.ink3 }}>{invites.length}</span>}
        </div>

        {listLoading ? (
          <p style={{ color: P.ink3, fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : invites.length === 0 ? (
          <div style={{ ...card, padding: 22, marginTop: 12, textAlign: 'center', color: P.ink3, fontSize: 13.5 }}>
            No invites yet. Create your first access link above.
          </div>
        ) : (
          <div style={{ ...card, marginTop: 12, overflow: 'hidden' }}>
            {invites.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: inv.bookingRef ? 'ui-monospace, monospace' : 'inherit' }}>
                      {inv.bookingRef || 'No booking ref'}
                    </span>
                    <StatusPill invite={inv} />
                  </div>
                  <div style={{ fontSize: 12, color: P.ink3, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.email ? `${inv.email} · ` : ''}sent {fmtDate(inv.createdAt)}
                  </div>
                </div>
                <button type="button" onClick={() => copyLink(inv.qrUrl)} title="Copy link" style={iconBtn}>
                  <Copy size={15} />
                </button>
                {inv.status === 'pending' ? (
                  <button type="button" onClick={() => revoke(inv.id)} disabled={revoking === inv.id} title="Revoke" style={{ ...iconBtn, color: '#dc2626', borderColor: '#fecaca' }}>
                    <Ban size={15} />
                  </button>
                ) : (
                  <span style={{ width: 32 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ invite }: { invite: Invite }) {
  const map: Record<string, { label: string; fg: string; bg: string }> = {
    installed: { label: 'Installed', fg: '#047857', bg: '#d1fae5' },
    opened: { label: 'Opened', fg: '#1d4ed8', bg: '#dbeafe' },
    pending: { label: 'Pending', fg: '#b45309', bg: '#fef3c7' },
    expired: { label: 'Expired', fg: '#64748b', bg: '#f1f5f9' },
    revoked: { label: 'Revoked', fg: '#b91c1c', bg: '#fee2e2' },
  };
  const key = invite.status === 'redeemed' ? 'installed' : invite.opened ? 'opened' : invite.status;
  const s = map[key] ?? map.pending;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.fg, background: s.bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function copyLink(url: string) {
  navigator.clipboard?.writeText(url).catch(() => {});
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
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

function Field({ label, hint, children, style }: { label: string; hint?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
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

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  border: `1px solid ${P.line}`,
  background: '#fff',
  color: P.ink2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

export default function AgencyAccessPage() {
  return (
    <AgencyShell active="access">
      <AccessPage />
    </AgencyShell>
  );
}
