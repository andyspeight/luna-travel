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
 *
 *   2. WITH ?invite=... param → invite redemption, now in two phases:
 *        a. GATE   — a warm, branded verification screen. The traveller
 *           confirms booking ref + email + departure date. We deliberately
 *           reveal nothing about the trip here, so a forwarded or leaked
 *           link exposes no destination or dates. POSTs to
 *           /api/invites/{id}/redeem.
 *        b. REVEAL — on success the redeem endpoint returns the trip facts
 *           and sets the session cookie. We show the Holiday Pass: a
 *           countdown, the destination and an add-to-home moment, then
 *           "Open my holiday" routes into the app at /.
 *
 * The visual treatment (gradient, brand mark, serif type) is shared so every
 * state feels like the same product.
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

// Shared background — the Luna Travel ocean gradient.
const OCEAN_BG =
  'radial-gradient(ellipse 80% 60% at 75% 5%, rgba(0,180,216,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 15% 95%, rgba(245,158,11,0.15), transparent 60%), linear-gradient(160deg, #0F172A 0%, #1B2B5B 45%, #082F49 100%)';

// ─────────────────────────────────────────────────────────────────
// State 1: Trade-show landing
// ─────────────────────────────────────────────────────────────────

function TradeShowView() {
  return (
    <main
      className="fixed inset-0 flex flex-col text-white overflow-hidden"
      style={{ background: OCEAN_BG }}
    >
      <header className="px-8 pt-10 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center shadow-md">
            L
          </span>
          <span className="text-base font-semibold tracking-tight">Luna Travel</span>
        </div>
        <p className="text-xs text-white/55 uppercase tracking-[0.18em]">
          TravelTech Show · ExCeL · Stand N60
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-4">
        <h1 className="font-serif text-[44px] leading-none tracking-tight text-center max-w-[480px] mb-3">
          Try it on <em className="text-teal-light">your phone</em>.
        </h1>
        <p className="text-base text-white/70 text-center max-w-[420px] leading-relaxed mb-10">
          Scan the code with your camera. Add to home screen.
          It looks and feels exactly like an app.
        </p>

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
// State 2: Redemption — gate then reveal
// ─────────────────────────────────────────────────────────────────

type InviteInfo = {
  status: 'pending' | 'redeemed' | 'expired';
  prefill: { bookingRef: string | null };
};

type Trip = {
  destination: string | null;
  departureDate: string | null; // YYYY-MM-DD
  returnDate: string | null;
  leadName: string | null;
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
  const [trip, setTrip] = useState<Trip | null>(null); // set on success → switches to reveal

  // Fetch invite info on mount to pre-fill any fields the agency set.
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
      // Success — session cookie is set by the endpoint. Show the reveal.
      const data = await res.json().catch(() => ({}));
      setTrip(
        (data && data.trip) || {
          destination: null,
          departureDate: departureDate.trim() || null,
          returnDate: null,
          leadName: null,
        },
      );
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

  // ── Reveal phase ────────────────────────────────────────────────
  if (trip) {
    return <RevealView trip={trip} onOpen={() => router.push('/')} />;
  }

  // ── Gate phase ──────────────────────────────────────────────────
  return (
    <main
      className="fixed inset-0 flex flex-col text-white overflow-y-auto"
      style={{ background: OCEAN_BG }}
    >
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

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
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
              Your holiday is <em className="text-teal-light">ready</em>.
            </h1>
            <p className="text-sm text-white/70 text-center max-w-[360px] leading-relaxed mb-7">
              One quick check it&rsquo;s you, then your whole trip opens up.
            </p>

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

        {loadFailed && !info && (
          <div className="mt-5 text-[11px] text-white/45 text-center max-w-[320px]">
            Couldn&rsquo;t load invite details — you can still try the form above.
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

// ─────────────────────────────────────────────────────────────────
// State 2b: The reveal — the Holiday Pass
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Add to home screen — platform aware.
//
// beforeinstallprompt fires ONCE, early, on the /install page load — long
// before this reveal mounts (the traveller must clear the gate first). So we
// capture it at MODULE scope and hold it, otherwise it's gone by reveal time.
//
//   - Chromium (Android, desktop Chrome/Edge): real one-tap install button.
//   - iOS Safari (no beforeinstallprompt): a sheet showing the real Share
//     glyph + the two steps, because iOS only allows a manual add.
//   - Already installed (standalone): renders nothing.
//   - Anything else (desktop Safari, Firefox): renders nothing, rather than
//     an instruction that won't match what the user sees.
// ─────────────────────────────────────────────────────────────────

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

let _deferredPrompt: BIPEvent | null = null;
const _installSubs = new Set<() => void>();
function _notifyInstall() {
  _installSubs.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e as BIPEvent;
    _notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    _notifyInstall();
  });
}

function useInstallState() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    _installSubs.add(fn);
    return () => {
      _installSubs.delete(fn);
    };
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari exposes this non-standard flag when launched from home screen
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  // iPadOS reports as "Macintosh", so a touch check tells it apart from a real Mac.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') &&
      typeof document !== 'undefined' &&
      'ontouchend' in document);

  const promptInstall = async () => {
    if (!_deferredPrompt) return;
    const p = _deferredPrompt;
    _deferredPrompt = null;
    _notifyInstall();
    try {
      await p.prompt();
      await p.userChoice;
    } catch {
      /* user dismissed — nothing to do */
    }
  };

  return { canPrompt: !!_deferredPrompt, isStandalone, isIOS, promptInstall };
}

// The iOS Share glyph: a box open at the top with an up-arrow. Matches what
// the traveller actually sees in Safari, so the instruction is recognisable.
function ShareGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function InstallAffordance() {
  const { canPrompt, isStandalone, isIOS, promptInstall } = useInstallState();
  const [sheet, setSheet] = useState(false);

  if (isStandalone) return null; // already added — say nothing
  if (!canPrompt && !isIOS) return null; // can't help cleanly — don't clutter

  return (
    <>
      <button
        type="button"
        onClick={() => (canPrompt ? promptInstall() : setSheet(true))}
        className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/20 bg-white/5 text-white/85 text-[13px] font-medium hover:bg-white/10 hover:border-white/30 transition-colors"
      >
        <ShareGlyph size={16} />
        Add to home screen
      </button>

      {sheet && <IOSInstallSheet onClose={() => setSheet(false)} />}
    </>
  );
}

function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUp(true), 10);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add Luna Travel to your home screen"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: up ? 1 : 0 }}
      />
      <div
        className="relative w-full max-w-[420px] m-3 rounded-3xl bg-white text-navy p-6 shadow-2xl"
        style={{
          transform: up ? 'none' : 'translateY(16px)',
          opacity: up ? 1 : 0,
          transition: 'transform .28s ease-out, opacity .28s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-[22px] leading-tight tracking-tight pr-6">
            Keep your trip one tap away
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-none w-8 h-8 -mt-1 -mr-1 rounded-full hover:bg-black/5 flex items-center justify-center text-navy/50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <p className="text-[14px] text-navy/65 leading-relaxed mb-5">
          Add Luna Travel to your home screen and it opens like an app, with
          your trip, your documents and your agent always to hand.
        </p>

        <ol className="space-y-3">
          <li className="flex items-center gap-3">
            <span className="flex-none w-9 h-9 rounded-xl bg-navy/5 flex items-center justify-center text-teal">
              <ShareGlyph size={20} />
            </span>
            <span className="text-[14px] text-navy/85">
              Tap the <span className="font-semibold text-navy">Share</span> button
              <span className="block text-[12px] text-navy/50">
                Bottom of the screen on iPhone, top right on iPad
              </span>
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-none w-9 h-9 rounded-xl bg-navy/5 flex items-center justify-center text-teal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="4" />
                <path d="M12 9v6M9 12h6" />
              </svg>
            </span>
            <span className="text-[14px] text-navy/85">
              Choose <span className="font-semibold text-navy">Add to Home Screen</span>
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-12 rounded-2xl bg-teal text-white font-semibold text-[15px] hover:bg-teal-dark transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function RevealView({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);

  const leadFirst = (trip.leadName || '').trim().split(/\s+/)[0] || '';
  const dest = trip.destination?.trim() || '';
  const days = daysUntil(trip.departureDate);
  const range = fmtRange(trip.departureDate, trip.returnDate);
  const nights = nightsBetween(trip.departureDate, trip.returnDate);

  const headline = dest
    ? `${leadFirst ? leadFirst + ', ' : ''}your ${dest} holiday is almost here.`
    : `${leadFirst ? leadFirst + ', ' : ''}your holiday is almost here.`;

  let cdNum = '✦';
  let cdLabel = 'enjoy every minute';
  if (typeof days === 'number') {
    if (days > 1) { cdNum = String(days); cdLabel = 'days until you fly'; }
    else if (days === 1) { cdNum = '1'; cdLabel = 'day until you fly'; }
    else if (days === 0) { cdNum = 'Today'; cdLabel = 'you fly today'; }
    else { cdNum = '✦'; cdLabel = 'enjoy every minute'; }
  }

  return (
    <main
      className="fixed inset-0 flex flex-col text-white overflow-y-auto"
      style={{ background: OCEAN_BG }}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-10 transition-all duration-700 ease-out"
        style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(12px)' }}
      >
        <div className="inline-flex items-center gap-2.5 mb-8">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-teal text-white font-bold text-xs flex items-center justify-center shadow-md">
            L
          </span>
          <span className="text-sm font-semibold tracking-tight text-white/90">Luna Travel</span>
        </div>

        <h1 className="font-serif text-[34px] leading-[1.05] tracking-tight text-center max-w-[440px] mb-9">
          {headline.split(dest).map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>{part}<em className="text-teal-light not-italic">{dest}</em></span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </h1>

        {/* Countdown */}
        <div className="text-center mb-9">
          <div className="font-serif text-[76px] leading-none text-teal-light tracking-tight">
            {cdNum}
          </div>
          <div className="mt-2 text-[12px] uppercase tracking-[0.16em] text-white/55 font-semibold">
            {cdLabel}
          </div>
        </div>

        {/* At a glance */}
        {(range || nights) && (
          <div className="flex items-center gap-3 text-sm text-white/75 mb-9">
            {range && <span>{range}</span>}
            {range && nights && <span className="text-white/30">·</span>}
            {nights && <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>}
          </div>
        )}

        {/* What's inside */}
        <div className="w-full max-w-[360px] space-y-3 mb-9">
          <InsideRow
            icon={<path d="M6 4v16M6 7h11l-2.2 3L17 13H6" />}
            label="Your day-by-day plan"
          />
          <InsideRow
            icon={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>}
            label="Tickets and documents, even offline"
          />
          <InsideRow
            icon={<path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.4 8.4 0 1 1 21 11.5z" />}
            label="Your agent, a tap away"
          />
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onOpen}
          className="w-full max-w-[360px] h-14 rounded-2xl bg-teal text-white font-semibold text-[16px] hover:bg-teal-dark transition-colors flex items-center justify-center gap-2 shadow-2xl"
        >
          Open my holiday
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>

        {/* Add to home screen — platform aware, see InstallAffordance */}
        <InstallAffordance />
      </div>

      <footer className="px-6 pb-8 pt-2 text-center">
        <p className="text-[10px] text-white/40 tracking-[0.06em]">
          travelgenix.io · The post-booking trip experience for SME travel agents
        </p>
      </footer>
    </main>
  );
}

function InsideRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-teal-light flex-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="text-[14px] text-white/85">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Date helpers (UTC-safe, no external deps)
// ─────────────────────────────────────────────────────────────────

function daysUntil(dep?: string | null): number | null {
  if (!dep || !/^\d{4}-\d{2}-\d{2}$/.test(dep)) return null;
  const t = new Date(dep + 'T12:00:00Z').getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function nightsBetween(dep?: string | null, ret?: string | null): number | null {
  if (!dep || !ret) return null;
  const a = new Date(dep + 'T00:00:00Z').getTime();
  const b = new Date(ret + 'T00:00:00Z').getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const n = Math.round((b - a) / 86400000);
  return n > 0 ? n : null;
}

function fmtRange(dep?: string | null, ret?: string | null): string | null {
  if (!dep || !/^\d{4}-\d{2}-\d{2}$/.test(dep)) return null;
  const d = new Date(dep + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const r = ret && /^\d{4}-\d{2}-\d{2}$/.test(ret) ? new Date(ret + 'T00:00:00Z') : null;
  const mon = (x: Date) => x.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const day = (x: Date) => x.getUTCDate();
  const yr = d.getUTCFullYear();
  if (r && !Number.isNaN(r.getTime())) {
    if (mon(d) === mon(r) && d.getUTCFullYear() === r.getUTCFullYear()) {
      return `${day(d)} – ${day(r)} ${mon(r)} ${yr}`;
    }
    return `${day(d)} ${mon(d)} – ${day(r)} ${mon(r)} ${r.getUTCFullYear()}`;
  }
  return `${day(d)} ${mon(d)} ${yr}`;
}
