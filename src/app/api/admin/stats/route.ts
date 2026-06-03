/**
 * GET /api/admin/stats
 *
 * Real engagement analytics for the admin Overview. Everything here is
 * computed from live Supabase data — there is no mock data and nothing is
 * invented. We only report signals we actually capture:
 *
 *   - travellers      (onboarded via invite redemption)
 *   - trips           (derived from traveller departure_date / return_date)
 *   - invites         (created / redeemed / pending / expired) → activation rate
 *   - documents       (active vs soft-deleted)
 *   - recent activity (from audit_events)
 *
 * We deliberately do NOT report "PWA installs", "app opens" or "30-day app
 * actives": there is no client open/ping telemetry yet, so any such number
 * would be fiction. When that telemetry lands, extend this route — don't fake it.
 *
 * Agency display names are fetched defensively: if a `luna_travel.agencies`
 * table exists we use it, otherwise we fall back to the agency_id and the
 * route still returns 200.
 *
 * Auth: gated by middleware (central Travelgenix ID session, luna_travel perm).
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAY = 24 * 60 * 60 * 1000;

/** Parse a date-only or ISO string to epoch ms; null/invalid → null. */
function ts(v: unknown): number | null {
  if (typeof v !== 'string' || !v) return null;
  const d = v.length === 10 ? new Date(v + 'T00:00:00Z') : new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

type InviteRow = { id: string; agency_id: string | null; status: string | null; created_at: string | null; redeemed_at: string | null; expires_at: string | null };
type TravellerRow = { id: string; agency_id: string | null; departure_date: string | null; return_date: string | null; created_at: string | null };
type DocRow = { id: string; agency_id: string | null; deleted_at: string | null; uploaded_at: string | null };
type AuditRow = { id: string; event_type: string; actor: string; target_label: string | null; metadata: Record<string, unknown> | null; created_at: string };
type AgencyMeta = { id: string; name: string | null; tier: string | null; status: string | null };

export async function GET() {
  const envErr = checkSupabaseEnv();
  if (envErr) {
    // Not an error state for the page — render a clear "not configured" view.
    return NextResponse.json({ configured: false, reason: envErr }, { status: 200 });
  }

  const supabase = getSupabaseAdmin();
  const warnings: string[] = [];
  const since30Iso = new Date(Date.now() - 30 * DAY).toISOString();

  // Fetch in parallel. Each guarded so one missing table can't 500 the route.
  const [invitesRes, travellersRes, docsRes, auditRes, agenciesRes, opensRes, installsRes] = await Promise.all([
    supabase.from('invites').select('id, agency_id, status, created_at, redeemed_at, expires_at').limit(5000),
    supabase.from('travellers').select('id, agency_id, departure_date, return_date, created_at').limit(5000),
    supabase.from('documents').select('id, agency_id, deleted_at, uploaded_at').limit(5000),
    supabase.from('audit_events').select('id, event_type, actor, target_label, metadata, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('agencies').select('id, name, tier, status').limit(2000),
    supabase.from('app_opens').select('traveller_id, agency_id, opened_at').gte('opened_at', since30Iso).limit(20000),
    supabase.from('app_opens').select('traveller_id, agency_id').eq('standalone', true).limit(20000),
  ]);

  if (invitesRes.error) warnings.push('invites: ' + invitesRes.error.message);
  if (travellersRes.error) warnings.push('travellers: ' + travellersRes.error.message);
  if (docsRes.error) warnings.push('documents: ' + docsRes.error.message);
  if (auditRes.error) warnings.push('audit: ' + auditRes.error.message);
  // agencies is optional — its absence is expected if the table isn't present.

  const invites = (invitesRes.data || []) as InviteRow[];
  const travellers = (travellersRes.data || []) as TravellerRow[];
  const docs = (docsRes.data || []) as DocRow[];
  const audit = (auditRes.data || []) as AuditRow[];
  const agencyMeta = (agenciesRes.data || []) as AgencyMeta[];

  // Engagement telemetry (app_opens). The table may not exist yet (migration
  // not run) — that's expected and not an error; we report these as null.
  const telemetryReady = !opensRes.error && !installsRes.error;
  const opens30 = (opensRes.data || []) as Array<{ traveller_id: string; agency_id: string | null; opened_at: string }>;
  const installRows = (installsRes.data || []) as Array<{ traveller_id: string; agency_id: string | null }>;

  const now = Date.now();
  const cut30 = now - 30 * DAY;
  const cut7 = now - 7 * DAY;

  // ── Invites / activation ──
  const inv = { total: invites.length, redeemed: 0, pending: 0, expired: 0 };
  for (const i of invites) {
    if (i.status === 'redeemed') inv.redeemed++;
    else {
      const exp = ts(i.expires_at);
      if (exp !== null && exp < now) inv.expired++;
      else inv.pending++;
    }
  }
  const activationRate = inv.total > 0 ? inv.redeemed / inv.total : null;

  // ── Travellers / trips ──
  let travellersNew30d = 0;
  const trips = { upcoming: 0, current: 0, completed: 0 };
  for (const t of travellers) {
    const created = ts(t.created_at);
    if (created !== null && created >= cut30) travellersNew30d++;

    const dep = ts(t.departure_date);
    const ret = ts(t.return_date);
    if (dep === null) continue;
    if (dep > now) trips.upcoming++;
    else if (ret !== null && ret >= now) trips.current++;
    else trips.completed++;
  }

  // ── Documents ──
  const documentsActive = docs.filter((d) => !d.deleted_at).length;

  // ── Per-agency rollup ──
  const metaById = new Map<string, AgencyMeta>();
  for (const a of agencyMeta) metaById.set(a.id, a);

  type Roll = { id: string; name: string | null; tier: string | null; status: string | null; travellers: number; upcoming: number; invitesTotal: number; redeemed: number; lastActivity: number | null };
  const byAgency = new Map<string, Roll>();
  const ensure = (id: string): Roll => {
    let r = byAgency.get(id);
    if (!r) {
      const m = metaById.get(id);
      r = { id, name: m?.name ?? null, tier: m?.tier ?? null, status: m?.status ?? null, travellers: 0, upcoming: 0, invitesTotal: 0, redeemed: 0, lastActivity: null };
      byAgency.set(id, r);
    }
    return r;
  };
  for (const t of travellers) {
    if (!t.agency_id) continue;
    const r = ensure(t.agency_id);
    r.travellers++;
    const dep = ts(t.departure_date);
    if (dep !== null && dep > now) r.upcoming++;
    const created = ts(t.created_at);
    if (created !== null && (r.lastActivity === null || created > r.lastActivity)) r.lastActivity = created;
  }
  for (const i of invites) {
    if (!i.agency_id) continue;
    const r = ensure(i.agency_id);
    r.invitesTotal++;
    if (i.status === 'redeemed') r.redeemed++;
    const c = ts(i.created_at);
    if (c !== null && (r.lastActivity === null || c > r.lastActivity)) r.lastActivity = c;
  }

  // Distinct active travellers per window, and per agency.
  const active30 = new Set<string>();
  const active7 = new Set<string>();
  const activeByAgency = new Map<string, Set<string>>();
  for (const o of opens30) {
    active30.add(o.traveller_id);
    const ot = ts(o.opened_at);
    if (ot !== null && ot >= cut7) active7.add(o.traveller_id);
    if (o.agency_id) {
      let set = activeByAgency.get(o.agency_id);
      if (!set) { set = new Set(); activeByAgency.set(o.agency_id, set); }
      set.add(o.traveller_id);
    }
  }
  // Distinct "installed" travellers (ever opened in standalone), and per agency.
  const installSet = new Set<string>();
  const installByAgency = new Map<string, Set<string>>();
  for (const r of installRows) {
    installSet.add(r.traveller_id);
    if (r.agency_id) {
      let set = installByAgency.get(r.agency_id);
      if (!set) { set = new Set(); installByAgency.set(r.agency_id, set); }
      set.add(r.traveller_id);
    }
  }

  const agencies = Array.from(byAgency.values())
    .map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier,
      status: r.status,
      travellers: r.travellers,
      upcoming: r.upcoming,
      invitesTotal: r.invitesTotal,
      redeemed: r.redeemed,
      activationRate: r.invitesTotal > 0 ? r.redeemed / r.invitesTotal : null,
      active30d: telemetryReady ? (activeByAgency.get(r.id)?.size ?? 0) : null,
      installs: telemetryReady ? (installByAgency.get(r.id)?.size ?? 0) : null,
      lastActivityAt: r.lastActivity ? new Date(r.lastActivity).toISOString() : null,
    }))
    .sort((a, b) => b.travellers - a.travellers || b.invitesTotal - a.invitesTotal);

  // ── Needs attention (real, derived) ──
  const attention: Array<{ agencyId: string; name: string | null; kind: string; detail: string }> = [];
  for (const a of agencies) {
    if (a.invitesTotal >= 3 && a.redeemed === 0) {
      attention.push({ agencyId: a.id, name: a.name, kind: 'no_activation', detail: `${a.invitesTotal} invites sent, none redeemed yet` });
    }
  }
  // Expired pending invites across the board
  if (inv.expired > 0) {
    attention.push({ agencyId: '', name: null, kind: 'expired', detail: `${inv.expired} invite${inv.expired === 1 ? '' : 's'} expired before being redeemed` });
  }

  // ── Recent activity (friendly, no PII) ──
  const FRIENDLY: Record<string, string> = {
    'invite.redeemed': 'New traveller onboarded',
    'invite.created': 'Invite created',
    'document.uploaded': 'Document uploaded',
    'document.deleted': 'Document removed',
    'admin.signin': 'Admin signed in',
    'admin.signout': 'Admin signed out',
    'admin.signin_failed': 'Failed sign-in attempt',
    'hero.uploaded': 'Hero image added',
    'hero.removed': 'Hero image removed',
  };
  const recent = audit.map((e) => {
    // target_label is "{agencyId} / {bookingRef}" for invite events — show the
    // agency name when we can resolve it, never the email (that's only in metadata).
    let context: string | null = null;
    if (e.target_label) {
      const agencyPart = e.target_label.split('/')[0].trim();
      const m = metaById.get(agencyPart);
      context = m?.name ?? e.target_label;
    } else if (e.actor && e.actor.includes('@')) {
      context = e.actor;
    }
    return {
      id: e.id,
      type: e.event_type,
      text: FRIENDLY[e.event_type] || e.event_type,
      context,
      at: e.created_at,
    };
  });

  return NextResponse.json(
    {
      configured: true,
      generatedAt: new Date().toISOString(),
      totals: {
        agencies: byAgency.size,
        travellers: travellers.length,
        travellersNew30d,
        trips,
        invites: inv,
        activationRate,
        documents: documentsActive,
        installs: telemetryReady ? installSet.size : null,
        installRate: telemetryReady && travellers.length > 0 ? installSet.size / travellers.length : null,
        active30d: telemetryReady ? active30.size : null,
        active7d: telemetryReady ? active7.size : null,
        telemetryReady,
      },
      agencies,
      attention,
      recent,
      warnings: warnings.length ? warnings : undefined,
    },
    { status: 200 },
  );
}
