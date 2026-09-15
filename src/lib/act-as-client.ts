'use client';

/**
 * "Acting as" — the browser half.
 *
 * The grant lives in sessionStorage, deliberately. sessionStorage is per tab:
 * open Luna in a second tab and you are yourself again, which is the scope the
 * platform spec asks for. A cookie would be shared across tabs and subdomains,
 * which is exactly the bleed this design exists to remove.
 *
 * The grant is minted by Control, not here. Luna only carries it.
 */

const CONTROL = 'https://id.travelify.io';
const KEY = 'luna-travel.act-as';
/** One-shot flag so the portal can say why the tab stopped acting. */
const NOTICE_KEY = 'luna-travel.act-as-ended';

export interface ActAsGrant {
  grant: string;
  agencyId: string;
  agencyName: string;
  /** Epoch ms. Mirrors the server's cap; the server re-checks regardless. */
  expiresAt: number;
}

export interface StaffClient {
  id: string;
  name: string;
}

/** Every storage read is wrapped: private mode and blocked site data both throw. */
function storedGrant(): ActAsGrant | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as ActAsGrant;
    if (!g?.grant || !g.agencyId) return null;
    return g;
  } catch {
    return null;
  }
}

/**
 * The grant, if this tab is acting and the grant still looks live. Used by the
 * UI to decide what to show.
 */
export function readGrant(): ActAsGrant | null {
  const g = storedGrant();
  if (!g) return null;
  if (typeof g.expiresAt === 'number' && Date.now() > g.expiresAt) return null;
  return g;
}

/**
 * The grant to put on a request — INCLUDING one that has locally expired.
 *
 * This looks wrong and is the most important line in the file. The previous
 * version deleted an expired grant and sent nothing, so the server saw an
 * ordinary request and answered as the staff member's own agency. A portal that
 * still looked like it was acting then wrote an invite for a client's booking
 * into Travelgenix, and the client was told to check their own details.
 *
 * Sending the stale grant makes the server refuse (see act-as.ts: a header that
 * does not resolve fails the request), which we recover from visibly below.
 * An error the staff member can see beats a write that silently lands in the
 * wrong agency. The clock here is only ever a hint; the server decides.
 */
function grantForRequest(): string | null {
  return storedGrant()?.grant ?? null;
}

export function clearGrant(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}

function writeGrant(g: ActAsGrant): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

/** Is the signed-in person Travelgenix staff? Controls whether the picker shows. */
export async function fetchStaffClients(): Promise<StaffClient[] | null> {
  try {
    const res = await fetch(`${CONTROL}/api/auth/staff-clients`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.clients)) return null;
    return (data.clients as StaffClient[]).filter((c) => c?.id && c?.name);
  } catch {
    return null;
  }
}

/**
 * Ask Control for a grant. Staff-only, enforced there — a non-staff caller gets
 * a 403 and we simply do not act.
 */
export async function startActingAs(client: StaffClient): Promise<ActAsGrant | null> {
  try {
    const res = await fetch(`${CONTROL}/api/auth/act-as/start`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || typeof data.grant !== 'string') return null;
    const g: ActAsGrant = {
      grant: data.grant,
      agencyId: client.id,
      agencyName: data.client?.clientName || client.name,
      expiresAt: Date.now() + (Number(data.ttlMs) || 30 * 60 * 1000),
    };
    return writeGrant(g) ? g : null;
  } catch {
    return null;
  }
}

/**
 * Recover from a grant the server would not accept.
 *
 * Clears it, leaves a note for the portal to explain itself, and reloads once
 * so every piece of UI re-reads its state from the server. After the reload the
 * banner is gone and the picker is back, which is the honest position: you are
 * yourself again and you can choose to start acting afresh.
 *
 * The guard matters — a page makes several agency calls at once, and each would
 * otherwise trigger its own reload.
 */
let recovering = false;
function grantRejected(): void {
  if (recovering) return;
  recovering = true;
  clearGrant();
  try {
    sessionStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* the reload still puts the UI right; only the explanation is lost */
  }
  window.location.reload();
}

/** Read and clear the "your acting session ended" note. */
export function takeActAsEndedNotice(): boolean {
  try {
    if (sessionStorage.getItem(NOTICE_KEY) !== '1') return false;
    sessionStorage.removeItem(NOTICE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Teach this tab's fetch to carry the grant on Luna's own agency calls.
 *
 * A wrapper rather than editing every call site: the portal makes these calls
 * from a dozen components, and one of them forgetting the header would mean a
 * page that silently showed your own data inside an acting session. Scoped to
 * same-origin /api/agency/* so the grant is never sent anywhere else.
 *
 * Idempotent, and returns a function that restores the original fetch.
 */
export function installActAsFetch(): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as Window & { __lunaActAsPatched?: boolean };
  if (w.__lunaActAsPatched) return () => {};
  w.__lunaActAsPatched = true;

  const original = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const grant = grantForRequest();
    if (!grant) return original(input, init);

    let path = '';
    try {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.toString()
        : input.url;
      path = new URL(url, window.location.origin).pathname;
    } catch {
      return original(input, init);
    }

    if (!path.startsWith('/api/agency/')) return original(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('X-TG-Act-As', grant);

    const res = await original(input, { ...init, headers });
    // We presented a grant and were refused. The tab is no longer acting,
    // whatever it currently looks like, so stop pretending immediately rather
    // than letting the next click write somewhere unintended.
    if (res.status === 401) grantRejected();
    return res;
  };

  return () => {
    window.fetch = original;
    w.__lunaActAsPatched = false;
  };
}
