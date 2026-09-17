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
 * MOSTLY NO NAVIGATION. The nav bar is on every page, so the steps that explain
 * a section can spotlight the real menu item from wherever the tour already is.
 * Only two steps move: branding and sending access, which are the two things an
 * agency has to actually DO, and pointing at the real form beats describing it.
 */

import { useCallback, useEffect, useState } from 'react';
import { CoachTour, TourLauncher, tourInProgress, tourSeen } from '@/components/coach-tour';
import { STEPS } from './tour-steps';

const TOUR_ID = 'agency';

export function AgencyTour() {
  const [running, setRunning] = useState(false);

  // In an effect, not during render: both checks read browser storage, which
  // does not exist on the server.
  useEffect(() => {
    // A step navigated here and the tour is mid-flight — pick it straight back
    // up. Without this a replay would die at the first page change, because the
    // navigation unmounts everything and only a first run auto-starts.
    if (tourInProgress(TOUR_ID)) {
      setRunning(true);
      return;
    }
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
