'use client';

/**
 * /agency/settings — operational settings for the agency.
 *
 * Currently one field, and it earns its own page: where traveller replies are
 * emailed. Without it the app guesses from whoever last sent an access link,
 * which follows whoever happened to click last rather than the person who
 * actually watches the inbox.
 */

import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, primaryBtn } from '../portal-chrome';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SettingsForm() {
  const { me, refresh } = useAgencyMe();

  const [email, setEmail] = useState(me.settings?.replyNotifyEmail ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const trimmed = email.trim();
  const malformed = trimmed !== '' && !EMAIL_RE.test(trimmed);

  const save = async () => {
    if (malformed) return;
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/agency/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyNotifyEmail: trimmed }),
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

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Settings</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        How your agency works behind the scenes. Travellers never see any of this.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="Don't miss a reply" icon={<Mail size={16} />}>
          When a traveller replies in their app we email you straight away, because a question from
          an airport at 9pm cannot wait for somebody to open the portal. Tell us where that email
          should land.
        </Callout>
      </div>

      <div style={{ marginTop: 26, display: 'grid', gap: 8 }}>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>
            Reply notifications go to
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            placeholder={me.agency.email || 'you@youragency.com'}
            aria-invalid={malformed}
            style={{
              width: '100%',
              border: `1px solid ${malformed ? '#dc2626' : P.line}`,
              borderRadius: 11,
              padding: '11px 13px',
              fontSize: 14,
              color: P.ink,
              background: '#fff',
              boxSizing: 'border-box',
              outlineColor: P.teal,
            }}
          />
        </label>

        {malformed ? (
          <p style={{ color: '#dc2626', fontSize: 12.5, margin: 0 }}>
            That does not look like an email address.
          </p>
        ) : (
          <p style={{ fontSize: 12.5, color: P.ink3, margin: 0, lineHeight: 1.55 }}>
            One address — a shared inbox your team actually watches works best. Leave it empty and
            we fall back to {me.agency.contactEmail ? (
              <strong style={{ color: P.ink2 }}>{me.agency.contactEmail}</strong>
            ) : (
              'whoever last sent that traveller their access link'
            )}
            .
          </p>
        )}

        {status === 'error' && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0' }}>{errorMsg}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving' || malformed}
            style={{
              ...primaryBtn,
              opacity: status === 'saving' || malformed ? 0.55 : 1,
              cursor: malformed ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'saving' ? 'Saving…' : 'Save settings'}
          </button>
          {status === 'saved' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: '#059669',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: P.ink3, marginTop: 28, lineHeight: 1.6 }}>
        Replying to that email will not reach your traveller — open Messages in the portal so your
        reply lands in their app.
      </p>
    </div>
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'invalid_email':
      return 'That does not look like an email address.';
    case 'agency_inactive':
      return 'This agency is no longer active — contact Luna Travel.';
    case 'unauthorised':
      return 'Your session has ended — ask for a fresh access link.';
    default:
      return 'Could not save. Please try again.';
  }
}

export default function AgencySettingsPage() {
  return (
    <AgencyShell active="settings">
      <SettingsForm />
    </AgencyShell>
  );
}
