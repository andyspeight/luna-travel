'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Copy, ExternalLink, QrCode, CheckCircle2, AlertCircle, Loader2,
  X, Download, Users, RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';

// Agency-scoped Travellers tab. Two parts:
//   1. The agency's real travellers (live from
//      GET /api/admin/agencies/[id]/travellers — a traveller row is created
//      when an invite is redeemed, so this is effectively "who has joined").
//   2. The invite generator, pinned to this agency's Control record id, so
//      every invite resolves that agency's real booking.
// (The cross-agency version of the generator lives at /admin/travellers.)

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

type Invite = {
  inviteId: string;
  qrUrl: string;
  qrDataUrl: string;
  expiresAt: string;
  bookingRef?: string;
  email?: string;
  departureDate?: string;
  createdAt: string;
};

type Traveller = {
  id: string;
  name: string | null;
  bookingRef: string | null;
  departureDate: string | null;
  redeemedAt: string | null;
};

async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 12, backgroundColor: C.bgElevated,
      border: `1px solid ${C.border}`, overflow: 'hidden',
      alignSelf: 'start',
    }}>{children}</div>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const [focused, setFocused] = useState(false);
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
        border: `1px solid ${focused ? C.accent : C.border}`,
        backgroundColor: C.bgElevated, color: C.text,
        fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
        outline: 'none',
        boxShadow: focused ? '0 0 0 3px rgba(0,180,216,0.15)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    />
  );
}

function FormField({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
        <span style={{ color: C.textTertiary, marginLeft: 6, fontWeight: 400 }}>optional</span>
      </label>
      {children}
      {helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 6 }}>{helper}</div>}
    </div>
  );
}

function QrModal({ invite, agencyName, onClose }: { invite: Invite; agencyName: string; onClose: () => void }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = invite.qrDataUrl;
    a.download = `luna-travel-invite-${invite.inviteId.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
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
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>{agencyName}</h2>
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
            <img src={invite.qrDataUrl} alt="Invite QR code" style={{ display: 'block', width: 280, height: 280 }} />
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
  );
}

export default function InvitesTab({ agency }: { agency: { id: string; name?: string } }) {
  const agencyName = agency.name || agency.id;

  // --- Travellers (live) ---
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [travLoading, setTravLoading] = useState(true);
  const [travError, setTravError] = useState<string | null>(null);

  const loadTravellers = useCallback(async () => {
    setTravLoading(true);
    setTravError(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agency.id}/travellers`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Could not load travellers (${res.status})`);
      setTravellers(Array.isArray(data.travellers) ? data.travellers : []);
    } catch (e) {
      setTravError(e instanceof Error ? e.message : 'Could not load travellers');
    } finally {
      setTravLoading(false);
    }
  }, [agency.id]);

  useEffect(() => { loadTravellers(); }, [loadTravellers]);

  // --- Invite generator ---
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
        credentials: 'include',
        body: JSON.stringify({
          agencyId: agency.id,
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
      const qrDataUrl = await generateQrDataUrl(data.qrUrl);
      setInvites(prev => [
        {
          inviteId: data.inviteId,
          qrUrl: data.qrUrl,
          qrDataUrl,
          expiresAt: data.expiresAt,
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
      setError(e instanceof Error ? e.message : 'Network error');
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Travellers list (live) */}
        <Card>
          <CardHeader
            title="Travellers"
            subtitle={
              travLoading ? 'Loading…'
                : travError ? 'Could not load'
                : travellers.length === 0 ? 'No travellers have joined yet'
                : `${travellers.length} traveller${travellers.length === 1 ? '' : 's'} have joined`
            }
            action={
              <button
                onClick={loadTravellers}
                disabled={travLoading}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 8,
                  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                  color: C.textSecondary, fontSize: 13, fontWeight: 500,
                  cursor: travLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: travLoading ? 0.6 : 1,
                }}
                aria-label="Refresh travellers"
              >
                <RefreshCw style={{ height: 14, width: 14, animation: travLoading ? 'tg-spin 1s linear infinite' : 'none' }} strokeWidth={1.75} />
                Refresh
              </button>
            }
          />

          {travLoading ? (
            <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.textTertiary, fontSize: 14 }}>
              <Loader2 style={{ height: 16, width: 16, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} />
              Loading travellers…
            </div>
          ) : travError ? (
            <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle style={{ height: 16, width: 16, color: C.error, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
              <div style={{ fontSize: 13, color: C.text }}>{travError}</div>
            </div>
          ) : travellers.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Users style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
              <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                No travellers have joined yet. Create an invite below, then redeem it on a phone to see the traveller appear here.
              </div>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
                gap: 12, padding: '10px 24px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.textTertiary, fontWeight: 500,
              }}>
                <div>Traveller</div>
                <div>Booking ref</div>
                <div>Departs</div>
                <div>Joined</div>
              </div>
              {travellers.map((t) => (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
                  gap: 12, padding: '14px 24px', alignItems: 'center',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      height: 32, width: 32, borderRadius: 8, flexShrink: 0,
                      backgroundColor: C.primary, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                    }}>{initials(t.name)}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || 'Unnamed traveller'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.bookingRef || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{formatDate(t.departureDate)}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{formatDate(t.redeemedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Invite generator */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left: create invite */}
          <Card>
            <CardHeader title="Create invite" subtitle="All fields are optional. Empty fields are filled in by the traveller when they redeem." />
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                backgroundColor: C.bg, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Sparkles style={{ height: 14, width: 14, color: C.accent, flexShrink: 0 }} strokeWidth={1.75} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>For {agencyName}</div>
                  <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agency.id}
                  </div>
                </div>
              </div>

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
          </Card>

          {/* Right: recently created */}
          <Card>
            <CardHeader
              title="Recently created"
              subtitle={invites.length === 0
                ? 'No invites created in this session yet.'
                : `${invites.length} invite${invites.length === 1 ? '' : 's'} this session · click a QR to enlarge`}
            />
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
                    <button
                      onClick={() => setModalInvite(inv)}
                      style={{
                        flexShrink: 0, padding: 6, borderRadius: 8,
                        backgroundColor: '#FFFFFF', border: `1px solid ${C.border}`,
                        cursor: 'pointer', transition: 'transform 150ms, box-shadow 150ms',
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
                      <img src={inv.qrDataUrl} alt={`QR for invite ${inv.inviteId.slice(0, 8)}`} style={{ display: 'block', width: 72, height: 72 }} />
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary }}>
                          {inv.inviteId}
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
                          style={{ padding: 3, borderRadius: 4, color: C.textTertiary, display: 'flex' }}
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
          </Card>
        </div>
      </div>

      {modalInvite && <QrModal invite={modalInvite} agencyName={agencyName} onClose={() => setModalInvite(null)} />}
    </>
  );
}
