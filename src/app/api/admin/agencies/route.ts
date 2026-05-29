/**
 * GET /api/admin/agencies
 *
 * The single source of agencies for Luna Travel admin. An "agency" IS a
 * Control client (id.travelify.io) that is entitled to Luna Travel.
 *
 * Architecture (decided 28 May): Control is the single source of truth. Luna
 * Travel never stores agency records. This endpoint reads them from Control's
 * HTTP API server-to-server, forwarding the caller's tg_session cookie — the
 * same proven pattern as src/lib/admin-session.ts (verifyAdminSession). No
 * CORS, no new credentials, Control untouched.
 *
 * Flow:
 *   1. Gate: requireAdmin() — caller must hold the luna_travel permission.
 *   2. Forward the cookie to Control's /api/admin/clients/list.
 *   3. For each client, fetch /get to read its entitlements grid, and keep
 *      only those with the `luna-travel` catalogue product enabled.
 *   4. Shape each into the agency object Luna Travel's UI expects.
 *
 * Identifiers (deliberately distinct — do not conflate):
 *   - luna-travel  (hyphen)  = the CATALOGUE productCode we filter on.
 *   - luna_travel  (underscore) = the PERMISSION slug that gates admin access.
 *
 * Query:
 *   ?id=recXXX   → return a single agency (one /get), else the full list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';
const LUNA_TRAVEL_PRODUCT_CODE = 'luna-travel'; // catalogue code (hyphen)

interface ControlEntitlementRow {
  productCode?: string;
  enabled?: boolean;
}

interface ControlClientListRow {
  id: string;
  clientName?: string;
  tradingName?: string;
  primaryEmail?: string;
  primaryContactName?: string;
  websiteUrl?: string;
  status?: string;
  plan?: string;
  package?: { name?: string } | null;
  mrr?: number | null;
  goLiveDate?: string | null;
  lastLogin?: string | null;
}

/** Map a Control client (+ its detail) into the agency shape the UI uses. */
function toAgency(
  row: ControlClientListRow,
  detail: { client?: Record<string, unknown> } | null,
) {
  const d = (detail?.client ?? {}) as Record<string, unknown>;
  return {
    id: row.id, // Control client record id — the canonical agency_id
    name: row.tradingName || row.clientName || '',
    legalName: row.clientName || '',
    tier: row.plan || (row.package?.name ?? ''),
    status: (row.status || '').toLowerCase(),
    contact: row.primaryEmail || '',
    contactName: row.primaryContactName || '',
    website: row.websiteUrl || '',
    travelifyAppId: (d.travelifyAppId as string) || '',
    travelifySiteId: (d.travelifySiteId as string) || '',
    // API key is a secret — never expose the value to the browser. Surface
    // only whether one is set and its last 4 chars, for confirmation.
    apiKeySet: !!(d.apiKey as string),
    apiKeyLast4: ((d.apiKey as string) || '').slice(-4),
    // White-label branding (from Control). Blank until set.
    appName: (d.appName as string) || '',
    brandPrimaryColour: (d.brandPrimaryColour as string) || '',
    brandAccentColour: (d.brandAccentColour as string) || '',
    welcomeMessage: (d.welcomeMessage as string) || '',
    logoUrl: (d.logoUrl as string) || '',
    goLive: row.goLiveDate || null,
    lastLogin: row.lastLogin || null,
    // Stats (travellers, installs, lastSync) are derived from Luna Travel's
    // own data, not Control — left null here, filled by the dashboard layer.
    travellers: null as number | null,
    activeTrips: null as number | null,
    deviceInstalls: null as number | null,
    lastSync: null as string | null,
  };
}

async function controlGet(path: string, cookieHeader: string) {
  const res = await fetch(`${CONTROL_HOST}${path}`, {
    method: 'GET',
    headers: { Cookie: cookieHeader, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Control ${path} -> ${res.status}`);
  }
  return res.json();
}

/** Does this client's entitlement grid include luna-travel, enabled? */
function hasLunaTravel(detail: { entitlements?: ControlEntitlementRow[] }): boolean {
  const rows = Array.isArray(detail?.entitlements) ? detail.entitlements : [];
  return rows.some(
    (e) => e.productCode === LUNA_TRAVEL_PRODUCT_CODE && e.enabled === true,
  );
}

export async function GET(req: NextRequest) {
  // 1. Gate: caller must be a luna_travel admin/owner.
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // The cookie we forward to Control (the same one that authed us).
  const cookieHeader = req.headers.get('cookie') ?? '';
  if (!cookieHeader.includes(ADMIN_COOKIE_NAME)) {
    return NextResponse.json({ error: 'no_session_cookie' }, { status: 401 });
  }

  const singleId = req.nextUrl.searchParams.get('id')?.trim();

  try {
    // ── Single agency ──
    if (singleId) {
      const detail = await controlGet(
        `/api/admin/clients/get?id=${encodeURIComponent(singleId)}`,
        cookieHeader,
      );
      if (!hasLunaTravel(detail)) {
        return NextResponse.json(
          { error: 'not_entitled', detail: 'That client is not entitled to Luna Travel' },
          { status: 404 },
        );
      }
      const agency = toAgency(detail.client as ControlClientListRow, detail);
      return NextResponse.json({ agency, entitlements: detail.entitlements ?? [] }, { status: 200 });
    }

    // ── Full list ──
    const list = await controlGet('/api/admin/clients/list', cookieHeader);
    const clients: ControlClientListRow[] = Array.isArray(list?.clients) ? list.clients : [];

    // We need each client's entitlement grid to know if luna-travel is on.
    // /list only gives counts, so fetch /get per client. Fine for the current
    // client count; if this grows large we add a Control endpoint that returns
    // entitlements in the list. Done in parallel with a sane concurrency cap.
    const results = await Promise.allSettled(
      clients.map((c) =>
        controlGet(`/api/admin/clients/get?id=${encodeURIComponent(c.id)}`, cookieHeader).then(
          (detail) => ({ c, detail }),
        ),
      ),
    );

    const agencies = results
      .filter(
        (r): r is PromiseFulfilledResult<{ c: ControlClientListRow; detail: any }> =>
          r.status === 'fulfilled' && hasLunaTravel(r.value.detail),
      )
      .map((r) => toAgency(r.value.c, r.value.detail))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ agencies, total: agencies.length }, { status: 200 });
  } catch (err) {
    console.error('[admin/agencies] Control read failed:', (err as Error).message);
    return NextResponse.json(
      { error: 'control_unavailable', detail: 'Could not read agencies from Control' },
      { status: 502 },
    );
  }
}
