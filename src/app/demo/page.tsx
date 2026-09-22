'use client';

/**
 * /demo — the page you send a travel agent.
 *
 * Not an admin tool. This is the first thing a prospect sees, so it is built to
 * sell: real destination photography, real screens from the running app, and
 * four trips they can be inside in under ten seconds.
 *
 * WHY QR AND TAP, BOTH. An agent at a desk reads this on a laptop and wants to
 * put the trip on the phone in their hand — that is a QR code. An agent sent
 * the link on WhatsApp is already holding the phone, and a QR code is then a
 * picture of a URL they cannot use. So the QR leads on wide screens and the
 * button leads on narrow ones, rather than showing one of them apologetically.
 *
 * Not under /agency or /admin, so it serves on the traveller domain and needs
 * no sign-in — a prospect has no account, and asking for one before the demo
 * would lose most of them.
 *
 * The QR codes encode absolute URLs built from window.location.origin, so the
 * page works unchanged on the live domain, a preview deployment and localhost.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { DEMO_TRIPS, CAPABILITIES, SCREENS, coverUrl, tripUrl, type DemoTrip } from './trips';

export default function DemoPage() {
  const [origin, setOrigin] = useState('');
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let alive = true;
    void (async () => {
      const made = await Promise.all(
        DEMO_TRIPS.map(async (t) => {
          try {
            const url = await QRCode.toDataURL(tripUrl(origin, t.reference), {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 320,
              color: { dark: '#0f172a', light: '#ffffff' },
            });
            return [t.reference, url] as const;
          } catch {
            // A missing QR must not take the card with it — the button still works.
            return [t.reference, ''] as const;
          }
        }),
      );
      if (alive) setQr(Object.fromEntries(made));
    })();
    return () => {
      alive = false;
    };
  }, [origin]);

  return (
    <main className="min-h-screen bg-surface text-ink">
      <ScanFirst />
      <Hero />

      {/* ── The trips ── */}
      <section id="trips" className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-4">
        <h2 className="font-serif text-[30px] sm:text-[38px] leading-tight text-ink">
          Four real trips. Pick one.
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Each one opens the whole app — itinerary, flights, hotels, documents, the destination
          guide and Luna. Nothing is a mock-up and nothing is locked.{' '}
          <span className="hidden font-medium text-ink md:inline">
            Point your phone camera at a code to open it there.
          </span>
          <span className="md:hidden">Tap to open.</span>
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {DEMO_TRIPS.map((trip) => (
            <TripCard key={trip.reference} trip={trip} origin={origin} qr={qr[trip.reference]} />
          ))}
        </div>
      </section>

      <Screens />
      <Capabilities />
      <Close />
    </main>
  );
}

/* ───────────────────────── Scan-first notice ───────────────────────── */

/**
 * The first thing a desktop visitor reads.
 *
 * Desktop no longer breaks the app — a trip opened on a laptop is framed at
 * phone size, so it looks like what it is. But framed is still not the same as
 * held: a prospect who scans gets it on the device it was designed for, can
 * add it to their home screen, and sees what their own traveller will see.
 *
 * So desktop is pointed at the QR codes first, for what it gains rather than
 * for what it would otherwise lose. The links stay — somebody with no phone to
 * hand should not be stuck.
 *
 * Hidden on phones, where it would be telling somebody to do what they are
 * already doing.
 */
function ScanFirst() {
  return (
    <div className="hidden bg-navy-dark text-white md:block">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
        <PhoneGlyph />
        <p className="text-[14px] leading-snug">
          <span className="font-semibold">Built for a phone.</span>{' '}
          <span className="text-white/80">
            Scan one of the QR codes below with your camera to see it on a phone, as your
            traveller will. In this browser it opens framed at phone size.
          </span>
        </p>
      </div>
    </div>
  );
}

function PhoneGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.75 5.5h2.5" />
    </svg>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <header className="relative isolate overflow-hidden">
      {/* The Maldives cover is the strongest of the four, so it opens. */}
      <Image
        src={coverUrl('mv', 'landscape')}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* The scrim is directional, and the direction changes with the screen.
          A flat wash dark enough to read 62px type over smothers the
          photograph, which is the one thing on the page doing the selling.

          Wide: weight the dark to the left, under the type, and let the right
          half stay a photograph. Narrow: there is no "beside", so it falls back
          to a vertical wash, lighter at the top where the image is best. */}
      <div className="absolute inset-0 sm:hidden bg-gradient-to-b from-navy-dark/72 via-navy-dark/78 to-navy-dark/92" />
      <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-navy-dark/95 via-navy-dark/72 to-navy-dark/15" />
      <div className="absolute inset-x-0 bottom-0 hidden h-32 sm:block bg-gradient-to-t from-navy-dark/70 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Luna Travel
        </p>
        <h1 className="mt-3 font-serif text-[38px] leading-[1.05] text-white sm:text-[62px] sm:leading-[1.03]">
          Your clients&rsquo; holiday,
          <br />
          in their pocket.
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
          Every booking becomes an app — their flights, their documents, their destination, under
          your name. No app store, no download, nothing for them to set up.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#trips"
            className="inline-flex h-12 items-center rounded-xl bg-white px-6 text-[15px] font-semibold text-navy-dark transition-transform hover:scale-[1.02] active:scale-[0.99]"
          >
            <span className="md:hidden">Open a trip</span>
            <span className="hidden md:inline">Scan a trip below</span>
          </a>
          <span className="text-[13px] text-white/70">
            <span className="md:hidden">Four live trips &middot; no sign-in</span>
            <span className="hidden md:inline">
              Four live trips &middot; no sign-in &middot; point your phone camera at a code
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Trip card ───────────────────────── */

function TripCard({ trip, origin, qr }: { trip: DemoTrip; origin: string; qr?: string }) {
  const href = origin ? tripUrl(origin, trip.reference) : `/?demo=${trip.reference}`;

  return (
    <article className="group overflow-hidden rounded-2xl border border-line-light bg-surface-2 transition-shadow hover:shadow-lg">
      <div className="relative h-44 sm:h-52">
        <Image
          src={coverUrl(trip.cc, 'landscape')}
          alt={trip.destination}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/80 via-navy-dark/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-serif text-[26px] leading-none text-white">{trip.destination}</h3>
          <p className="mt-1.5 text-[13px] text-white/80">
            {trip.place} &middot; {trip.duration}
          </p>
        </div>
      </div>

      <div className="flex gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{trip.highlight}</p>

          {/* Phones get the button, because they ARE the phone. */}
          <a
            href={href}
            className="mt-3 inline-flex h-11 items-center rounded-xl bg-navy px-5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.99] md:hidden"
          >
            Open this trip
          </a>

          {/* Not a button, because a button invites the click we are steering
              away from — but not removed either, since somebody with no phone
              to hand should not be stuck. Saying what they will get is what
              stops the phone frame reading as a broken page later. */}
          <a
            href={href}
            className="mt-3 hidden text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink-2 md:inline-block"
          >
            Open in this browser instead — shown at phone size
          </a>

          <p className="mt-2 font-mono text-[11px] text-ink-3">{trip.reference}</p>
        </div>

        {/* Desktop only: the phone is somewhere else, so bridge to it. Larger
            than it needs to be for scanning, because on this page it is the
            call to action rather than a convenience. */}
        {qr && (
          <div className="hidden shrink-0 text-center md:block">
            {/* Not next/image: a data: URL has no loader and needs none. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={`QR code opening the ${trip.destination} demo trip`}
              className="h-[128px] w-[128px] rounded-lg border border-line-light bg-white p-1.5"
            />
            <p className="mt-1.5 text-[11px] font-semibold text-ink-2">Scan to open</p>
          </div>
        )}
      </div>
    </article>
  );
}

/* ───────────────────────── Screens ───────────────────────── */

function Screens() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <h2 className="font-serif text-[30px] sm:text-[38px] leading-tight text-ink">
        What they actually get
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
        Shot from the running app, not drawn for a brochure.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {SCREENS.map((s) => (
          <figure key={s.src}>
            <div className="overflow-hidden rounded-[22px] border-[6px] border-navy-dark bg-navy-dark shadow-xl">
              <Image
                src={s.src}
                alt={s.alt}
                width={390}
                height={844}
                sizes="(max-width: 768px) 45vw, 22vw"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-2.5 text-center text-[12.5px] font-medium text-ink-2">
              {s.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Capabilities ───────────────────────── */

function Capabilities() {
  return (
    <section className="border-y border-line-light bg-surface-2">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <h2 className="font-serif text-[30px] sm:text-[38px] leading-tight text-ink">
          All of this is in the demo
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Not a roadmap. Open a trip above and every one of these is there to try.
        </p>

        <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title}>
              <h3 className="text-[15px] font-semibold text-ink">{c.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Close ───────────────────────── */

function Close() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
      <div className="rounded-2xl bg-navy-dark px-6 py-12 text-center sm:px-12">
        <h2 className="font-serif text-[30px] leading-tight text-white sm:text-[42px]">
          See your own bookings in it
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
          Send us one live booking reference and we will set it up under your own branding, so you
          can hand the app to the client whose trip it is.
        </p>
        <a
          href="https://www.travelgenix.io/what-we-do/luna-travel-app"
          className="mt-7 inline-flex h-12 items-center rounded-xl bg-white px-7 text-[15px] font-semibold text-navy-dark transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          Talk to us
        </a>
      </div>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-ink-3">
        The demo trips use sample data. No real traveller, booking or document appears on this page.
      </p>
    </section>
  );
}
