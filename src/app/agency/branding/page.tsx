'use client';

/**
 * /agency/branding — self-serve white-label branding with a live phone preview.
 * Pre-fills from the agency's current override (/api/agency/me) and saves via
 * POST /api/agency/branding.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import { AgencyShell, useAgencyMe, P, SERIF, card, primaryBtn } from '../portal-chrome';

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
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2400);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const shownName = appName.trim() || me.agency.name || 'Your app';

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>App branding</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        This is what your travellers see when they open their trip. Changes preview live.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 22, alignItems: 'flex-start' }}>
        {/* Live phone preview */}
        <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', justifyContent: 'center' }}>
          <PhonePreview name={shownName} primary={primary} accent={accent} welcome={welcome.trim()} logoUrl={logoUrl.trim()} />
        </div>

        {/* Form */}
        <div style={{ flex: '2 1 320px', minWidth: 300, display: 'grid', gap: 18 }}>
          <Field label="App name" hint="Shown in the app header. Defaults to your agency name.">
            <input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} placeholder={me.agency.name} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: 14 }}>
            <ColourField label="Primary" value={primary} onChange={setPrimary} />
            <ColourField label="Accent" value={accent} onChange={setAccent} />
          </div>

          <Field label="Welcome message" hint="A short greeting on the traveller's home screen.">
            <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={240} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>

          <Field label="Logo URL" hint="Paste a hosted logo image URL (https). File upload is coming soon.">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
          </Field>

          {status === 'error' && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{errorMsg}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="button" onClick={save} disabled={status === 'saving'} style={{ ...primaryBtn, opacity: status === 'saving' ? 0.7 : 1 }}>
              {status === 'saving' ? 'Saving…' : 'Save branding'}
            </button>
            {status === 'saved' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669', fontSize: 13, fontWeight: 600 }}>
                <Check size={15} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhonePreview({ name, primary, accent, welcome, logoUrl }: { name: string; primary: string; accent: string; welcome: string; logoUrl: string }) {
  return (
    <div style={{ width: 232, borderRadius: 36, padding: 9, background: 'linear-gradient(160deg,#1b2540,#0d1836)', boxShadow: '0 24px 50px -20px rgba(13,24,54,0.7)' }}>
      <div style={{ borderRadius: 28, overflow: 'hidden', background: '#fff', position: 'relative' }}>
        {/* notch */}
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 74, height: 18, borderRadius: 12, background: '#0d1836', zIndex: 2 }} />
        {/* branded header */}
        <div style={{ background: primary, padding: '30px 16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.1, overflow: 'hidden' }}>{name}</div>
        </div>
        {/* welcome */}
        {welcome && (
          <div style={{ padding: '11px 14px', fontSize: 11.5, color: '#334155', background: '#fff', borderBottom: '1px solid #eef1f6', lineHeight: 1.45 }}>
            {welcome}
          </div>
        )}
        {/* faux trip content */}
        <div style={{ padding: 14, display: 'grid', gap: 10, background: '#f7f9fc' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>Upcoming trip</div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ height: 8, width: '62%', borderRadius: 4, background: '#e2e8f0' }} />
            <div style={{ height: 7, width: '40%', borderRadius: 4, background: '#eef1f6', marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: primary, borderRadius: 6, padding: '3px 8px' }}>View trip</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: primary, background: `${accent}22`, borderRadius: 6, padding: '3px 8px' }}>Documents</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ height: 7, width: '52%', borderRadius: 4, background: '#e2e8f0' }} />
            <div style={{ height: 7, width: '34%', borderRadius: 4, background: '#eef1f6', marginTop: 8 }} />
          </div>
        </div>
        {/* tab bar hint */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px', background: '#fff', borderTop: '1px solid #eef1f6' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i === 0 ? primary : '#cbd5e1' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'appName_too_long': return 'App name is too long (max 60 characters).';
    case 'welcomeMessage_too_long': return 'Welcome message is too long (max 240 characters).';
    case 'invalid_logo_url': return 'Logo URL must be an https link.';
    case 'agency_inactive': return 'This agency is no longer active — contact Luna Travel.';
    case 'unauthorised': return 'Your session has ended — ask for a fresh access link.';
    default: return 'Could not save. Please try again.';
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

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <label style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${P.line}`, borderRadius: 11, padding: '7px 10px', background: '#fff' }}>
        <span style={{ position: 'relative', width: 30, height: 30, borderRadius: 8, overflow: 'hidden', border: `1px solid ${P.line}`, background: valid ? value : '#000', flexShrink: 0 }}>
          <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: -4, width: 40, height: 40, border: 'none', padding: 0, cursor: 'pointer', opacity: 0 }} aria-label={`${label} colour`} />
        </span>
        <span style={{ fontSize: 13, color: P.ink2, fontFamily: 'ui-monospace, monospace' }}>{value.toUpperCase()}</span>
      </div>
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

export default function AgencyBrandingPage() {
  return (
    <AgencyShell active="branding">
      <BrandingForm />
    </AgencyShell>
  );
}
