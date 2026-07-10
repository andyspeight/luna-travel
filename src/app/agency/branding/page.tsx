'use client';

/**
 * /agency/branding — self-serve white-label branding. Pre-fills from the
 * agency's current override (/api/agency/me) and saves via POST
 * /api/agency/branding. A small preview shows how the app header will read.
 */

import { useState } from 'react';
import { AgencyShell, useAgencyMe } from '../portal-chrome';

const DEFAULT_PRIMARY = '#1b2b5b';
const DEFAULT_ACCENT = '#00b4d8';

function BrandingForm() {
  const { me, refresh } = useAgencyMe();
  const b = me.branding;

  const [appName, setAppName] = useState(b.appName ?? '');
  const [primary, setPrimary] = useState(b.brandPrimaryColour ?? DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(b.brandAccentColour ?? DEFAULT_ACCENT);
  const [welcome, setWelcome] = useState(b.welcomeMessage ?? '');
  const [logoUrl, setLogoUrl] = useState(b.logoUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const save = async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/agency/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: appName.trim() || undefined,
          brandPrimaryColour: primary,
          brandAccentColour: accent,
          welcomeMessage: welcome.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(prettyError(data.error));
        setStatus('error');
        return;
      }
      setStatus('saved');
      await refresh();
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const shownName = appName.trim() || me.agency.name || 'Your app';

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>App branding</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
        This is what your travellers see when they open their trip.
      </p>

      {/* Preview */}
      <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ background: primary, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', background: '#fff' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              {shownName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{shownName}</div>
        </div>
        {welcome.trim() && (
          <div style={{ padding: '12px 16px', fontSize: 13, color: '#334155', background: '#fff' }}>{welcome}</div>
        )}
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        <Field label="App name" hint="Shown in the app header. Defaults to your agency name.">
          <input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} placeholder={me.agency.name} style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: 16 }}>
          <ColourField label="Primary colour" value={primary} onChange={setPrimary} />
          <ColourField label="Accent colour" value={accent} onChange={setAccent} />
        </div>

        <Field label="Welcome message" hint="A short greeting on the traveller's home screen.">
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={240} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>

        <Field label="Logo URL" hint="Paste a hosted logo image URL (https). File upload is coming soon.">
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
        </Field>
      </div>

      {status === 'error' && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 14 }}>{errorMsg}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button type="button" onClick={save} disabled={status === 'saving'} style={primaryBtn}>
          {status === 'saving' ? 'Saving…' : 'Save branding'}
        </button>
        {status === 'saved' && <span style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
      </div>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'appName_too_long': return 'App name is too long (max 60 characters).';
    case 'welcomeMessage_too_long': return 'Welcome message is too long (max 240 characters).';
    case 'invalid_logo_url': return 'Logo URL must be an https link.';
    case 'unauthorised': return 'Your session has ended — ask for a fresh access link.';
    default: return 'Could not save. Please try again.';
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

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', background: '#fff' }}>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} style={{ width: 32, height: 28, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
        <span style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>
      </div>
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

export default function AgencyBrandingPage() {
  return (
    <AgencyShell active="branding">
      <BrandingForm />
    </AgencyShell>
  );
}
