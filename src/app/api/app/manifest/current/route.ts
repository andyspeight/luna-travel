/**
 * GET /api/app/manifest/current — the web app manifest for whoever is asking.
 *
 * The page links this from its very first byte (app/layout), so the manifest a
 * phone reads is right before any JavaScript has run. That matters because
 * Android checks an installed app's manifest when it is opened, and if it
 * found "Your trip" there before the page had pointed it at the agency's, it
 * could rename an installed agency app back, or never pick up a new icon.
 *
 * A traveller signed in to a trip gets their agency's app, as saved against
 * them the last time their booking loaded (travellers.app_identity). Anybody
 * else, and anything that cannot be read, gets the neutral default. Never an
 * error: a phone that cannot read a manifest cannot install the app at all.
 *
 * Per person, so never cached anywhere shared. The link is marked
 * crossorigin="use-credentials", because a browser otherwise fetches a
 * manifest without cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/jwt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildManifest, parseIdentity, DEFAULT_SPEC, DEFAULT_APP_NAME, type AppIdentity } from '@/lib/app-icon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function identityFor(req: NextRequest): Promise<AppIdentity | null> {
  const token = req.cookies.get('lt_session')?.value;
  if (!token) return null;
  try {
    const claims = await verifySession(token);
    if (!claims?.travellerId) return null;
    const { data } = await getSupabaseAdmin()
      .from('travellers')
      .select('app_identity')
      .eq('id', claims.travellerId)
      .maybeSingle();
    return parseIdentity((data as { app_identity?: unknown } | null)?.app_identity);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const identity = await identityFor(req);
  const manifest = identity
    ? buildManifest(identity.spec, identity.name)
    : buildManifest(DEFAULT_SPEC, DEFAULT_APP_NAME);
  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-cache',
      Vary: 'Cookie',
    },
  });
}
