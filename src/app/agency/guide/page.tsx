'use client';

/**
 * /agency/guide — the setup guide.
 *
 * Luna Travel shipped without any written help at all. An agency arriving from
 * Control got eleven menu items and no answer to "what is this, and what do I
 * do first?".
 *
 * Written for somebody who has never seen the product and wants to be live
 * today: a step-by-step setup they can work straight through, then what their
 * travellers will actually see, then reference, then what to do when something
 * goes wrong.
 *
 * THE SCREENSHOTS ARE REAL. `npm run guide:shots` drives a browser at a running
 * app and captures the traveller screens at phone size (scripts/guide-
 * screenshots.mjs). Drawings of a screen drift from the product the first time
 * somebody moves a button; a screenshot that can be regenerated does not.
 *
 * The troubleshooting is not padding. Every entry is something that has already
 * gone wrong for a real agency, and the first one accounts for more failed
 * sign-ins than everything else put together.
 *
 * This and the walkthrough (tour.tsx) are deliberately different things. The
 * tour shows you where the controls are; this answers what the tour cannot, and
 * is meant to be re-read six months later.
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Palette, Send, Users, MessageSquare, FileText, BookOpen, Plane, Star,
  Settings, LayoutGrid, ChevronDown, Luggage, Lightbulb, LifeBuoy,
} from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card } from '../portal-chrome';

// ── Small pieces ─────────────────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', gap: 9, marginTop: 10,
        background: '#fffbeb', border: '1px solid #fcd34d',
        borderRadius: 11, padding: '9px 12px',
      }}
    >
      <Lightbulb size={14} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/** A real traveller screen, in a phone. */
function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <div
        style={{
          borderRadius: 18, overflow: 'hidden', border: `1px solid ${P.line}`,
          background: '#fff', boxShadow: '0 8px 22px rgba(13,24,54,0.10)',
          aspectRatio: '390 / 844',
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={390}
          height={844}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
      <figcaption style={{ fontSize: 12, color: P.ink3, lineHeight: 1.5, marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: SERIF, fontSize: 21, color: P.ink, margin: '32px 0 4px' }}>{children}</h2>
  );
}

// ── Setup, step by step ──────────────────────────────────────────────────────

const SETUP: { title: string; where: string; href: string; body: React.ReactNode; tip?: React.ReactNode }[] = [
  {
    title: 'Brand the app',
    where: 'App branding',
    href: '/agency/branding',
    body: (
      <>
        <p style={{ margin: 0 }}>
          Set your app name, pick your two brand colours, upload your logo and write a short
          welcome message. The phone preview beside the form re-skins as you type, so you can see
          exactly what a traveller will open.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          Press <strong>Save branding</strong> when it looks right. It goes live immediately for
          every traveller — there is nothing to republish.
        </p>
      </>
    ),
    tip: (
      <>
        Do this <strong>before</strong> you send anyone a link. Branding applies the moment it is
        saved, so a traveller who opened the app yesterday sees today&rsquo;s brand — but first
        impressions only happen once.
      </>
    ),
  },
  {
    title: 'Say where replies should go',
    where: 'Settings',
    href: '/agency/settings',
    body: (
      <p style={{ margin: 0 }}>
        One field: the email address that should receive traveller replies. Use the inbox somebody
        actually watches — a shared team address is usually better than a person&rsquo;s.
      </p>
    ),
    tip: (
      <>
        Leave it blank and we fall back to whoever last sent an access link. That follows whoever
        clicked most recently rather than whoever is on duty, so replies end up in the wrong place
        eventually.
      </>
    ),
  },
  {
    title: 'Add anything the booking does not carry',
    where: 'Documents',
    href: '/agency/documents',
    body: (
      <p style={{ margin: 0 }}>
        Tickets and vouchers already on the booking appear in the app on their own. Use this for
        the extras you hold separately — insurance certificates, visa letters, parking
        confirmations, a printed itinerary.
      </p>
    ),
    tip: <>Optional, and you can come back to it. Do not let it hold up sending the first link.</>,
  },
  {
    title: 'Write a trip page (optional, and the best bit)',
    where: 'Trip pages',
    href: '/agency/content',
    body: (
      <p style={{ margin: 0 }}>
        Your own words about the destination: what to know before going, where you would eat, the
        thing everyone misses. Pin places on the map. This is what makes the app feel like it came
        from you rather than from a booking system.
      </p>
    ),
    tip: (
      <>
        Write one for a destination you sell often and it is reused for every booking there. An
        hour once, then it works for the rest of the year.
      </>
    ),
  },
  {
    title: 'Send a real traveller their access',
    where: 'Send access',
    href: '/agency/access',
    body: (
      <>
        <p style={{ margin: 0 }}>
          Enter the booking reference, <strong>the email address held on the booking</strong>, and
          the departure date. You get back a link and a QR code — send them whichever suits.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          We check the booking is genuinely reachable before creating the link, so a wrong
          reference or date is caught here at your desk rather than on your customer&rsquo;s phone.
        </p>
      </>
    ),
    tip: (
      <>
        Use a real booking, not a test one. It takes a minute and it is the only way to see the
        whole thing work end to end — including what your traveller receives.
      </>
    ),
  },
  {
    title: 'Check it landed',
    where: 'Travellers',
    href: '/agency/travellers',
    body: (
      <p style={{ margin: 0 }}>
        Once they open the app they appear here, with what they have opened and when. If nobody
        appears, the invite list on <strong>Send access</strong> tells you whether the link was
        ever opened at all — which separates &ldquo;they have not got round to it&rdquo; from
        &ldquo;something is wrong&rdquo;.
      </p>
    ),
  },
];

// ── Reference ────────────────────────────────────────────────────────────────

const SECTIONS: { icon: React.ReactNode; name: string; href: string; body: string }[] = [
  { icon: <LayoutGrid size={16} />, name: 'Overview', href: '/agency', body: 'Who is travelling soon, who has opened their app, and anything waiting on you. The one to check each morning.' },
  { icon: <Users size={16} />, name: 'Travellers', href: '/agency/travellers', body: 'Everyone who has opened their trip. Each person on a booking gets their own row, so a family of four shows as four people — message them individually, and remove one without touching the rest.' },
  { icon: <Plane size={16} />, name: 'Flights', href: '/agency/flights', body: 'Live status for flights on your bookings. Travellers see the same thing, and get a notification when a gate or a time changes.' },
  { icon: <MessageSquare size={16} />, name: 'Messages', href: '/agency/messages', body: 'A two-way thread with a traveller. Yours arrives as a notification on their phone; their replies come back here and to your reply address.' },
  { icon: <Star size={16} />, name: 'Reviews', href: '/agency/reviews', body: 'Travellers are asked how the trip went once they are home. What they say lands here.' },
  { icon: <Palette size={16} />, name: 'App branding', href: '/agency/branding', body: 'Name, colours, logo, welcome message. Changes go live immediately.' },
  { icon: <Luggage size={16} />, name: 'Trips', href: '/agency/trips', body: 'Bookings that are not in Travelify. Add one by hand and it behaves exactly like a live booking, app and all.' },
  { icon: <BookOpen size={16} />, name: 'Trip pages', href: '/agency/content', body: 'Your own destination notes, recommendations and pinned places.' },
  { icon: <FileText size={16} />, name: 'Documents', href: '/agency/documents', body: 'The extras you hold that the booking does not carry. They preview in the app and stay readable with no signal once opened.' },
  { icon: <Send size={16} />, name: 'Send access', href: '/agency/access', body: 'Create the link and QR code that let a traveller in, and see what happened to every link you have sent.' },
  { icon: <Settings size={16} />, name: 'Settings', href: '/agency/settings', body: 'Where traveller replies are emailed.' },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'My traveller says the app cannot find their booking',
    a: (
      <>
        <p style={{ margin: 0 }}>
          Nearly always the email. To get in, a traveller enters three things — the booking
          reference, the departure date, and{' '}
          <strong>the email address held against the booking</strong>. All three have to match, and
          the email is the one people get wrong: they use their own address when the booking was
          made under their partner&rsquo;s, or under the address of whoever in your office made it.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          Check the email on the booking itself and tell them to use exactly that. If it turns out
          to be an address inside your own agency, change it on the booking — otherwise no
          traveller on that booking can ever get in.
        </p>
      </>
    ),
  },
  {
    q: 'Can I send one link to a whole family?',
    a: (
      <>
        Yes, and you should. Everyone travelling can use the same link, and each person taps their
        own name from the booking when they open it, so they each get their own record and their
        own thread with you. They will each need the email on the booking to get past the check, so
        send it along with the link.
      </>
    ),
  },
  {
    q: 'They lost the link',
    a: (
      <>
        Send it again from <Link href="/agency/access" style={{ color: P.tealDark }}>Send access</Link>.
        Links do not expire quickly and the same one keeps working, so there is no harm in
        resending. If somebody should no longer have access, revoke that link from the list.
      </>
    ),
  },
  {
    q: 'Do they have to install anything?',
    a: (
      <>
        No. It opens in the browser like any web page. Their phone will offer to add it to the home
        screen, and once they do it behaves like an app — full screen, an icon, and notifications.
        Worth encouraging, because that is when notifications start working.
      </>
    ),
  },
  {
    q: 'Will they know it is us?',
    a: (
      <>
        That is the point. Your name, your logo and your colours throughout, on your own web
        address. Travelgenix is not mentioned anywhere a traveller can see.
      </>
    ),
  },
  {
    q: 'A document will not open',
    a: (
      <>
        Documents come from the booking, and a supplier&rsquo;s link can expire. Open the document
        from the booking yourself: if it fails for you too, the supplier link is dead and re-issuing
        it fixes the app as well. If it works for you but not in the app, tell us — that one is
        ours.
      </>
    ),
  },
  {
    q: 'When should I send the link?',
    a: (
      <>
        As soon as the booking is confirmed. The app is most useful in the weeks beforehand — the
        countdown, the documents building up, your trip pages — and a traveller who installs it
        early has it on their home screen by the time they travel.
      </>
    ),
  },
  {
    q: 'Someone has left our agency — what happens to their travellers?',
    a: (
      <>
        Nothing breaks; travellers belong to the agency, not to a person. Check{' '}
        <Link href="/agency/settings" style={{ color: P.tealDark }}>Settings</Link> though — if
        replies were going to their address, point them somewhere else.
      </>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

function Guide() {
  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Guide</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
        Luna Travel gives every one of your travellers their own branded app for their trip:
        documents, flight times, your recommendations, and a direct line back to you. Here is how to
        set it up, what your customers will see, and what to do when something is not right.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="Prefer to be shown?">
          The <strong>Show me how</strong> button in the bottom corner walks you round the portal,
          pointing at the real controls. It runs by itself the first time you sign in, and you can
          replay it whenever you like.
        </Callout>
      </div>

      {/* ── Setup ────────────────────────────────────────────────────── */}
      <H2>Setting up, step by step</H2>
      <p style={{ color: P.ink3, fontSize: 13, margin: '0 0 14px' }}>
        Work straight down. Steps 1, 2 and 5 are the ones that matter; the rest can wait.
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {SETUP.map((step, i) => (
          <li key={step.title} style={{ ...card, padding: '15px 17px', display: 'flex', gap: 13 }}>
            <span
              aria-hidden
              style={{
                width: 27, height: 27, borderRadius: 999, flexShrink: 0,
                background: `${P.teal}1f`, color: P.tealDark,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800,
              }}
            >
              {i + 1}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{step.title}</span>
                <Link
                  href={step.href}
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: P.tealDark, textDecoration: 'none',
                    border: `1px solid ${P.teal}44`, borderRadius: 999, padding: '2px 9px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.where} →
                </Link>
              </div>
              <div style={{ fontSize: 13.5, color: P.ink2, lineHeight: 1.6, marginTop: 6 }}>
                {step.body}
              </div>
              {step.tip && <Tip>{step.tip}</Tip>}
            </div>
          </li>
        ))}
      </ol>

      {/* ── What they see ────────────────────────────────────────────── */}
      <H2>What your traveller sees</H2>
      <p style={{ color: P.ink3, fontSize: 13, margin: '0 0 14px' }}>
        Real screens, in your colours rather than ours.
      </p>

      <div
        style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        }}
      >
        <Shot
          src="/guide/traveller-itinerary.png"
          alt="The itinerary screen, showing flights, a lounge and hotel check-in on a timeline"
          caption="Every flight, transfer, hotel and ticket on one timeline. Tapping anything opens the detail."
        />
        <Shot
          src="/guide/traveller-documents.png"
          alt="The documents screen, listing a booking pack, e-tickets, vouchers and an ATOL certificate"
          caption="Tickets and vouchers from the booking, plus anything you add. Saved to the device, so they open with no signal."
        />
        <Shot
          src="/guide/traveller-destination.png"
          alt="The destination guide screen"
          caption="The destination guide — weather, what is on while they are there, and your own trip pages."
        />
      </div>

      {/* ── What they do ─────────────────────────────────────────────── */}
      <H2>What your traveller actually does</H2>
      <div style={{ ...card, padding: '16px 18px', marginTop: 10 }}>
        <ol style={{ margin: 0, paddingLeft: 18, color: P.ink2, fontSize: 13.5, lineHeight: 1.75 }}>
          <li>They tap your link, or scan the QR code.</li>
          <li>
            They enter the booking reference, the departure date and{' '}
            <strong>the email on the booking</strong>. This is the step that goes wrong — see the
            first question below.
          </li>
          <li>If more than one person is travelling, they tap their own name from the booking.</li>
          <li>
            Their trip opens. Their phone offers to add it to the home screen, and from then on it
            behaves like an app and can notify them.
          </li>
        </ol>
        <Tip>
          Send the link with a line saying which email address to use. It costs you one sentence
          and removes the single most common reason a traveller cannot get in.
        </Tip>
      </div>

      {/* ── Sections ─────────────────────────────────────────────────── */}
      <H2>Every section, briefly</H2>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {SECTIONS.map((s) => (
          <div key={s.name} style={{ ...card, padding: '13px 15px', display: 'flex', gap: 12 }}>
            <span
              aria-hidden
              style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: `${P.navy}0f`, color: P.navy,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {s.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <Link href={s.href} style={{ fontSize: 14, fontWeight: 700, color: P.ink, textDecoration: 'none' }}>
                {s.name}
              </Link>
              <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.55, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <H2>When something is not right</H2>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {FAQ.map((item) => (
          <Question key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Callout title="Still stuck?" icon={<LifeBuoy size={16} />}>
          Send us the booking reference and the email address the traveller used. Those two
          together are almost always enough for us to tell you what happened in a couple of minutes.
        </Callout>
      </div>
    </div>
  );
}

function Question({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '14px 16px', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: P.ink }}>{q}</span>
        <ChevronDown
          size={16}
          style={{
            color: P.ink3, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .18s ease',
          }}
        />
      </button>
      {open && (
        <div style={{ padding: '0 16px 15px', fontSize: 13, color: P.ink2, lineHeight: 1.6 }}>{a}</div>
      )}
    </div>
  );
}

export default function AgencyGuidePage() {
  return (
    <AgencyShell active="guide">
      <Guide />
    </AgencyShell>
  );
}
