'use client';

/**
 * /agency/branding — self-serve white-label branding with a live phone preview.
 * Pre-fills from the agency's current override (/api/agency/me) and saves via
 * POST /api/agency/branding.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { brandPath, BRAND_IMAGE_TYPES, BRAND_IMAGE_MAX_BYTES, type BrandImageKind } from '@/lib/brand-upload';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, primaryBtn } from '../portal-chrome';
import { PhonePreview } from '../phone-preview';

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
        This is what your travellers see when they open their trip. Every change previews live.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="Make it unmistakably yours">
          Set your app name, pick two brand colours, add a warm welcome message and upload your logo. Watch
          the phone re-skin as you type — then hit <strong>Save branding</strong>. It goes live for
          every traveller instantly.
        </Callout>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginTop: 24, alignItems: 'flex-start' }}>
        {/* Live phone preview */}
        <div style={{ flex: '1 1 258px', minWidth: 258, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
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
            <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={240} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="e.g. Welcome aboard — we can't wait for you to travel with us." />
          </Field>

          <ImageUpload
            kind="logo"
            agencyId={me.agency.id}
            label="Logo"
            hint="PNG, JPG or WebP, up to 2 MB. A wide logo on a transparent background looks best."
            value={logoUrl}
            onChange={setLogoUrl}
          />

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

/**
 * Pick a file, and it goes straight to storage; the URL it lands at is what
 * Save branding keeps. There used to be a box for pasting a hosted logo URL,
 * which no agent has to hand.
 */
function ImageUpload({
  kind,
  agencyId,
  label,
  hint,
  value,
  onChange,
}: {
  kind: BrandImageKind;
  agencyId: string;
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const inputId = `upload-${kind}`;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!BRAND_IMAGE_TYPES.includes(file.type)) {
      setNote({ ok: false, text: 'That file type will not work. Use a PNG, JPG or WebP image.' });
      return;
    }
    if (file.size > BRAND_IMAGE_MAX_BYTES) {
      setNote({ ok: false, text: 'That file is over 2 MB. A smaller version will look just as sharp.' });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const blob = await upload(brandPath(kind, agencyId, file.name), file, {
        access: 'public',
        contentType: file.type,
        handleUploadUrl: '/api/agency/upload-image',
      });
      onChange(blob.url);
      setNote({ ok: true, text: 'Uploaded. Press Save branding to put it live.' });
    } catch {
      setNote({ ok: false, text: 'The upload did not go through. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={`Current ${label.toLowerCase()}`}
            style={{ height: 48, maxWidth: 160, objectFit: 'contain', border: `1px solid ${P.line}`, borderRadius: 10, background: '#fff', padding: 4 }}
          />
        ) : (
          <span style={{ fontSize: 13, color: P.ink3 }}>None yet</span>
        )}
        <label
          htmlFor={inputId}
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px', borderRadius: 11,
            border: `1px solid ${P.line}`, background: '#fff', color: P.ink, fontSize: 14, fontWeight: 600,
            cursor: busy ? 'progress' : 'pointer', opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Uploading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        </label>
        <input
          id={inputId}
          type="file"
          accept={BRAND_IMAGE_TYPES.join(',')}
          disabled={busy}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        {value && !busy && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setNote({ ok: true, text: 'Removed. Press Save branding to put it live.' });
            }}
            style={{ minHeight: 44, padding: '0 12px', border: 'none', background: 'none', color: P.ink2, fontSize: 13, cursor: 'pointer' }}
          >
            Remove
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: note ? (note.ok ? '#047857' : '#b91c1c') : P.ink3, marginTop: 6 }} role={note ? 'status' : undefined}>
        {note ? note.text : hint}
      </div>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'appName_too_long': return 'App name is too long (max 60 characters).';
    case 'welcomeMessage_too_long': return 'Welcome message is too long (max 240 characters).';
    case 'invalid_logo_url': return 'That logo could not be used. Please upload it again.';
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
