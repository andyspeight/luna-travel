'use client';

/**
 * The traveller app, shaped like a phone on a desktop screen.
 *
 * The app has no desktop layout, and at 1440px it does not read as
 * unpolished — it reads as broken. The countdown digits spread across the full
 * width, the tab bar stretches edge to edge and the greeting is a thin line in
 * a corner. That is what a prospect saw on a laptop, and what a real traveller
 * sees opening their trip at work.
 *
 * So on a wide screen it is served in a phone-shaped column instead. Nothing
 * about the app changes; it is simply given the viewport it was designed for.
 *
 * HOW THE FIXED ELEMENTS ARE CAUGHT. A plain max-width wrapper would not be
 * enough: the tab bar, every bottom sheet, the map, the booking picker and the
 * cover splash are all `position: fixed`, so they would ignore the column and
 * span the whole window — worse than the stretching it set out to fix.
 *
 * A transform on an ancestor makes that ancestor the containing block for
 * fixed descendants. So the canvas carries one, and every fixed element in the
 * app lands inside the phone without a single component knowing about it.
 *
 * That in turn is why the canvas owns the scrolling (`height` + `overflow-y`)
 * rather than the page. Once fixed resolves against the canvas, a canvas taller
 * than the window would let the tab bar scroll away with the content. Making
 * the canvas exactly one viewport tall and scrolling inside it is the same
 * arrangement a phone has, which is the point.
 *
 * Off on the portal and the demo page, which are real desktop layouts, and off
 * on narrow screens, where the phone is the window already.
 */

import { usePathname } from 'next/navigation';

/** Routes with a desktop layout of their own — never framed. */
const FULL_WIDTH_PREFIXES = ['/agency', '/admin', '/demo'];

export function PhoneCanvas({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const fullWidth = FULL_WIDTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (fullWidth) return <>{children}</>;

  return (
    <div className="lt-canvas-backdrop">
      <div className="lt-canvas">{children}</div>
    </div>
  );
}
