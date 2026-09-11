'use client';

import { useState } from 'react';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import { IconLock, IconHelp, IconCheck, IconMail } from '@/components/icons';

/**
 * "Email me my trip" — self-service access recovery.
 *
 * Replaces the old booking-reference lookup, which only ever matched the four
 * mock bookings and so was a dead end for a real traveller (and could show a
 * stranger a demo trip). A reference on its own is also ambiguous across
 * agencies, whereas an email address resolves to rows that already carry the
 * agency — and doubles as the delivery channel, so nothing is granted here.
 *
 * The server never tells us whether the address matched, so this screen must
 * not pretend to know: success and no-match render the identical confirmation.
 */
export default function WelcomePage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/trip-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error('request_failed');
      setSent(true);
    } catch {
      setError('Something went wrong sending that. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageEnter>
      <main className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy to-teal text-white font-bold text-2xl flex items-center justify-center shadow-lg mb-4">
            L
          </div>
          <h1 className="font-serif text-[34px] leading-tight text-ink text-center">
            <em>Welcome</em>.
          </h1>
          <p className="text-sm text-ink-2 text-center mt-2 max-w-[290px]">
            {sent
              ? 'Check your inbox to open your trip.'
              : 'Lost your link? Pop in your email address and we’ll send it again.'}
          </p>
        </div>

        {sent ? (
          <div className="max-w-md mx-auto w-full">
            <div className="p-5 rounded-2xl bg-surface border border-line-light text-center">
              <span className="w-11 h-11 rounded-2xl bg-teal/10 text-teal-dark dark:text-teal-light inline-flex items-center justify-center mb-3">
                <IconCheck size={20} />
              </span>
              <p className="text-sm text-ink leading-relaxed">
                If that address has a trip with us, we&rsquo;ve just sent the link to it.
              </p>
              <p className="text-xs text-ink-2 mt-2.5 leading-relaxed">
                It can take a minute to arrive. Do check your junk folder — and if nothing
                turns up, your travel agent can send your access again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="mt-4 w-full text-center text-[13px] font-semibold text-teal-dark dark:text-teal-light"
            >
              Try a different address
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 max-w-md mx-auto w-full">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5 block">
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                spellCheck={false}
                name="email"
                enterKeyHint="go"
                className="w-full h-12 px-4 rounded-xl bg-surface border border-line text-ink placeholder-ink-3 focus:outline-none focus:border-teal text-sm font-medium"
              />
            </label>

            <p className="text-xs text-ink-3 leading-relaxed">
              Use the address your travel agent has for you.
            </p>

            {error && (
              <div
                role="alert"
                className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2.5 leading-relaxed"
              >
                {error}
              </div>
            )}

            <div className="pt-2">
              <ActionButton type="submit" disabled={submitting} icon={<IconMail size={18} />}>
                {submitting ? 'Sending…' : 'Email me my trip'}
              </ActionButton>
            </div>
          </form>
        )}

        <div className="mt-8 text-center max-w-md mx-auto w-full space-y-3">
          <div className="text-[11px] text-ink-3 inline-flex items-center gap-1.5 justify-center">
            <IconLock size={11} />
            We only ever send your trip to the address your agent holds.
          </div>
          <p className="text-xs text-ink-3 leading-relaxed max-w-[300px] mx-auto inline-flex items-start gap-1.5">
            <IconHelp size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              Your travel agent sent you a booking link when they set your trip up — opening
              that adds it straight away, and they can always send it again.
            </span>
          </p>
        </div>
      </main>
    </PageEnter>
  );
}
