'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, ExternalLink } from 'lucide-react';

/**
 * Create an agency.
 *
 * Two kinds of agency exist in Luna Travel:
 *   - Travelgenix clients come from Control automatically once entitled to the
 *     luna-travel product (nothing to create here).
 *   - Non-Travelgenix clients are created here as Luna-native agencies (stage 2)
 *     — off-platform bookings only, branded and onboarded the same way.
 *
 * This form creates the latter (POST /api/admin/agencies) and drops you on the
 * new agency's detail page to set branding and add bookings.
 */

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
  error: '#EF4444',
};

export default function NewAgencyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 1 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/agencies', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          tradingName: tradingName.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.agency?.id) {
        setError(data?.message || data?.error || 'Could not create the agency.');
        return;
      }
      router.push(`/admin/agencies/${data.agency.id}`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 640, margin: '0 auto' }}>
      <Link
        href="/admin/agencies"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textSecondary, textDecoration: 'none', marginBottom: 20 }}
      >
        <ArrowLeft style={{ height: 14, width: 14 }} strokeWidth={1.75} />
        Agencies
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{
          height: 40, width: 40, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 style={{ height: 20, width: 20, color: '#fff' }} strokeWidth={1.75} />
        </span>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary }}>Travelgenix admin</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>New agency</h1>
        </div>
      </div>

      <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: '4px 0 24px' }}>
        For a <strong style={{ color: C.text }}>non-Travelgenix client</strong>. Travelgenix clients
        appear here automatically once you enable the Luna&nbsp;Travel product for them in{' '}
        <a href="https://id.travelify.io/admin" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: 'none' }}>
          Control <ExternalLink style={{ height: 11, width: 11, display: 'inline', verticalAlign: 'baseline' }} strokeWidth={1.75} />
        </a>. A Luna-native agency is off-platform only (manual / PDF-imported bookings).
      </p>

      <div style={{ borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Agency name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunshine Travel Ltd" autoFocus style={inputStyle} />
        </Field>
        <Field label="Trading name" hint="If different from the registered name — shown to travellers.">
          <input value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder="Sunshine Holidays" style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Contact name">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" style={inputStyle} />
          </Field>
          <Field label="Contact email">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@sunshine.co.uk" style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 20 7946 0000" style={inputStyle} />
          </Field>
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="sunshine.co.uk" style={inputStyle} />
          </Field>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: C.error, backgroundColor: '#FEF2F2', border: `1px solid ${C.error}`, borderRadius: 8, padding: 10 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
          <Link href="/admin/agencies" style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Cancel
          </Link>
          <button
            onClick={submit}
            disabled={!canSave}
            style={{
              height: 40, padding: '0 18px', borderRadius: 8, border: 'none',
              backgroundColor: canSave ? C.primary : C.textTertiary, color: '#fff',
              fontSize: 14, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Creating…' : 'Create agency'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 5 }}>
        {label}{required && <span style={{ color: C.error }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text,
  fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
