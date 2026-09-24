'use client';

/**
 * /agency/branding — self-serve white-label branding with a live phone preview.
 * Pre-fills from the agency's current override (/api/agency/me) and saves via
 * POST /api/agency/branding.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import { uploadBrandImage, UploadRefused } from '@/lib/brand-upload-client';
import { brandPath, BRAND_IMAGE_TYPES, BRAND_IMAGE_MAX_BYTES, type BrandImageKind } from '@/lib/brand-upload';
import { ICON_IMAGE_TYPES, iconSpecFor, iconUrl } from '@/lib/app-icon';
import { BrandLogo } from '@/components/brand-logo';
import { parseLogoMeta, type LogoMeta } from '@/lib/logo-look';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, primaryBtn } from '../portal-chrome';
import { PhonePreview } from '../phone-preview';

const DEFAULT_PRIMARY = '#1b2b5b';
const DEFAULT_ACCENT = '#00b4d8';

function BrandingForm() {
  const { me, refresh } = useAgencyMe();
  const b = me.branding;

  const [appName, setAppName] = useState(b.appName ?? '');
  const [assistant, setAssistant] = useState(b.assistantName ?? '');
  const [primary, setPrimary] = useState(b.brandPrimaryColour ?? DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(b.brandAccentColour ?? DEFAULT_ACCENT);
  const [welcome, setWelcome] = useState(b.welcomeMessage ?? '');
  const [logoUrl, setLogoUrl] = useState(b.logoUrl ?? '');
  const [logoMeta, setLogoMeta] = useState<LogoMeta | null>(b.logoMeta ?? null);

  // A new logo is measured straight away, so the previews show it the way
  // travellers will before Save is pressed. Save measures it again.
  const changeLogo = async (url: string) => {
    setLogoUrl(url);
    setLogoMeta(null);
    if (!url) return;
    try {
      const res = await fetch('/api/agency/logo-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json().catch(() => ({}))) as { meta?: unknown };
      setLogoMeta(parseLogoMeta(json.meta));
    } catch {
      /* the preview shows it unmeasured; Save still measures it */
    }
  };
  const [iconUrlValue, setIconUrlValue] = useState(b.iconUrl ?? '');
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
          assistantName: assistant.trim() || undefined,
          brandPrimaryColour: primary,
          brandAccentColour: accent,
          welcomeMessage: welcome.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          iconUrl: iconUrlValue.trim() || undefined,
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
          Name your app and its assistant, pick two brand colours, add a warm welcome message and upload your logo. Watch
          the phone re-skin as you type — then hit <strong>Save branding</strong>. It goes live for
          every traveller instantly.
        </Callout>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginTop: 24, alignItems: 'flex-start' }}>
        {/* Live phone preview */}
        <div style={{ flex: '1 1 258px', minWidth: 258, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
          <PhonePreview name={shownName} primary={primary} accent={accent} welcome={welcome.trim()} logoUrl={logoUrl.trim()} logoMeta={logoMeta} />
        </div>

        {/* Form */}
        <div style={{ flex: '2 1 320px', minWidth: 300, display: 'grid', gap: 18 }}>
          <Field label="App name" hint="Shown in the app header, and its first letter is your badge when there is no logo. Defaults to your agency name.">
            <input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} placeholder={me.agency.name} style={inputStyle} />
          </Field>

          <Field label="Assistant name" hint="What travellers call the assistant that answers their questions, as in “Ask Luna”. Leave it empty to keep Luna.">
            <input value={assistant} onChange={(e) => setAssistant(e.target.value)} maxLength={30} placeholder="Luna" style={inputStyle} />
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
            onChange={changeLogo}
            preview={(url) => (
              <span style={{ display: 'inline-flex', border: `1px solid ${P.line}`, borderRadius: 10, padding: 6, background: '#fff' }}>
                <BrandLogo src={url} meta={logoMeta} primary={primary} surface="light" height={36} maxWidth={180} alt="Current logo" />
              </span>
            )}
          />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <HomeScreenIcon
              // An upload is shown as itself: the icon route only draws icons
              // that have been saved, and this one may not be yet.
              src={iconUrlValue || iconUrl(iconSpecFor({ appName: shownName, brandPrimaryColour: primary, brandAccentColour: accent }), 192)}
              name={shownName}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <ImageUpload
                kind="icon"
                agencyId={me.agency.id}
                label="Home-screen icon"
                hint="A square PNG or JPG, 512 × 512 pixels or larger, up to 2 MB. Without one, travellers get the first letter of your app name on your brand colours, as shown."
                value={iconUrlValue}
                onChange={setIconUrlValue}
              />
            </div>
          </div>

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
  preview,
}: {
  kind: BrandImageKind;
  agencyId: string;
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  /** How to show what is uploaded, when a plain thumbnail would mislead. */
  preview?: (url: string) => React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const inputId = `upload-${kind}`;
  // The icon is drawn by our icon renderer, which reads PNG and JPEG only.
  const types = kind === 'icon' ? ICON_IMAGE_TYPES : BRAND_IMAGE_TYPES;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!types.includes(file.type)) {
      setNote({ ok: false, text: kind === 'icon' ? 'That file type will not work. Use a PNG or JPG image.' : 'That file type will not work. Use a PNG, JPG or WebP image.' });
      return;
    }
    if (file.size > BRAND_IMAGE_MAX_BYTES) {
      setNote({ ok: false, text: 'That file is over 2 MB. A smaller version will look just as sharp.' });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const url = await uploadBrandImage(brandPath(kind, agencyId, file.name), file);
      onChange(url);
      setNote({ ok: true, text: 'Uploaded. Press Save branding to put it live.' });
    } catch (e) {
      // Say which kind of failure it was: "try again" is no help when trying
      // again cannot work.
      const code = e instanceof UploadRefused ? e.code : '';
      setNote({
        ok: false,
        text:
          code === 'unauthorised' || code === '401'
            ? 'Your session has ended. Sign in again, then upload.'
            : code === 'upload_refused'
              ? 'That upload was refused. If you are acting for another agency, check the banner still shows their name, then try again.'
              : code === 'storage_not_configured'
                ? 'Uploads are not switched on yet. Contact Luna Travel support.'
                : 'The upload did not go through. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value && preview ? (
          preview(value)
        ) : value ? (
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
          accept={types.join(',')}
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

/**
 * The icon as it will sit on a phone: rounded the way iOS and Android round
 * it, with the app name underneath. The generated one is drawn by the same
 * route the phone uses, so it is the real icon, not an impression of it.
 */
function HomeScreenIcon({ src, name }: { src: string; name: string }) {
  return (
    <div style={{ width: 84, flex: 'none', textAlign: 'center', paddingTop: 22 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Home-screen icon preview"
        width={64}
        height={64}
        style={{ display: 'block', margin: '0 auto', width: 64, height: 64, objectFit: 'cover', borderRadius: 15, boxShadow: '0 2px 8px rgba(15,23,42,0.18)' }}
      />
      <div style={{ fontSize: 11, color: P.ink2, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'appName_too_long': return 'App name is too long (max 60 characters).';
    case 'assistantName_too_long': return 'Assistant name is too long (max 30 characters).';
    case 'assistantName_invalid': return 'Use letters, numbers and spaces for the assistant name.';
    case 'welcomeMessage_too_long': return 'Welcome message is too long (max 240 characters).';
    case 'invalid_logo_url': return 'That logo could not be used. Please upload it again.';
    case 'invalid_icon_url': return 'That icon could not be used. Please upload it again.';
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
