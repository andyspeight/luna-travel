'use client';

/**
 * /agency/settings — how a traveller reaches the agency, and how the agency
 * hears about it.
 *
 * The contact details travellers see on Get help. They came only from the
 * Control record, whose email is often an accounts or login address rather
 * than the one an agency wants travellers writing to (23 Sep 2026: "it seems
 * to be picking up the email address in Control which isn't correct"). Each
 * one left empty still shows the record's.
 *
 * Where replies are emailed. Only the agency sees it. Without it the app
 * guesses from whoever last sent an access link, which follows whoever happened
 * to click last rather than the person who actually watches the inbox. This
 * page used to say the fallback was the signed-in person's own address, which
 * is not where anything went.
 *
 * And when the agency is open, shown to travellers as a promise, so nothing
 * here is pre-filled: an agency that says nothing has an app that claims
 * nothing about timing.
 */

import { useState } from 'react';
import { Check, Mail, Clock, LifeBuoy } from 'lucide-react';
import { isEmail, isPhone } from '@/lib/contact-check';
import { WEEK_ORDER, DAY_LABEL, toMinutes, type OpeningDay } from '@/lib/support-hours';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, primaryBtn } from '../portal-chrome';

function SettingsForm() {
  const { me, refresh } = useAgencyMe();

  const [email, setEmail] = useState(me.settings?.replyNotifyEmail ?? '');
  const [tEmail, setTEmail] = useState(me.settings?.travellerEmail ?? '');
  const [tPhone, setTPhone] = useState(me.settings?.travellerPhone ?? '');
  const [tEmergency, setTEmergency] = useState(me.settings?.travellerEmergencyPhone ?? '');
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
  const replyBad = trimmed !== '' && !isEmail(trimmed);
  const tEmailBad = tEmail.trim() !== '' && !isEmail(tEmail);
  const tPhoneBad = tPhone.trim() !== '' && !isPhone(tPhone);
  const tEmergencyBad = tEmergency.trim() !== '' && !isPhone(tEmergency);
  const malformed = replyBad || tEmailBad || tPhoneBad || tEmergencyBad;

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
          travellerEmail: tEmail.trim(),
          travellerPhone: tPhone.trim(),
          travellerEmergencyPhone: tEmergency.trim(),
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
        How your travellers reach you, and how you hear about it.
      </p>

      {/* ── What travellers see ── */}
      <div style={{ marginTop: 16 }}>
        <Callout title="Contact details travellers see" icon={<LifeBuoy size={16} />}>
          These are on Get help in your travellers&rsquo; app, and on every &ldquo;contact your
          agent&rdquo; button. Leave a box empty and travellers see the one on your Travelgenix
          account.
        </Callout>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
        <ContactField
          label="Email for travellers"
          type="email"
          value={tEmail}
          onChange={setTEmail}
          placeholder="hello@youragency.co.uk"
          bad={tEmailBad}
          badText="That does not look like an email address."
        />
        <ContactField
          label="Phone for travellers"
          type="tel"
          value={tPhone}
          onChange={setTPhone}
          placeholder="01234 567890"
          bad={tPhoneBad}
          badText="That does not look like a phone number. Use digits, spaces and a + if you need one."
        />
        <ContactField
          label="Out-of-hours phone"
          type="tel"
          value={tEmergency}
          onChange={setTEmergency}
          placeholder="+44 7700 900123"
          hint="For a traveller in trouble when you are closed. Shown beside your hours."
          bad={tEmergencyBad}
          badText="That does not look like a phone number. Use digits, spaces and a + if you need one."
        />
      </div>

      <div style={{ marginTop: 34 }}>
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
            placeholder="team@youragency.co.uk"
            aria-invalid={replyBad}
            style={{
              width: '100%',
              border: `1px solid ${replyBad ? '#dc2626' : P.line}`,
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

        {replyBad ? (
          <p style={{ color: '#dc2626', fontSize: 12.5, margin: 0 }}>
            That does not look like an email address.
          </p>
        ) : (
          <p style={{ fontSize: 12.5, color: P.ink3, margin: 0, lineHeight: 1.55 }}>
            Only your team sees this address. One address, ideally a shared inbox your team
            actually watches. Leave it empty and we email{' '}
            {me.agency.contactEmail ? (
              <>
                <strong style={{ color: P.ink2 }}>{me.agency.contactEmail}</strong>, your agency&rsquo;s
                contact address
              </>
            ) : (
              'whoever sent that traveller their access link'
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

function ContactField({
  label,
  type,
  value,
  onChange,
  placeholder,
  hint,
  bad,
  badText,
}: {
  label: string;
  type: 'email' | 'tel';
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
  bad: boolean;
  badText: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={type === 'email' ? 254 : 24}
        placeholder={placeholder}
        aria-invalid={bad}
        style={{
          width: '100%',
          border: `1px solid ${bad ? '#dc2626' : P.line}`,
          borderRadius: 11,
          padding: '11px 13px',
          fontSize: 14,
          color: P.ink,
          background: '#fff',
          boxSizing: 'border-box',
          outlineColor: P.teal,
        }}
      />
      {(bad || hint) && (
        <p style={{ color: bad ? '#dc2626' : P.ink3, fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.55 }}>
          {bad ? badText : hint}
        </p>
      )}
    </label>
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
    case 'invalid_traveller_email':
      return 'The email for travellers does not look like an email address.';
    case 'invalid_traveller_phone':
      return 'The phone for travellers does not look like a phone number.';
    case 'invalid_emergency_phone':
      return 'The out-of-hours phone does not look like a phone number.';
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
