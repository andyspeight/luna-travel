'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageEnter } from '@/components/page-enter';
import { IconShare } from '@/components/icons';

/**
 * /install
 *
 * Two states on one route:
 *
 *   1. NO ?invite=... param → existing TravelTech-Show landing page.
 *      iPad at the stand, big QR, demo creds visible, "scan with your camera".
 *      Unchanged from the original implementation.
 *
 *   2. WITH ?invite=... param → invite redemption form.
 *      A real traveller has scanned a QR generated for their booking.
 *      We pre-fill any fields the agency set, ask for the rest, POST to
 *      /api/invites/{id}/redeem, and on success redirect to / (the app).
 *
 * The visual treatment (gradient, brand mark, type) is shared so both
 * states feel like the same product.
 */
export default function InstallPage() {
  return (
    <PageEnter>
      <Suspense fallback={null}>
        <InstallPageInner />
      </Suspense>
    </PageEnter>
  );
}

function InstallPageInner() {
  const params = useSearchParams();
  const inviteId = params.get('invite');

  if (inviteId && inviteId.length >= 8 && inviteId.length <= 64) {
    return <RedeemView inviteId={inviteId} />;
  }
  return <TradeShowView />;
}

// ─────────────────────────────────────────────────────────────────
// State 1: Trade-show landing (unchanged from the existing page)
// ─────────────────────────────────────────────────────────────────

function TradeShowView() {
  return (
    <main
      className="fixed inset-0 flex flex-col text-white overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 75% 5%, rgba(0,180,216,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 15% 95%, rgba(245,158,11,0.15), transparent 60%), linear-gradient(160deg, #0F172A 0%, #1B2B5B 45%, #082F49 100%)',
      }}
    >
      {/* Header */}
      <header className="px-8 pt-10 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center shadow-md">
            L
          </span>
          <span className="text-base font-semibold tracking-tight">Luna Travel</span>
        </div>
        <p className="text-xs text-white/55 uppercase tracking-[0.18em]">
          TravelTech Show · Stand TBC
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-4">
        <h1 className="font-serif text-[44px] leading-none tracking-tight text-center max-w-[480px] mb-3">
          Try it on <em className="text-teal-light">your phone</em>.
        </h1>
        <p className="text-base text-white/70 text-center max-w-[420px] leading-relaxed mb-10">
          Scan the code with your camera. Add to home screen.
          It looks and feels exactly like an app.
        </p>

        {/* QR card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/install-qr.png"
            alt="Scan to install Luna Travel"
            width={260}
            height={260}
            className="block"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Demo creds hint */}
        <div className="mt-8 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5">
            Demo credentials
          </div>
          <div className="text-sm font-semibold tracking-wide">
            <span className="text-white tabular">DEMO81297</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-white">Swan</span>
          </div>
        </div>
      </div>

      {/* Footer instruction strip */}
      <footer className="px-8 pb-8 pt-4">
        <div className="grid grid-cols-3 gap-3 max-w-[560px] mx-auto">
          <Step n={1} label="Scan with your camera" />
          <Step n={2} label="Tap the link that appears" />
          <Step n={3} label="Add to home screen" icon={<IconShare size={14} />} />
        </div>
        <p className="text-center text-[10px] text-white/40 mt-5 tracking-[0.06em]">
          travelgenix.io · The post-booking trip experience for SME travel agents
        </p>
      </footer>
    </main>
  );
}

function Step({ n, label, icon }: { n: number; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <span className="w-7 h-7 rounded-full bg-white/15 text-white text-xs font-semibold flex items-center justify-center backdrop-blur">
        {icon ?? n}
      </span>
      <span className="text-[11px] text-white/70 leading-tight">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// State 2: Redemption form
// ─────────────────────────────────────────────────────────────────

type InviteInfo = {
  status: 'pending' | 'redeemed' | 'expired';
  prefill: {
    bookingRef: string | null;
    // ⚠️ Security: email and departureDate are deliberately NOT pre-filled.
    // See /api/invites/[id]/route.ts for the rationale. The customer must
    // type these from memory or their booking confirmation — that's the
    // knowledge check that protects the booking if the invite URL leaks.
  };
};

function RedeemView({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite info on mount to pre-fill any fields the agency set
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invites/${inviteId}`);
        if (!res.ok) {
          if (!cancelled) setLoadFailed(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setInfo({
          status: data.status,
          prefill: data.prefill || { bookingRef: null },
        });
        if (data.prefill?.bookingRef) setBookingRef(data.prefill.bookingRef);
        // email and departureDate intentionally not pre-filled — see type comment above
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${inviteId}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          departureDate: departureDate.trim(),
          bookingRef: bookingRef.trim(),
        }),
      });
      if (!res.ok) {
        setError("We couldn't find a booking with those details. Please check and try again.");
        return;
      }
      // Success — session cookie is set by the endpoint. Redirect to the app.
      router.push('/');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    email.trim().length > 4 &&
    /^\d{4}-\d{2}-\d{2}$/.test(departureDate.trim()) &&
    bookingRef.trim().length >= 3 &&
    !submitting;

  return (
    <main
      className="fixed inset-0 flex flex-col text-white overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 75% 5%, rgba(0,180,216,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 15% 95%, rgba(245,158,11,0.15), transparent 60%), linear-gradient(160deg, #0F172A 0%, #1B2B5B 45%, #082F49 100%)',
      }}
    >
      {/* Header */}
      <header className="px-6 pt-10 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center shadow-md">
            L
          </span>
          <span className="text-base font-semibold tracking-tight">Luna Travel</span>
        </div>
        <p className="text-xs text-white/55 uppercase tracking-[0.18em]">
          Your trip companion
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* If we successfully loaded info and the invite is expired/redeemed */}
        {info?.status === 'expired' ? (
          <StateCard
            title="This invite has expired"
            body="Your travel agent will need to send you a new invite link. Get in touch with them and they'll sort it in a moment."
          />
        ) : info?.status === 'redeemed' ? (
          <StateCard
            title="This invite has already been used"
            body="If you've installed Luna Travel on another device, just open the app from your home screen. If you can't find it, ask your agent to resend the invite."
          />
        ) : (
          <>
            <h1 className="font-serif text-[36px] leading-none tracking-tight text-center max-w-[420px] mb-2">
              Welcome <em className="text-teal-light">aboard</em>.
            </h1>
            <p className="text-sm text-white/70 text-center max-w-[360px] leading-relaxed mb-7">
              Confirm your booking details to load your trip.
            </p>

            {/* Form card */}
            <div className="w-full max-w-[420px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5 shadow-2xl">
              <Field label="Booking reference">
                <input
                  type="text"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  placeholder="e.g. DEMO81297"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 h-11 text-white placeholder:text-white/35 text-[15px] tracking-wide tabular focus:outline-none focus:border-teal/70 focus:bg-white/10 transition-colors"
                />
              </Field>
              <Field label="Email on the booking" hint="The address your booking confirmation was sent to.">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 h-11 text-white placeholder:text-white/35 text-[15px] focus:outline-none focus:border-teal/70 focus:bg-white/10 transition-colors"
                />
              </Field>
              <Field
                label="Departure date"
                hint="As shown on your booking confirmation."
                last
              >
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 h-11 text-white text-[15px] focus:outline-none focus:border-teal/70 focus:bg-white/10 transition-colors"
                  style={{ colorScheme: 'dark' }}
                />
              </Field>

              {error && (
                <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-400/30 text-[13px] text-red-100 leading-snug">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full mt-4 h-12 rounded-xl bg-teal text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-teal-dark transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? 'Loading your trip…' : 'Load my trip'}
              </button>
            </div>

            <p className="mt-5 text-[11px] text-white/45 text-center max-w-[320px] leading-relaxed">
              We use these details to look up your booking with your travel agent. Nothing leaves this device until you tap the button.
            </p>
          </>
        )}

        {/* If the GET endpoint failed (network, bad invite ID), still show
            the form — the redemption endpoint will return its own generic
            error if the invite truly doesn't exist. Better than blocking
            the user on a transient fetch failure. */}
        {loadFailed && !info && (
          <div className="mt-5 text-[11px] text-white/45 text-center max-w-[320px]">
            Couldn&rsquo;t load invite details — you can still try the form below.
          </div>
        )}
      </div>

      <footer className="px-6 pb-8 pt-4 text-center">
        <p className="text-[10px] text-white/40 tracking-[0.06em]">
          travelgenix.io · The post-booking trip experience for SME travel agents
        </p>
      </footer>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? '' : 'mb-3'}>
      <label className="block text-[11px] uppercase tracking-[0.12em] text-white/55 mb-1.5 font-semibold">
        {label}
      </label>
      {children}
      {hint && <div className="text-[11px] text-white/45 mt-1.5">{hint}</div>}
    </div>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="w-full max-w-[420px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-6 shadow-2xl text-center">
      <h2 className="font-serif text-2xl tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-white/70 leading-relaxed">{body}</p>
    </div>
  );
}
