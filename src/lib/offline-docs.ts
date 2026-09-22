/**
 * Keeping travel documents on the phone, and being honest about whether they
 * are there.
 *
 * The documents screen used to print "All saved on this device" whenever it
 * had any documents to list. Nothing checked, and nothing was stored: the
 * service worker cached fonts, images and JSON, and had no rule for a PDF or
 * for the proxy that serves one. A traveller landing with no signal would have
 * found an empty screen, having been told the opposite.
 *
 * Two halves to fixing that, and both are needed:
 *
 *   STORE THEM. The service worker now has a rule for the document proxy, but
 *   a rule only catches what is asked for, and a document nobody opened while
 *   they had signal was never asked for. So the app fetches them deliberately
 *   while it can, rather than hoping the traveller happened to tap each one.
 *
 *   TELL THE TRUTH. The badge now reflects what the cache actually holds,
 *   counted, per file. "Saved on this phone" is a promise somebody will rely on
 *   in a terminal, so it is only shown where it is true.
 *
 * The decisions here are pure and tested. The Cache API parts are not — they
 * need a browser — so they are kept thin and every one of them fails soft: a
 * device that cannot store documents still shows the list, still opens them
 * online, and simply never claims they are saved.
 */

/** Must match the cacheName in next.config.js, or the two halves miss. */
export const DOC_CACHE = 'traveller-documents';

export type SaveState = 'saved' | 'unsaved' | 'unsupported';

export interface OfflineSummary {
  /** The line under the heading. */
  text: string;
  /** Whether to show the reassuring badge at all. */
  badge: boolean;
  /** True when something is wrong the traveller can still act on. */
  warn: boolean;
}

/**
 * What to say about the documents as a whole.
 *
 * Pure, because this is the sentence a traveller trusts and it should be
 * decided somewhere it can be argued with in a test rather than in a template.
 *
 * The rules, in order of how much they matter:
 *   - never claim saved when nothing is saved
 *   - never claim ALL saved unless all of them are
 *   - if the device cannot store them, say nothing rather than imply failure
 */
export function summarise(input: {
  total: number;
  stored: number;
  supported: boolean;
  online: boolean;
}): OfflineSummary {
  const { total, stored, supported, online } = input;

  if (total === 0) {
    return { text: 'Nothing here yet', badge: false, warn: false };
  }

  if (!supported) {
    // An older browser, or a private window. The documents still open online,
    // so this is a limitation rather than a fault — and claiming they are
    // saved would be the only real failure available here.
    return {
      text: `${total} document${total === 1 ? '' : 's'}`,
      badge: false,
      warn: false,
    };
  }

  if (stored === 0) {
    return {
      text: online
        ? `${total} document${total === 1 ? '' : 's'} · saving for offline…`
        : `${total} document${total === 1 ? '' : 's'} · not saved for offline`,
      badge: false,
      warn: !online,
    };
  }

  if (stored < total) {
    return {
      text: `${stored} of ${total} saved on this phone`,
      badge: false,
      warn: true,
    };
  }

  return {
    text: `All ${total} saved on this phone`,
    badge: true,
    warn: false,
  };
}

/** Is the Cache API usable here at all? */
export function cacheSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'caches' in window;
  } catch {
    // Some privacy modes throw on access rather than returning false.
    return false;
  }
}

/** Which of these URLs the phone already holds. Never throws. */
export async function storedUrls(urls: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!cacheSupported() || urls.length === 0) return out;
  try {
    const cache = await caches.open(DOC_CACHE);
    await Promise.all(
      urls.map(async (u) => {
        try {
          // ignoreSearch stays OFF: the query string identifies the document.
          const hit = await cache.match(u);
          if (hit) out.add(u);
        } catch {
          /* this one is simply not counted as saved */
        }
      }),
    );
  } catch {
    /* no cache, nothing stored — the caller shows the honest version */
  }
  return out;
}

/**
 * Fetch anything missing into the cache.
 *
 * Sequential on purpose. These are multi-megabyte PDFs on what may be hotel
 * wifi the morning of a flight; firing eight at once is how you get eight
 * timeouts instead of six documents.
 *
 * Resolves with what is stored afterwards, so the caller can tell the truth
 * without a second round trip.
 */
export async function warmCache(urls: string[]): Promise<Set<string>> {
  if (!cacheSupported() || urls.length === 0) return new Set();

  const already = await storedUrls(urls);
  const missing = urls.filter((u) => !already.has(u));
  if (missing.length === 0) return already;

  try {
    const cache = await caches.open(DOC_CACHE);
    for (const url of missing) {
      try {
        // Same-origin and session-gated, so credentials must ride along.
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          await cache.put(url, res.clone());
          already.add(url);
        }
      } catch {
        // Offline, or this document is gone. Either way the count below stays
        // honest about it rather than the screen claiming otherwise.
      }
    }
  } catch {
    /* cache unavailable — fall through with whatever was already there */
  }

  return already;
}

/**
 * The URL a booking document is cached under, or null if it cannot be.
 *
 * Shared so the home screen and the documents screen cannot disagree about
 * what counts as saved — two different answers to "are my tickets on this
 * phone" is worse than either answer on its own.
 *
 * Mirrors the documents screen: a remote file goes through the proxy, and the
 * demo booking's own same-origin paths are already cacheable as they stand.
 * Anything else (a bare "#", an empty url) is not storable and is never
 * counted.
 */
export function cacheableDocUrl(doc: { id: string; url?: string | null }): string | null {
  const url = (doc.url || '').trim();
  if (/^https?:\/\//i.test(url)) {
    return `/api/traveller/document?src=booking&id=${encodeURIComponent(doc.id)}`;
  }
  return url.startsWith('/') ? url : null;
}
