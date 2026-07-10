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
import {
  getBrandingOverride,
  getBrandingOverrides,
  mergeBranding,
  type BrandingFields,
} from '@/lib/agency-branding';
import { isLunaAgency } from '@/lib/agency-id';
import {
  createLunaAgency,
  getLunaAgency,
  listLunaAgencies,
  lunaRowToAgency,
} from '@/lib/agencies';

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
    source: 'control' as const,
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

/**
 * Overlay Luna's branding override onto a Control-shaped agency so the admin UI
 * (and anything reading this endpoint) sees the effective brand: Luna override
 * wins per-field, else the Control value. `brandingOverridden` tells the
 * White-label tab whether a "Reset to Control" is available.
 */
function withEffectiveBranding<
  T extends {
    appName: string;
    logoUrl: string;
    brandPrimaryColour: string;
    brandAccentColour: string;
    welcomeMessage: string;
  },
>(agency: T, override: BrandingFields) {
  const base: BrandingFields = {
    appName: agency.appName || undefined,
    logoUrl: agency.logoUrl || undefined,
    brandPrimaryColour: agency.brandPrimaryColour || undefined,
    brandAccentColour: agency.brandAccentColour || undefined,
    welcomeMessage: agency.welcomeMessage || undefined,
  };
  const eff = mergeBranding(base, override);
  return {
    ...agency,
    appName: eff.appName || '',
    logoUrl: eff.logoUrl || '',
    brandPrimaryColour: eff.brandPrimaryColour || '',
    brandAccentColour: eff.brandAccentColour || '',
    welcomeMessage: eff.welcomeMessage || '',
    brandingOverridden: Object.values(override).some((v) => v !== undefined),
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

  // ── Single agency ──
  if (singleId) {
    // Luna-native agency (lt…) — resolve from Luna's own store, not Control.
    if (isLunaAgency(singleId)) {
      const row = await getLunaAgency(singleId);
      if (!row) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      const override = await getBrandingOverride(singleId);
      return NextResponse.json(
        { agency: withEffectiveBranding(lunaRowToAgency(row), override), entitlements: [] },
        { status: 200 },
      );
    }
    // Control client (rec…).
    try {
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
      const override = await getBrandingOverride(singleId);
      return NextResponse.json(
        { agency: withEffectiveBranding(agency, override), entitlements: detail.entitlements ?? [] },
        { status: 200 },
      );
    } catch (err) {
      console.error('[admin/agencies] Control detail failed:', (err as Error).message);
      return NextResponse.json(
        { error: 'control_unavailable', detail: 'Could not read the agency from Control' },
        { status: 502 },
      );
    }
  }

  // ── Full list ── Control-entitled clients + Luna-native agencies. Luna-native
  // agencies are always listed, even if Control is unreachable (controlError).
  const lunaAgencies = (await listLunaAgencies()).map(lunaRowToAgency);

  let controlAgencies: ReturnType<typeof toAgency>[] = [];
  let controlError = false;
  try {
    const list = await controlGet('/api/admin/clients/list', cookieHeader);
    const clients: ControlClientListRow[] = Array.isArray(list?.clients) ? list.clients : [];
    // /list only gives counts, so fetch /get per client to read the entitlement grid.
    const results = await Promise.allSettled(
      clients.map((c) =>
        controlGet(`/api/admin/clients/get?id=${encodeURIComponent(c.id)}`, cookieHeader).then(
          (detail) => ({ c, detail }),
        ),
      ),
    );
    controlAgencies = results
      .filter(
        (r): r is PromiseFulfilledResult<{ c: ControlClientListRow; detail: any }> =>
          r.status === 'fulfilled' && hasLunaTravel(r.value.detail),
      )
      .map((r) => toAgency(r.value.c, r.value.detail));
  } catch (err) {
    console.error('[admin/agencies] Control list failed:', (err as Error).message);
    controlError = true;
  }

  const allAgencies = [...controlAgencies, ...lunaAgencies];
  const overrides = await getBrandingOverrides(allAgencies.map((a) => a.id));
  const withBranding = allAgencies
    .map((a) => withEffectiveBranding(a, overrides.get(a.id) || {}))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { agencies: withBranding, total: withBranding.length, controlError },
    { status: 200 },
  );
}

// ── Create a Luna-native agency (non-Travelgenix client) ──
export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(body.name);
  if (!name) {
    return NextResponse.json({ error: 'name_required', message: 'Agency name is required' }, { status: 400 });
  }
  const contactEmail = str(body.contactEmail).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'email_invalid', message: 'Contact email is not a valid address' }, { status: 400 });
  }

  try {
    const row = await createLunaAgency({
      name,
      tradingName: str(body.tradingName) || undefined,
      contactEmail: contactEmail || undefined,
      contactName: str(body.contactName) || undefined,
      phone: str(body.phone) || undefined,
      website: str(body.website) || undefined,
      createdBy: claims.email,
    });
    return NextResponse.json({ agency: lunaRowToAgency(row) }, { status: 201 });
  } catch (err) {
    console.error('[admin/agencies POST] create failed:', (err as Error).message);
    return NextResponse.json({ error: 'create_failed', message: 'Could not create the agency' }, { status: 500 });
  }
}
