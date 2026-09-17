'use client';

/**
 * /agency/guide — the setup guide.
 *
 * Luna Travel shipped without any written help at all. An agency arriving from
 * Control got eleven menu items and no answer to "what is this, and what do I
 * do first?".
 *
 * Written for someone who has never seen the product and wants to be live
 * today, so it opens with a checklist and only then explains each section. The
 * troubleshooting at the end is not padding: every item in it is something that
 * has already gone wrong for a real agency, and the first one accounts for more
 * failed sign-ins than everything else put together.
 *
 * The walkthrough (see tour.tsx) and this page are deliberately different
 * things. The tour shows you where the controls are; this answers the questions
 * the tour cannot, and it is here to be re-read six months later.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Palette, Send, Users, MessageSquare, FileText, BookOpen, Plane, Star,
  Settings, LayoutGrid, ChevronDown, CheckCircle2, Luggage,
} from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card } from '../portal-chrome';

// ── Getting live ─────────────────────────────────────────────────────────────

const CHECKLIST: { title: string; body: React.ReactNode; href?: string }[] = [
  {
    title: 'Brand the app',
    href: '/agency/branding',
    body: (
      <>
        Your name, two colours, a logo and a welcome message. The phone preview re-skins as you
        type. Do this before you send anyone a link — it is the first thing they see, and your
        travellers never see the word Travelgenix anywhere.
      </>
    ),
  },
  {
    title: 'Set your reply address',
    href: '/agency/settings',
    body: (
      <>
        Where traveller replies get emailed. Skip it and we fall back to whoever last sent an
        access link, which follows whoever clicked most recently rather than whoever actually
        watches the inbox.
      </>
    ),
  },
  {
    title: 'Send one real traveller their access',
    href: '/agency/access',
    body: (
      <>
        Booking reference, the email held on the booking, and the departure date. You get a link
        and a QR code to send them however you like. Do a live booking rather than a test one —
        it takes a minute and it is the only way to see the whole thing work.
      </>
    ),
  },
  {
    title: 'Check it landed',
    href: '/agency/travellers',
    body: (
      <>
        Once they open it they appear under Travellers, with what they have opened and when. If
        nothing shows, the invite list on Send access tells you whether the link was ever opened.
      </>
    ),
  },
];

// ── What each section does ───────────────────────────────────────────────────

const SECTIONS: { icon: React.ReactNode; name: string; href: string; body: React.ReactNode }[] = [
  {
    icon: <LayoutGrid size={16} />,
    name: 'Overview',
    href: '/agency',
    body: 'Who is travelling soon, who has opened their app, and anything waiting on a reply from you. The one to check each morning.',
  },
  {
    icon: <Users size={16} />,
    name: 'Travellers',
    href: '/agency/travellers',
    body: 'Everyone who has opened their trip. Each person on a booking gets their own row, so a family of four shows as four people — you can see who has actually opened it, message them individually, and remove one person without touching the rest.',
  },
  {
    icon: <Plane size={16} />,
    name: 'Flights',
    href: '/agency/flights',
    body: 'Live status for flights on your bookings. Travellers see the same thing in the app, and get a push notification when a gate or a time changes.',
  },
  {
    icon: <MessageSquare size={16} />,
    name: 'Messages',
    href: '/agency/messages',
    body: 'A two-way thread with a traveller. Yours arrives as a push notification on their phone — far more use than an email nobody opens in an airport — and their replies come back here and to your reply address.',
  },
  {
    icon: <Star size={16} />,
    name: 'Reviews',
    href: '/agency/reviews',
    body: 'Travellers are asked how the trip went once they are home. What they say lands here.',
  },
  {
    icon: <Palette size={16} />,
    name: 'App branding',
    href: '/agency/branding',
    body: 'Name, colours, logo, welcome message. Changes go live for every traveller immediately — there is nothing to republish.',
  },
  {
    icon: <Luggage size={16} />,
    name: 'Trips',
    href: '/agency/trips',
    body: 'Bookings that are not in Travelify. Add one by hand and it behaves exactly like a live booking, app and all.',
  },
  {
    icon: <BookOpen size={16} />,
    name: 'Trip pages',
    href: '/agency/content',
    body: 'Your own words for a destination — what to know before going, where you would eat, places pinned on a map. This is where a booking stops feeling like a receipt.',
  },
  {
    icon: <FileText size={16} />,
    name: 'Documents',
    href: '/agency/documents',
    body: 'Tickets and vouchers already on the booking appear automatically. Use this for the extras: insurance, visa letters, parking. They preview in the app and stay readable with no signal once opened.',
  },
  {
    icon: <Send size={16} />,
    name: 'Send access',
    href: '/agency/access',
    body: 'Create the link and QR code that let a traveller in, and see what happened to every link you have sent.',
  },
  {
    icon: <Settings size={16} />,
    name: 'Settings',
    href: '/agency/settings',
    body: 'Where traveller replies are emailed.',
  },
];

// ── Things that actually go wrong ────────────────────────────────────────────

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'My traveller says the app cannot find their booking',
    a: (
      <>
        <p style={{ margin: 0 }}>
          Nearly always the email. To get in, a traveller enters three things — the booking
          reference, the departure date, and <strong>the email address held against the booking</strong>.
          All three have to match what the booking system holds, and the email is the one people
          get wrong: they use their own address when the booking was made under their partner&rsquo;s,
          or under the address of whoever in your office made it.
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
        own thread with you. They will each need the email on the booking to get past the check,
        so send it to them along with the link.
      </>
    ),
  },
  {
    q: 'They lost the link',
    a: (
      <>
        Send it again from <Link href="/agency/access" style={{ color: P.tealDark }}>Send access</Link>.
        Links do not expire quickly and the same one keeps working, so there is no harm in
        resending. If someone should no longer have access, revoke that link from the list.
      </>
    ),
  },
  {
    q: 'Do they have to install anything?',
    a: (
      <>
        No. It opens in the browser like any web page. Their phone will offer to add it to the home
        screen, and once they do it behaves like an app — full screen, an icon, and notifications.
        Worth encouraging, because that is when push notifications start working.
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
        it on the booking fixes the app as well. If it works for you but not in the app, tell us —
        that one is ours.
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
];

// ── Page ─────────────────────────────────────────────────────────────────────

function Guide() {
  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Guide</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
        Luna Travel gives every one of your travellers their own branded app for their trip:
        documents, flight times, your recommendations, and a direct line back to you. Here is how to
        set it up and what everything does.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="Prefer to be shown?">
          The <strong>Show me how</strong> button in the bottom corner walks you round the portal,
          pointing at the real controls. It runs by itself the first time you sign in, and you can
          replay it whenever you like.
        </Callout>
      </div>

      {/* ── Get live ─────────────────────────────────────────────────── */}
      <h2 style={{ fontFamily: SERIF, fontSize: 21, color: P.ink, margin: '28px 0 4px' }}>
        Four things and you are live
      </h2>
      <p style={{ color: P.ink3, fontSize: 13, margin: '0 0 14px' }}>
        Ten minutes, start to finish.
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {CHECKLIST.map((item, i) => (
          <li key={item.title} style={{ ...card, padding: '14px 16px', display: 'flex', gap: 13 }}>
            <span
              aria-hidden
              style={{
                width: 26, height: 26, borderRadius: 999, flexShrink: 0,
                background: `${P.teal}1f`, color: P.tealDark,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800,
              }}
            >
              {i + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>
                {item.href ? (
                  <Link href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {item.title}
                  </Link>
                ) : (
                  item.title
                )}
              </div>
              <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.55, marginTop: 3 }}>{item.body}</div>
            </div>
          </li>
        ))}
      </ol>

      {/* ── What a traveller sees ────────────────────────────────────── */}
      <h2 style={{ fontFamily: SERIF, fontSize: 21, color: P.ink, margin: '30px 0 4px' }}>
        What your traveller actually does
      </h2>
      <div style={{ ...card, padding: '16px 18px', marginTop: 10 }}>
        <ol style={{ margin: 0, paddingLeft: 18, color: P.ink2, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>They tap your link, or scan the QR code.</li>
          <li>
            They enter the booking reference, the departure date and{' '}
            <strong>the email on the booking</strong>. This is the bit that goes wrong — see the
            first question below.
          </li>
          <li>If more than one person is travelling, they tap their own name from the booking.</li>
          <li>
            Their trip opens. Their phone offers to add it to the home screen, and from then on it
            behaves like an app and can send them notifications.
          </li>
        </ol>
      </div>

      {/* ── Sections ─────────────────────────────────────────────────── */}
      <h2 style={{ fontFamily: SERIF, fontSize: 21, color: P.ink, margin: '30px 0 12px' }}>
        Every section, briefly
      </h2>
      <div style={{ display: 'grid', gap: 8 }}>
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
              <Link
                href={s.href}
                style={{ fontSize: 14, fontWeight: 700, color: P.ink, textDecoration: 'none' }}
              >
                {s.name}
              </Link>
              <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.55, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <h2 style={{ fontFamily: SERIF, fontSize: 21, color: P.ink, margin: '30px 0 12px' }}>
        When something is not right
      </h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {FAQ.map((item) => (
          <Question key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Callout title="Still stuck?" icon={<CheckCircle2 size={16} />}>
          Send us the booking reference and the email the traveller used. Those two together are
          almost always enough for us to tell you what happened in a couple of minutes.
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
          style={{ color: P.ink3, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
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
