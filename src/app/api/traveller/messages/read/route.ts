/**
 * POST /api/traveller/messages/read
 *
 * Marks agent-to-traveller messages read for the signed-in traveller, without
 * loading the full Notifications screen. Body { id } marks that one message
 * read; an empty body marks all unread read. Lets the home-screen banner and a
 * "Mark as read" control clear the unread state in place.
 *
 * Reads the lt_session cookie to identify the traveller; no traveller or agency
 * id is trusted from the client. Read state lives on luna_travel.message_recipients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }
  const travellerId = claims.travellerId;

  // Optional { id }. If absent we mark everything unread as read.
  let id: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.id === 'string' && body.id.trim()) {
      id = body.id.trim();
    }
  } catch {
    /* no body = mark all */
  }

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('traveller_id', travellerId)
    .is('read_at', null);
  if (id) {
    query = query.eq('message_id', id);
  }

  const { error } = await query;
  if (error) {
    console.error('[traveller.messages.read] update', error.message);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
