'use client';

/**
 * The agency walkthrough.
 *
 * Luna Travel shipped without one. Every other product in the suite opens with
 * a guided tour, so an agency arriving here from Control got a portal with
 * eleven menu items and no indication of which one to press first — or what the
 * product is for.
 *
 * It runs once, automatically, on a first visit, and is replayable for ever
 * after from the button in the corner. Anything that talks at somebody on their
 * first morning and then vanishes is a leaflet, not help.
 *
 * IT NEVER MOVES THE AGENT. An earlier version navigated for the two steps
 * where pointing at the real form seemed worth it; each move remounted the
 * portal shell, so pressing Next flashed the whole page and read as the tour
 * reloading the site. The menu is on every page, so every step now points at
 * something already on screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { CoachTour, TourLauncher, tourSeen } from '@/components/coach-tour';
import { STEPS } from './tour-steps';

const TOUR_ID = 'agency';

export function AgencyTour() {
  const [running, setRunning] = useState(false);

  // In an effect, not during render: it reads localStorage, which does not
  // exist on the server.
  useEffect(() => {
    if (tourSeen(TOUR_ID)) return;
    // A beat, so the portal has drawn and the tour opens onto a real page
    // rather than a loading spinner.
    const t = window.setTimeout(() => setRunning(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  const finish = useCallback(() => setRunning(false), []);

  return (
    <>
      <CoachTour id={TOUR_ID} steps={STEPS} running={running} onFinish={finish} />
      {!running && <TourLauncher label="Show me how" onClick={() => setRunning(true)} />}
    </>
  );
}
