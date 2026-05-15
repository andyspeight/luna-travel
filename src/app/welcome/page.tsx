'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import { BOOKINGS } from '@/data/mock-bookings';
import {
  IconLock,
  IconHelp,
  IconCheck,
  IconChat,
} from '@/components/icons';

/**
 * Onboarding flow — booking-ref lookup.
 *
 * For the prototype the "lookup" matches against the four mock bookings.
 * In production this hits Travelify with the reference + a verification value
 * (last name or email) and loads the real booking. The shape of the API
 * response is intentionally what mock-bookings.ts already provides.
 */
export default function WelcomePage() {
  const router = useRouter();
  const { setBookingByRef } = useBooking();
  const [ref, setRef] = useState('');
  const [verifier, setVerifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedRef = ref.trim().toUpperCase();
    const trimmedVerifier = verifier.trim().toLowerCase();

    if (!trimmedRef || !trimmedVerifier) {
      setError('Please enter both your booking reference and last name.');
      return;
    }

    setSubmitting(true);

    // Simulate a network look-up
    window.setTimeout(() => {
      const match = BOOKINGS.find((b) => {
        if (b.reference.toUpperCase() !== trimmedRef) return false;
        const lead = b.travellers.find((t) => t.isLead) ?? b.travellers[0];
        return lead.lastName.toLowerCase() === trimmedVerifier;
      });

      if (match) {
        setBookingByRef(match.reference);
        router.replace('/');
      } else {
        setError(
          'We couldn\'t find a trip with those details. Check your booking confirmation email, or get in touch with your agent.'
        );
        setSubmitting(false);
      }
    }, 700);
  };

  return (
    <PageEnter>
      <main className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy to-teal text-white font-bold text-2xl flex items-center justify-center shadow-lg mb-4">
            L
          </div>
          <h1 className="font-serif text-[34px] leading-tight text-ink text-center">
            <em>Welcome</em>.
          </h1>
          <p className="text-sm text-ink-2 text-center mt-2 max-w-[280px]">
            Add your trip to Luna Travel and we&rsquo;ll keep everything in one place.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 max-w-md mx-auto w-full">
          <Field
            label="Booking reference"
            value={ref}
            onChange={setRef}
            placeholder="e.g. DEMO81297"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <Field
            label="Lead traveller last name"
            value={verifier}
            onChange={setVerifier}
            placeholder="e.g. Swan"
            autoCapitalize="words"
            autoComplete="family-name"
          />

          {error && (
            <div
              role="alert"
              className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2.5 leading-relaxed"
            >
              {error}
            </div>
          )}

          <div className="pt-2">
            <ActionButton type="submit" disabled={submitting} icon={<IconCheck size={18} />}>
              {submitting ? 'Looking up your trip…' : 'Find my trip'}
            </ActionButton>
          </div>
        </form>

        <div className="mt-8 text-center max-w-md mx-auto w-full space-y-3">
          <div className="text-[11px] text-ink-3 inline-flex items-center gap-1.5 justify-center">
            <IconLock size={11} />
            Your details are encrypted end-to-end.
          </div>
          <a
            href="mailto:hello@travelaire.co.uk"
            className="block text-sm text-teal-dark dark:text-teal-light hover:underline inline-flex items-center gap-1.5"
          >
            <IconHelp size={14} />
            Can&rsquo;t find your reference?
          </a>
        </div>

        {/* Demo hint for show */}
        <div className="mt-auto pt-6 text-center">
          <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mb-1">
            Demo mode
          </div>
          <p className="text-[11px] text-ink-3 leading-relaxed max-w-[280px] mx-auto">
            Try <strong className="text-ink-2 tabular">DEMO81297</strong> with{' '}
            <strong className="text-ink-2">Swan</strong>, or open the booking
            picker (long-press the L logo on the home screen) once you&rsquo;re in.
          </p>
        </div>
      </main>
    </PageEnter>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5 block">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect="off"
        spellCheck={false}
        className="w-full h-12 px-4 rounded-xl bg-surface border border-line text-ink placeholder-ink-3 focus:outline-none focus:border-teal text-sm font-medium"
      />
    </label>
  );
}
