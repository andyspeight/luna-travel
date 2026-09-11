'use client';

/**
 * Turning notifications on.
 *
 * This is written to be persuasive rather than neutral, on purpose. A traveller
 * who declines cannot be asked again by the page — the browser remembers the
 * refusal — so the one ask has to carry its own justification. The copy leads
 * with what they actually lose (check-in opening, a gate or time change, their
 * agent replying) rather than the word "notifications", because nobody has ever
 * wanted a notification for its own sake.
 *
 * Two states beyond the obvious:
 *   - iOS in a browser tab: push is impossible until the app is on the home
 *     screen, so we say that instead of offering a button that cannot work.
 *   - Already declined: the page cannot re-prompt, so we explain where the
 *     switch lives rather than pretending a button will help.
 */

import { usePush } from '@/lib/use-push';
import { ShareGlyph } from '@/components/add-to-home';
import { IconBell, IconCheck, IconPlane, IconChat, IconClock } from '@/components/icons';

function Reason({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-none w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center mt-0.5">
        {icon}
      </span>
      <span className="text-[13px] leading-snug text-white/85">{text}</span>
    </li>
  );
}

/**
 * Full-width card. `tone="onDark"` for the invite reveal (photo background),
 * `tone="card"` for the app's own surfaces.
 */
export function NotificationsOptIn({ tone = 'card' }: { tone?: 'card' | 'onDark' }) {
  const { permission, subscribed, needsInstallFirst, busy, enable } = usePush();

  if (subscribed && permission === 'granted') {
    return (
      <div className={`flex items-center gap-2 text-[13px] ${tone === 'onDark' ? 'text-white/75' : 'text-ink-2'}`}>
        <IconCheck size={15} />
        Trip alerts are on — we&rsquo;ll tell you the moment anything changes.
      </div>
    );
  }

  const shell =
    tone === 'onDark'
      ? 'rounded-2xl bg-black/30 backdrop-blur border border-white/15 p-5 text-white'
      : 'rounded-2xl bg-gradient-to-br from-navy to-teal-dark p-5 text-white';

  // Already declined: the page cannot prompt again, so don't pretend.
  if (permission === 'denied') {
    return (
      <div className={shell}>
        <div className="flex items-center gap-2 mb-2">
          <IconBell size={18} />
          <h3 className="text-[15px] font-bold">Trip alerts are switched off</h3>
        </div>
        <p className="text-[13px] text-white/80 leading-relaxed">
          You won&rsquo;t get check-in reminders, flight changes or messages from your travel
          agent. To turn them back on, open this site&rsquo;s settings in your browser (tap the
          padlock in the address bar, or Settings → Notifications) and allow notifications.
        </p>
      </div>
    );
  }

  // iOS in a tab: push genuinely cannot work until the app is installed.
  if (needsInstallFirst) {
    return (
      <div className={shell}>
        <div className="flex items-center gap-2 mb-2">
          <IconBell size={18} />
          <h3 className="text-[15px] font-bold">Add the app first, then alerts</h3>
        </div>
        <p className="text-[13px] text-white/80 leading-relaxed mb-3">
          On iPhone and iPad, trip alerts only work once the app is on your home screen. Add it
          using the <span className="inline-flex items-center gap-1 font-semibold text-white"><ShareGlyph size={13} />Share</span> button,
          then come back here to switch them on.
        </p>
        <p className="text-[12.5px] text-white/65 leading-relaxed">
          Without them you won&rsquo;t hear about a gate change or a delay until you next open
          the app.
        </p>
      </div>
    );
  }

  if (permission === 'unsupported') return null;

  return (
    <div className={shell}>
      <div className="flex items-center gap-2 mb-1.5">
        <IconBell size={18} />
        <h3 className="text-[16px] font-bold">Please turn on trip alerts</h3>
      </div>
      <p className="text-[13px] text-white/80 leading-relaxed mb-3.5">
        This is the important one. It&rsquo;s how we reach you when something about your trip
        changes — and some of it is time-critical.
      </p>

      <ul className="space-y-2.5 mb-4">
        <Reason icon={<IconClock size={13} />} text="Check-in opening, so you get the seats you want" />
        <Reason icon={<IconPlane size={13} />} text="Gate, terminal and time changes, and delays" />
        <Reason icon={<IconChat size={13} />} text="Messages from your travel agent while you're away" />
      </ul>

      <button
        type="button"
        onClick={() => void enable()}
        disabled={busy}
        className="w-full h-13 py-3.5 rounded-2xl bg-white text-navy text-[16px] font-bold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {busy ? 'Just a moment…' : 'Turn on trip alerts'}
      </button>
      <p className="mt-2.5 text-[12px] text-white/65 text-center leading-relaxed">
        Your phone will ask you to confirm. If you say no, we can&rsquo;t ask again — you&rsquo;d
        have to switch them on in your browser settings.
      </p>
    </div>
  );
}
