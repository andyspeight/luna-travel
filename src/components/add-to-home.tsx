'use client';

/**
 * Add to home screen — platform aware, shared between the /install reveal and
 * the Me page (so a traveller can install the app any time, not only during
 * the one-shot invite reveal).
 *
 * beforeinstallprompt fires ONCE, early in the page lifecycle — long before
 * most UI mounts. So we capture it at MODULE scope and hold it; any component
 * using useInstallState() re-renders when it arrives or is spent.
 *
 *   - Chromium (Android, desktop Chrome/Edge): real one-tap install prompt.
 *   - iOS Safari (no beforeinstallprompt): a sheet showing the real Share
 *     glyph + the two steps, because iOS only allows a manual add.
 *   - Other browsers (desktop Safari, Firefox): a generic browser-menu
 *     instruction sheet — better than hiding the button entirely, which left
 *     travellers with no way to add the app at all.
 *   - Already installed (standalone): render nothing.
 */

import { useEffect, useState } from 'react';

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

export function useInstallState() {
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
export function ShareGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

/** Shared bottom-sheet chrome for the manual-install instructions. */
function InstallSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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

        {children}

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

export function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <InstallSheet onClose={onClose}>
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
    </InstallSheet>
  );
}

/** Generic instructions for browsers with no install prompt (Android browsers
 *  where the event didn't fire, desktop Safari, Firefox…). */
export function MenuInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <InstallSheet onClose={onClose}>
      <ol className="space-y-3">
        <li className="flex items-center gap-3">
          <span className="flex-none w-9 h-9 rounded-xl bg-navy/5 flex items-center justify-center text-teal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="text-[14px] text-navy/85">
            Open your browser&rsquo;s <span className="font-semibold text-navy">menu</span>
            <span className="block text-[12px] text-navy/50">Usually ⋮ or ⋯ in the corner</span>
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
            Choose <span className="font-semibold text-navy">Add to Home screen</span>{' '}
            <span className="text-navy/60">(or “Install app”)</span>
          </span>
        </li>
      </ol>
    </InstallSheet>
  );
}

/**
 * Me-page row: "Add to home screen". Renders nothing when already installed.
 * One-tap native prompt where available; otherwise the right instruction sheet.
 * Styled to match the other Me settings rows.
 */
export function AddToHomeRow() {
  const { canPrompt, isStandalone, isIOS, promptInstall } = useInstallState();
  const [sheet, setSheet] = useState<'ios' | 'menu' | null>(null);

  if (isStandalone) return null; // already on the home screen — say nothing

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canPrompt) void promptInstall();
          else setSheet(isIOS ? 'ios' : 'menu');
        }}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal/10 text-teal-dark dark:text-teal-light">
          <ShareGlyph size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink">Add to home screen</div>
          <div className="text-xs text-ink-2 mt-0.5">Open your trip like an app, one tap away</div>
        </div>
      </button>
      {sheet === 'ios' && <IOSInstallSheet onClose={() => setSheet(null)} />}
      {sheet === 'menu' && <MenuInstallSheet onClose={() => setSheet(null)} />}
    </>
  );
}
