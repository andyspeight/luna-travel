'use client';

/**
 * A coach-mark tour: point at the real control, one step at a time.
 *
 * Deliberately not a modal that talks at you. It dims the page, cuts a
 * spotlight hole over one real control, and anchors a short instruction beside
 * it. The control underneath stays fully usable, so the agent is looking at
 * their own portal the whole way through rather than at a video of someone
 * else's.
 *
 * This is the Luna Travel counterpart of the Widget Suite's editor tour
 * (tg-widgets/public/editor-tour.js). Same idea and the same feel; written for
 * React rather than ported, because that engine is built on the widget editor's
 * own shell — its tabs, its sections, its `window.tgse` global — none of which
 * exists here.
 *
 * IT NEVER NAVIGATES, and that is load-bearing. The first version moved the
 * agent to a page for the two steps where pointing at the real form seemed
 * worth it. Each move remounted the portal shell, which refetches and redraws —
 * so pressing Next flashed the whole page, and it read as the tour reloading
 * the site under you. The widgets editor never navigates either (it has tabs,
 * not pages), so this now matches it: every step points at something already on
 * screen, and the nav bar is on every page, so a step can spotlight the menu
 * item for a section from wherever the agent happens to be.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TourStep {
  /**
   * The `data-tour` value of the element to spotlight. Attributes rather than
   * CSS selectors on purpose: a class name is a styling decision somebody will
   * reasonably change one day, and the tour should not break when they do.
   *
   * Omit for a step with no anchor — the callout is then centred, which is how
   * the welcome and the sign-off are drawn.
   */
  target?: string;
  title: string;
  body: string;
  /** Which side of the target the callout sits on. Default: picked to fit. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

type Placement = NonNullable<TourStep['placement']>;

const GAP = 14; // between spotlight and callout
const PAD = 8; // spotlight padding around the target
const CALLOUT_W = 340;

function seenKey(id: string) {
  return `luna-travel.tour.${id}.seen`;
}

/** Storage is allowed to throw: private mode, blocked site data, embedded webviews. */
function read(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function write(store: Storage, key: string, value: string | null) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* the tour still works; it just will not be remembered */
  }
}

/** Has this person already been shown the tour? */
export function tourSeen(id: string): boolean {
  if (typeof window === 'undefined') return true; // never auto-start during SSR
  return read(window.localStorage, seenKey(id)) === '1';
}

export function markTourSeen(id: string) {
  if (typeof window === 'undefined') return;
  write(window.localStorage, seenKey(id), '1');
}

/**
 * Wait for an element to exist, because the step may have just navigated to the
 * page that contains it and that page fetches before it renders. Resolves null
 * on timeout so a step whose target never appears is skipped rather than
 * hanging the tour on an empty spotlight.
 */
function waitForTarget(name: string, timeoutMs = 4000): Promise<HTMLElement | null> {
  const find = () => document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  const found = find();
  if (found) return Promise.resolve(found);

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const el = find();
      if (el) return resolve(el);
      if (Date.now() - started > timeoutMs) return resolve(null);
      window.setTimeout(tick, 80);
    };
    window.setTimeout(tick, 80);
  });
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Anchored from the top, or from the bottom when the callout sits ABOVE the
 * target — its height is not known until it has rendered, so pinning its bottom
 * edge is the only way to place it without measuring twice.
 */
interface CalloutBox {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

/** Where the callout fits without falling off screen. */
function placeCallout(rect: Rect | null, preferred?: Placement): CalloutBox {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      top: Math.max(24, vh / 2 - 120),
      left: Math.max(16, vw / 2 - CALLOUT_W / 2),
      width: Math.min(CALLOUT_W, vw - 32),
    };
  }

  const below = vh - (rect.top + rect.height);
  const order: Placement[] = preferred
    ? [preferred, 'bottom', 'top', 'right', 'left']
    : below > 240
      ? ['bottom', 'top', 'right', 'left']
      : ['top', 'bottom', 'right', 'left'];

  const width = Math.min(CALLOUT_W, vw - 32);

  for (const side of order) {
    if (side === 'bottom' && below > 200) {
      return { top: rect.top + rect.height + GAP, left: clampX(rect.left, width, vw), width };
    }
    if (side === 'top' && rect.top > 200) {
      return { bottom: vh - rect.top + GAP, left: clampX(rect.left, width, vw), width };
    }
    if (side === 'right' && vw - (rect.left + rect.width) > width + GAP) {
      return { top: clampY(rect.top, vh), left: rect.left + rect.width + GAP, width };
    }
    if (side === 'left' && rect.left > width + GAP) {
      return { top: clampY(rect.top, vh), left: rect.left - width - GAP, width };
    }
  }

  // Nothing fits beside it — sit under it and let the page scroll.
  return { top: rect.top + rect.height + GAP, left: clampX(rect.left, width, vw), width };
}

/**
 * Comfortably on screen already — with a margin, so a control hard against the
 * top or bottom edge still gets scrolled somewhere readable.
 */
function isWellInView(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const margin = 48;
  return r.top >= margin && r.bottom <= window.innerHeight - margin;
}

/** Is the keystroke going into something the user is editing? */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

function clampX(left: number, width: number, vw: number) {
  return Math.max(16, Math.min(left, vw - width - 16));
}
function clampY(top: number, vh: number) {
  return Math.max(16, Math.min(top, vh - 220));
}

export function CoachTour({
  id,
  steps,
  running,
  onFinish,
}: {
  id: string;
  steps: TourStep[];
  running: boolean;
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const step = steps[index];
  const last = index >= steps.length - 1;

  const finish = useCallback(() => {
    markTourSeen(id);
    targetRef.current = null;
    setRect(null);
    setIndex(0);
    onFinish();
  }, [id, onFinish]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= steps.length) return finish();
      setIndex(next);
    },
    [steps.length, finish],
  );

  // Find and follow the current step's target.
  useEffect(() => {
    if (!running || !step) return;
    let cancelled = false;

    if (!step.target) {
      targetRef.current = null;
      setRect(null);
      return;
    }

    void waitForTarget(step.target).then((el) => {
      if (cancelled) return;
      targetRef.current = el;
      if (!el) {
        // Never happened in practice, but a tour that stalls on a missing
        // anchor would be worse than one that quietly carries on.
        setRect(null);
        return;
      }
      // Only scroll if it is genuinely off screen. Scrolling regardless threw
      // the page to the top on every nav step — the menu is sticky, so asking
      // to centre it can only be satisfied by scrolling the document up, and
      // the jump read as the page reloading.
      if (!isWellInView(el)) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Re-measure once the smooth scroll has settled, or the spotlight
        // lands where the element used to be.
        window.setTimeout(() => {
          if (!cancelled && targetRef.current) setRect(rectOf(targetRef.current));
        }, 320);
      }
      setRect(rectOf(el));
    });

    return () => {
      cancelled = true;
    };
  }, [running, step]);

  // Keep the spotlight on the target while the page moves under it.
  useEffect(() => {
    if (!running) return;
    const follow = () => {
      if (targetRef.current) setRect(rectOf(targetRef.current));
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [running]);

  // Escape leaves. Arrows move. A tour you cannot get out of is a trap.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish();
        return;
      }
      // The spotlit control stays usable — that is the entire point of a coach
      // mark — so somebody may well be typing in it. Stealing their arrow keys
      // to move the tour along would be maddening.
      if (isTyping(e.target)) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, index, goTo, finish]);

  const box = useMemo<CalloutBox | null>(() => {
    if (typeof window === 'undefined') return null;
    return placeCallout(rect, step?.placement);
  }, [rect, step?.placement]);

  if (!running || !step || !box) return null;

  return (
    <>
      {/* The scrim is the spotlight's own huge box-shadow, so the hole is
          always exactly the target and there is no second element to keep in
          step with it. pointer-events:none throughout: the control underneath
          stays clickable, which is the whole point of a coach mark. */}
      {rect && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 12,
            zIndex: 3000,
            pointerEvents: 'none',
            boxShadow: `0 0 0 9999px rgba(13,24,54,0.42)`,
            outline: `2.5px solid ${'#00b4d8'}`,
            outlineOffset: 3,
            transition: 'top .28s ease, left .28s ease, width .28s ease, height .28s ease',
          }}
        />
      )}

      {/* A step with no anchor still needs the page dimmed. */}
      {!rect && (
        <div
          aria-hidden
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(13,24,54,0.42)' }}
        />
      )}

      <div
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
        style={{
          position: 'fixed',
          zIndex: 3002,
          width: box.width,
          ...(box.bottom !== undefined ? { bottom: box.bottom } : { top: box.top }),
          left: box.left,
          background: '#fff',
          border: '1px solid #e7ecf4',
          borderRadius: 16,
          boxShadow: '0 22px 60px rgba(13,24,54,0.28)',
          padding: '16px 18px 14px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: '#94a3b8', textTransform: 'uppercase' }}>
          Step {index + 1} of {steps.length}
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 16.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
          {step.title}
        </h2>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>{step.body}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={finish}
            style={{
              border: 'none', background: 'transparent', color: '#94a3b8',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '8px 2px',
            }}
          >
            Skip
          </button>
          <div style={{ flex: 1 }} />
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              style={{
                border: '1px solid #e7ecf4', background: '#fff', color: '#475569',
                fontSize: 13, fontWeight: 600, padding: '8px 13px', borderRadius: 10, cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            style={{
              border: 'none', background: '#00b4d8', color: '#fff',
              fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
            }}
          >
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * The persistent way back in. Always there, so the walkthrough is something an
 * agent can choose to replay rather than a thing that happened to them once on
 * their first morning and never again.
 */
export function TourLauncher({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 2900,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 'none',
        background: '#1b2b5b',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        padding: '11px 16px',
        borderRadius: 999,
        boxShadow: '0 10px 26px rgba(13,24,54,0.28)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
