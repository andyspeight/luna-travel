'use client';

/**
 * /agency/settings — operational settings for the agency.
 *
 * Two things here, and both are about a traveller getting an answer.
 *
 * Where replies are emailed. Without it the app guesses from whoever last sent
 * an access link, which follows whoever happened to click last rather than the
 * person who actually watches the inbox.
 *
 * And when the agency is open. This is the one page where something an agency
 * types is shown to travellers as a promise, so nothing here is pre-filled:
 * an agency that says nothing has an app that claims nothing about timing.
 */

import { useState } from 'react';
import { Check, Mail, Clock } from 'lucide-react';
import { WEEK_ORDER, DAY_LABEL, toMinutes, type OpeningDay } from '@/lib/support-hours';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, primaryBtn } from '../portal-chrome';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SettingsForm() {
  const { me, refresh } = useAgencyMe();

  const [email, setEmail] = useState(me.settings?.replyNotifyEmail ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const savedHours = me.settings?.supportHours;
  const [timezone, setTimezone] = useState(
    savedHours?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  );
  const [days, setDays] = useState<Record<number, { open: string; close: string } | null>>(() => {
    const out: Record<number, { open: string; close: string } | null> = {};
    for (const d of WEEK_ORDER) out[d] = null;
    for (const d of savedHours?.days ?? []) out[d.day] = { open: d.open, close: d.close };
    return out;
  });
  const [replyWithin, setReplyWithin] = useState(me.settings?.replyWithin ?? '');

  const trimmed = email.trim();
  const malformed = trimmed !== '' && !EMAIL_RE.test(trimmed);

  const openDays: OpeningDay[] = WEEK_ORDER.filter((d) => days[d]).map((d) => ({
    day: d,
    open: days[d]!.open,
    close: days[d]!.close,
  }));
  // A day that is ticked but half-filled would be silently dropped on save,
  // so it is called out rather than quietly lost.
  const badDay = openDays.some(
    (d) => !Number.isFinite(toMinutes(d.open)) || !Number.isFinite(toMinutes(d.close)),
  );

  const setDay = (day: number, next: { open: string; close: string } | null) =>
    setDays((prev) => ({ ...prev, [day]: next }));

  const save = async () => {
    if (malformed || badDay) return;
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch('/api/agency/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyNotifyEmail: trimmed,
          supportHours: openDays.length ? { timezone, days: openDays } : null,
          replyWithin: replyWithin.trim(),
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

      </div>

      {/* ── When you are open ── */}
      <div style={{ marginTop: 34 }}>
        <Callout title="Tell travellers when you are there" icon={<Clock size={16} />}>
          A phone number on its own leaves somebody in an airport unable to judge whether to wait
          or to use your out-of-hours line. Set your hours and they see whether you are open right
          now, and when you next are. Leave this empty and the app says nothing about timing —
          which is better than a promise you did not make.
        </Callout>

        <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          {WEEK_ORDER.map((d) => {
            const v = days[d];
            return (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: 132, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={!!v}
                    onChange={(e) => setDay(d, e.target.checked ? { open: '09:00', close: '17:30' } : null)}
                    style={{ width: 16, height: 16, accentColor: P.teal }}
                  />
                  <span style={{ fontSize: 13.5, color: v ? P.ink : P.ink3 }}>{DAY_LABEL[d]}</span>
                </label>
                {v ? (
                  <>
                    <TimeBox value={v.open} onChange={(t) => setDay(d, { ...v, open: t })} />
                    <span style={{ color: P.ink3, fontSize: 13 }}>to</span>
                    <TimeBox value={v.close} onChange={(t) => setDay(d, { ...v, close: t })} />
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: P.ink3 }}>Closed</span>
                )}
              </div>
            );
          })}
        </div>

        <label style={{ display: 'block', marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>
            Your timezone
          </div>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/London"
            style={{
              width: 280,
              maxWidth: '100%',
              border: `1px solid ${P.line}`,
              borderRadius: 11,
              padding: '10px 13px',
              fontSize: 14,
              color: P.ink,
              background: '#fff',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12.5, color: P.ink3, margin: '6px 0 0', lineHeight: 1.55 }}>
            Your travellers are usually in another one, so the app shows your times with the
            timezone beside them.
          </p>
        </label>

        <label style={{ display: 'block', marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>
            Messages answered…
          </div>
          <input
            value={replyWithin}
            onChange={(e) => setReplyWithin(e.target.value)}
            maxLength={80}
            placeholder="within one working day"
            style={{
              width: 320,
              maxWidth: '100%',
              border: `1px solid ${P.line}`,
              borderRadius: 11,
              padding: '10px 13px',
              fontSize: 14,
              color: P.ink,
              background: '#fff',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12.5, color: P.ink3, margin: '6px 0 0', lineHeight: 1.55 }}>
            Travellers read this as &ldquo;Messages answered {replyWithin.trim() || 'within one working day'}.&rdquo;
            Promise what you can actually keep.
          </p>
        </label>
      </div>

      <div style={{ marginTop: 26, display: 'grid', gap: 8 }}>
        {badDay && (
          <p style={{ color: '#dc2626', fontSize: 12.5, margin: 0 }}>
            One of those times is not a valid 24-hour time, like 09:00.
          </p>
        )}

        {status === 'error' && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0' }}>{errorMsg}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving' || malformed || badDay}
            style={{
              ...primaryBtn,
              opacity: status === 'saving' || malformed || badDay ? 0.55 : 1,
              cursor: malformed || badDay ? 'not-allowed' : 'pointer',
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

function TimeBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${P.line}`,
        borderRadius: 9,
        padding: '7px 10px',
        fontSize: 13.5,
        color: P.ink,
        background: '#fff',
        minHeight: 38,
      }}
    />
  );
}

function prettyError(code?: string): string {
  switch (code) {
    case 'invalid_email':
      return 'That does not look like an email address.';
    case 'invalid_timezone':
      return 'That timezone is not one we recognise — try Europe/London.';
    case 'invalid_hours':
      return 'Those opening times could not be read. Use 24-hour times like 09:00.';
    case 'reply_within_too_long':
      return 'Keep the reply promise under 80 characters.';
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
