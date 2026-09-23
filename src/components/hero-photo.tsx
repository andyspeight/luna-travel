'use client';

/**
 * One destination photograph: the most specific one that exists, and never a
 * less specific one first.
 *
 * The hero used to stack up to three photos — the country, the location over
 * it, the place over that — each painted the moment it arrived. The country
 * shot is the smallest file, so it arrived first: a Rome booking opened on a
 * picture of somewhere else in Italy, and a moment later Rome was laid over it.
 * On every load, because it is simply how the stack paints (WCS96420, 23 Sep
 * 2026).
 *
 * Now every candidate is fetched at once, invisibly, and the most specific
 * one is shown only when it has loaded — or when everything more specific has
 * failed, which is how a place with no photo of its own still gets its
 * country. Until then the destination's own gradient shows, which is a colour,
 * not a wrong picture. The chosen photo fades in rather than snapping.
 */

import { useState } from 'react';

export type PhotoState = 'loading' | 'ok' | 'failed';

/**
 * The photo to show, given how each candidate is getting on. Candidates are
 * most specific first. A candidate still loading blocks everything after it:
 * showing the country while the city is on its way is exactly the flash this
 * exists to stop.
 */
export function pickPhoto(candidates: string[], states: Record<string, PhotoState>): string | null {
  for (const url of candidates) {
    const s = states[url] ?? 'loading';
    if (s === 'ok') return url;
    if (s === 'loading') return null;
  }
  return null;
}

/**
 * The photo layer. Sits inside a positioned container whose own background is
 * the destination gradient, so there is always something behind it.
 *
 * Every candidate is a real <img>, invisible until it is the one chosen, so the
 * picture that is shown is the very element that loaded it. A preloaded copy
 * handed on to a second element, or to a CSS background, can be fetched all
 * over again — which put a two-second gap between the photo arriving and the
 * photo appearing.
 */
export function HeroPhoto({ candidates }: { candidates: Array<string | undefined | null> }) {
  const list = candidates.filter((u): u is string => !!u);
  const [states, setStates] = useState<Record<string, PhotoState>>({});
  const mark = (url: string, state: PhotoState) =>
    setStates((s) => (s[url] === state ? s : { ...s, [url]: state }));
  const best = pickPhoto(list, states);

  return (
    <>
      {list.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          aria-hidden
          decoding="async"
          data-hero-photo={url === best ? url : undefined}
          // A photo already in the browser can finish before React is
          // listening, and then onLoad never comes. Ask the element instead.
          ref={(img) => {
            if (img?.complete) mark(url, img.naturalWidth > 0 ? 'ok' : 'failed');
          }}
          onLoad={() => mark(url, 'ok')}
          onError={() => mark(url, 'failed')}
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500"
          style={{ opacity: url === best ? 1 : 0 }}
        />
      ))}
    </>
  );
}
