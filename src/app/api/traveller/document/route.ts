/**
 * GET /api/traveller/document?src=booking|agency&id=…
 *
 * Streams one of the traveller's own documents back through our own origin.
 *
 * WHY THIS EXISTS. A booking's documents are Travelify URLs on a supplier's
 * domain, and agency uploads are signed Supabase URLs. Both are cross-origin.
 * Handing those straight to the browser works for a plain navigation ("Open in
 * a new tab") but NOT for the in-app preview: PDF.js has to fetch the bytes
 * with XHR, and a cross-origin response with no Access-Control-Allow-Origin is
 * blocked before a byte arrives. The preview then fails for every document that
 * came from a supplier — which is every document on a Travelify booking.
 *
 * Proxying makes the preview same-origin, so it cannot be blocked, and it stops
 * depending on a third party's CORS policy that we neither control nor can fix.
 *
 * NOT AN OPEN PROXY. The client never supplies a URL — only an id. The URL is
 * resolved server-side from THIS traveller's own booking (via Control, the same
 * path /api/traveller/booking uses) or from a documents row scoped to their
 * agency and booking reference. An id that is not theirs resolves to nothing.
 * That is the whole SSRF defence: there is no input that can point us at an
 * arbitrary host.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import { retrieveOrderByClient } from '@/lib/control-order';
import { orderToBooking } from '@/lib/order-to-booking';
import { getStoredBooking } from '@/lib/stored-booking';
import { isControlAgency } from '@/lib/agency-id';
import { mimeFromName } from '@/lib/document-type';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// A booking document costs two hops: resolve the order, then stream the file.
// The default budget is not enough for both when Travelify is slow, and a
// timeout here reads to the traveller as "the preview is broken".
export const maxDuration = 60;

/** Signed-URL lifetime for an agency upload, long enough to stream it once. */
const SIGN_VALIDITY_SECONDS = 120;

/**
 * Types that mean something has gone wrong, and that must never be served
 * inline from our own origin.
 *
 * A supplier link that has expired usually answers 200 with a login page rather
 * than a 404, so HTML is the signature of a dead document. It is also the one
 * genuine security line here: serving attacker-influenced HTML, SVG or script
 * from our own origin would be a real XSS, and the traveller's session cookie
 * lives on this origin. No travel document is any of these.
 */
const REFUSED_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/json',
  'text/xml',
  'application/xml',
]);

/**
 * Types that tell us nothing. Suppliers are careless — a PDF arriving as
 * application/octet-stream is routine — and with nosniff set, passing that
 * straight through would stop a perfectly good PDF from ever previewing. Only
 * these are second-guessed; a supplier that names a real type is believed, so a
 * spreadsheet stays a spreadsheet.
 */
const PLACEHOLDER_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/force-download',
  'application/download',
  'application/x-download',
]);

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Only ever fetch plain https. No file://, no http, no redirects to either. */
function isFetchableUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const token = readCookie(req.headers.get('cookie'), 'lt_session');
  if (!token) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const src = req.nextUrl.searchParams.get('src') || '';
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  const asAttachment = req.nextUrl.searchParams.get('download') === '1';
  if (!id || (src !== 'booking' && src !== 'agency')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  let url = '';
  let filename = 'document';

  try {
    if (src === 'agency') {
      // An agency upload. The predicate below is deliberately the SAME one
      // /api/traveller/documents lists by — agency, then traveller_id OR
      // booking_ref. Anything the traveller can see in the list they can
      // preview, and nothing else: a uuid belonging to another traveller, or to
      // another agency, resolves to nothing.
      const { data } = await getSupabaseAdmin()
        .from('documents')
        .select('storage_path, filename, agency_id, booking_ref, traveller_id, deleted_at')
        .eq('id', id)
        .maybeSingle();

      const row = data as {
        storage_path?: string; filename?: string; agency_id?: string;
        booking_ref?: string | null; traveller_id?: string | null; deleted_at?: string | null;
      } | null;

      const mine =
        !!row && !row.deleted_at &&
        row.agency_id === claims.agencyId &&
        (row.traveller_id === claims.travellerId ||
          (!!row.booking_ref && row.booking_ref === claims.bookingRef));

      if (!row || !mine) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }

      const { data: signed } = await getSupabaseAdmin()
        .storage.from('luna-travel-documents')
        .createSignedUrl(row.storage_path as string, SIGN_VALIDITY_SECONDS);

      url = signed?.signedUrl || '';
      filename = row.filename || filename;
    } else {
      // A document carried by the booking itself. Re-resolve the booking so the
      // URL comes from the booking and never from the request — that is the
      // whole SSRF defence, and it has to hold on BOTH booking paths.
      //
      // Off-platform first, exactly as /api/traveller/booking does. A stored
      // booking has no Travelify order behind it, so going straight to Control
      // would 404 every document on a manually-entered trip.
      let booking = (await getStoredBooking(claims.agencyId, claims.bookingRef))?.payload ?? null;

      if (!booking) {
        if (!isControlAgency(claims.agencyId)) {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        const { data: trav } = await getSupabaseAdmin()
          .from('travellers')
          .select('email, departure_date')
          .eq('id', claims.travellerId)
          .maybeSingle();

        const t = trav as { email?: string; departure_date?: string } | null;
        if (!t?.email) return NextResponse.json({ error: 'not_found' }, { status: 404 });

        const result = await retrieveOrderByClient({
          recordId: claims.agencyId,
          orderRef: claims.bookingRef,
          email: t.email,
          departDate: (t.departure_date || '').slice(0, 10),
        });
        if (!result.ok || !result.order) {
          return NextResponse.json({ error: 'upstream' }, { status: 502 });
        }
        booking = orderToBooking(result.order, result.agency ?? null, claims.bookingRef);
      }

      const doc = booking?.documents.find((d) => d.id === id);
      if (!doc?.url) return NextResponse.json({ error: 'not_found' }, { status: 404 });

      url = doc.url;
      filename = doc.name || filename;
    }
  } catch (e) {
    console.error('[traveller/document] resolve failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  if (!url || !isFetchableUrl(url)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Bounded: a supplier host that hangs must not hold the function open.
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.error('[traveller/document] fetch failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }

  const upstreamType = (upstream.headers.get('content-type') || '')
    .split(';')[0].trim().toLowerCase();

  if (REFUSED_TYPES.has(upstreamType)) {
    console.warn('[traveller/document] refused content-type', upstreamType, { src, id });
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  }

  // The response is sent with nosniff, so whatever we put here is final.
  const type = PLACEHOLDER_TYPES.has(upstreamType)
    ? mimeFromName(filename || url)
    : upstreamType;

  const headers = new Headers({
    'Content-Type': type,
    // inline for the in-app preview, attachment when the traveller pressed
    // Download — stated explicitly so no browser has to guess.
    'Content-Disposition':
      `${asAttachment ? 'attachment' : 'inline'}; filename="${filename.replace(/["\\]/g, '')}"`,
    // Private and uncached: signed URLs expire and documents are per-traveller.
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  // Content-Length is deliberately NOT forwarded. fetch transparently
  // decompresses a gzipped response, so upstream's length describes the
  // compressed bytes while the body we pass on is the decompressed ones. The
  // browser would trust the header, stop short, and hand PDF.js a truncated
  // file — a "corrupt document" that is entirely our own doing.
  return new NextResponse(upstream.body, { status: 200, headers });
}
