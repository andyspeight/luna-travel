'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Copy, ExternalLink, QrCode, CheckCircle2, AlertCircle, Loader2,
  X, Download,
} from 'lucide-react';
import QRCode from 'qrcode';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textAccent: '#0096B7',
  primary: '#1B2B5B',
  primaryLight: '#2A3F7A',
  accent: '#00B4D8',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel' },
  { id: 'agc_3p8m', name: 'Mercia Holidays' },
  { id: 'agc_9w1q', name: 'Elite Bespoke' },
  { id: 'agc_2v6r', name: 'Brackenwood Travel' },
  { id: 'agc_4n7c', name: 'Northstar Journeys' },
];

type Invite = {
  inviteId: string;
  qrUrl: string;
  qrDataUrl: string;
  expiresAt: string;
  agencyId: string;
  agencyName: string;
  bookingRef?: string;
  email?: string;
  departureDate?: string;
  createdAt: string;
};

// QR generation — returns a base64 PNG data URL
async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512, // generated at high res; we resize via CSS for thumbnails
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

function Input({ value, onChange, placeholder, type = 'text', error }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean }) {
  const [focused, setFocused] = useState(false);
  const borderColour = error ? C.error : focused ? C.accent : C.border;
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 40, padding: '0 12px',
        borderRadius: 8,
        border: `1px solid ${borderColour}`,
        backgroundColor: C.bgElevated, color: C.text,
        fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
        outline: 'none',
        boxShadow: focused && !error ? '0 0 0 3px rgba(0,180,216,0.15)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    />
  );
}

function FormField({ label, helper, required, children }: { label: string; helper?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: C.error, marginLeft: 2 }}>*</span>}
        {!required && <span style={{ color: C.textTertiary, marginLeft: 6, fontWeight: 400 }}>optional</span>}
      </label>
      {children}
      {helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 6 }}>{helper}</div>}
    </div>
  );
}

function QrModal({ invite, onClose }: { invite: Invite; onClose: () => void }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = invite.qrDataUrl;
    a.download = `luna-travel-invite-${invite.inviteId.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.5)',
          zIndex: 100,
          animation: 'tg-fade-in 200ms ease-out',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: C.bgElevated,
            borderRadius: 16,
            boxShadow: '0 24px 48px rgba(15,23,42,0.25)',
            maxWidth: 420, width: '100%',
            animation: 'tg-modal-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
                Invite QR code
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>{invite.agencyName}</h2>
              <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, marginTop: 4 }}>
                {invite.inviteId}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                height: 32, width: 32, borderRadius: 8, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer',
                color: C.textSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Close"
            >
              <X style={{ height: 16, width: 16 }} strokeWidth={1.75} />
            </button>
          </div>

          <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              padding: 16, borderRadius: 12,
              backgroundColor: '#FFFFFF',
              border: `1px solid ${C.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invite.qrDataUrl}
                alt="Invite QR code"
                style={{ display: 'block', width: 280, height: 280 }}
              />
            </div>

            <div style={{ fontSize: 13, color: C.textSecondary, textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
              Scan with the camera app on your phone, then tap the link that appears.
            </div>
          </div>

          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.border}`,
            backgroundColor: C.bg,
            display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: '0 0 16px 16px',
          }}>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0 16px', height: 36, borderRadius: 8,
                backgroundColor: C.bgElevated, color: C.text,
                border: `1px solid ${C.border}`,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >Close</button>
            <button
              onClick={download}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0 16px', height: 36, borderRadius: 8,
                backgroundColor: C.primary, color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              <Download style={{ height: 14, width: 14 }} strokeWidth={1.75} />
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function TravellersPage() {
  const [agencyId, setAgencyId] = useState(AGENCIES[0].id);
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalInvite, setModalInvite] = useState<Invite | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          bookingRef: bookingRef.trim() || undefined,
          email: email.trim() || undefined,
          departureDate: departureDate.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      // Generate the QR code data URL client-side
      const qrDataUrl = await generateQrDataUrl(data.qrUrl);

      const agencyName = AGENCIES.find(a => a.id === agencyId)?.name ?? agencyId;
      setInvites(prev => [
        {
          inviteId: data.inviteId,
          qrUrl: data.qrUrl,
          qrDataUrl,
          expiresAt: data.expiresAt,
          agencyId,
          agencyName,
          bookingRef: bookingRef.trim() || undefined,
          email: email.trim() || undefined,
          departureDate: departureDate.trim() || undefined,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setBookingRef('');
      setEmail('');
      setDepartureDate('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard failed silently
    }
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  };

  return (
    <>
      <style>{`
        @keyframes tg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tg-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div style={{ padding: '32px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
            Travelgenix admin
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
            Travellers
          </h1>
          <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 8 }}>
            Test harness for the invite creation flow. Each invite creates a real row in the Supabase database.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: form */}
          <div style={{
            borderRadius: 12, backgroundColor: C.bgElevated,
            border: `1px solid ${C.border}`, overflow: 'hidden',
            alignSelf: 'start',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Create invite</h2>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                All fields except agency are optional. Empty fields are filled in by the traveller during redemption.
              </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <FormField label="Agency" required>
                <select
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  style={{
                    width: '100%', height: 40, padding: '0 32px 0 12px', borderRadius: 8,
                    border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                    color: C.text, fontSize: 14, lineHeight: 1.5,
                    outline: 'none', cursor: 'pointer', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  {AGENCIES.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Booking reference" helper="The Travelify booking ref. Leave blank for a generic invite.">
                <Input value={bookingRef} onChange={setBookingRef} placeholder="e.g. DEMO81297" />
              </FormField>

              <FormField label="Traveller email" helper="Pre-fills the redemption form.">
                <Input value={email} onChange={setEmail} placeholder="e.g. customer@example.com" type="email" />
              </FormField>

              <FormField label="Departure date" helper="Used during redemption to verify the traveller.">
                <Input value={departureDate} onChange={setDepartureDate} placeholder="YYYY-MM-DD" />
              </FormField>

              {error && (
                <div style={{
                  padding: 12, borderRadius: 8,
                  backgroundColor: C.errorSoft, border: `1px solid ${C.error}`,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <AlertCircle style={{ height: 16, width: 16, color: C.error, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
                  <div style={{ fontSize: 13, color: C.text }}>{error}</div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 44, borderRadius: 8, border: 'none',
                  backgroundColor: submitting ? C.textTertiary : C.primary,
                  color: '#fff', fontSize: 14, fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.8 : 1,
                  transition: 'background-color 150ms',
                }}
              >
                {submitting
                  ? <><Loader2 style={{ height: 16, width: 16, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} /> Creating invite...</>
                  : <><Sparkles style={{ height: 16, width: 16 }} strokeWidth={1.75} /> Create invite</>
                }
              </button>
            </div>
          </div>

          {/* Right: recently created invites */}
          <div style={{
            borderRadius: 12, backgroundColor: C.bgElevated,
            border: `1px solid ${C.border}`, overflow: 'hidden',
            alignSelf: 'start',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Recently created</h2>
              <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
                {invites.length === 0
                  ? 'No invites created in this session yet.'
                  : `${invites.length} invite${invites.length === 1 ? '' : 's'} this session · click a QR to enlarge`}
              </div>
            </div>

            {invites.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <QrCode style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
                <div style={{ fontSize: 14, color: C.textTertiary }}>
                  Create an invite to see it appear here.
                </div>
              </div>
            ) : (
              <div>
                {invites.map((inv) => (
                  <div key={inv.inviteId} style={{
                    padding: '16px 24px',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex', gap: 16,
                  }}>
                    {/* QR thumbnail — click to enlarge */}
                    <button
                      onClick={() => setModalInvite(inv)}
                      style={{
                        flexShrink: 0,
                        padding: 6,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        border: `1px solid ${C.border}`,
                        cursor: 'pointer',
                        transition: 'transform 150ms, box-shadow 150ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.04)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      aria-label="Enlarge QR code"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={inv.qrDataUrl}
                        alt={`QR for invite ${inv.inviteId.slice(0, 8)}`}
                        style={{ display: 'block', width: 72, height: 72 }}
                      />
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{inv.agencyName}</div>
                          <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, marginTop: 2 }}>
                            {inv.inviteId}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.textTertiary, whiteSpace: 'nowrap' }}>
                          {formatExpiry(inv.expiresAt)}
                        </div>
                      </div>

                      {(inv.bookingRef || inv.email || inv.departureDate) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {inv.bookingRef && (
                            <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: C.bgTertiary, fontSize: 11, color: C.textSecondary, fontFamily: 'ui-monospace, monospace' }}>{inv.bookingRef}</span>
                          )}
                          {inv.email && (
                            <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: C.bgTertiary, fontSize: 11, color: C.textSecondary }}>{inv.email}</span>
                          )}
                          {inv.departureDate && (
                            <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: C.bgTertiary, fontSize: 11, color: C.textSecondary, fontFamily: 'ui-monospace, monospace' }}>{inv.departureDate}</span>
                          )}
                        </div>
                      )}

                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0 10px', height: 30, borderRadius: 6,
                        backgroundColor: C.bg, border: `1px solid ${C.border}`,
                      }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textSecondary,
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{inv.qrUrl}</span>
                        <button
                          onClick={() => copyUrl(inv.inviteId, inv.qrUrl)}
                          style={{
                            padding: 3, borderRadius: 4, border: 'none',
                            backgroundColor: 'transparent', cursor: 'pointer',
                            color: copiedId === inv.inviteId ? C.success : C.textTertiary,
                          }}
                          aria-label="Copy URL"
                        >
                          {copiedId === inv.inviteId
                            ? <CheckCircle2 style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                            : <Copy style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                          }
                        </button>
                        <a
                          href={inv.qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: 3, borderRadius: 4,
                            color: C.textTertiary, display: 'flex',
                          }}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={1.75} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalInvite && <QrModal invite={modalInvite} onClose={() => setModalInvite(null)} />}
    </>
  );
}
