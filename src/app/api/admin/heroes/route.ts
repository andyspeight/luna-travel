/**
 * /api/admin/heroes
 *
 *   GET    — list every stored hero image (returns a map keyed by
 *            `${code}-${variant}` → public URL).
 *   POST   — multipart upload of a single already-converted WEBP:
 *            { file, code, variant } where variant ∈ { portrait, landscape }.
 *            The browser converts/resizes to webp BEFORE upload (canvas), so
 *            the server just validates and stores. No native deps server-side.
 *   DELETE — remove one hero: ?code=MV&variant=portrait
 *
 * Admin-gated automatically by src/middleware.ts (matches /api/admin/*).
 *
 * Storage: Supabase public bucket `destination-heroes`.
 * Object path: `{CODE}/{variant}.webp` e.g. `MV/portrait.webp`.
 * Public bucket → durable, cacheable, offline-friendly URLs the PWA reads
 * directly (no signing, unlike documents which are private).
 *
 * Security (travelgenix-security):
 *   - Rule 1/2: service-role key stays server-side via getSupabaseAdmin().
 *   - Rule 3: every input validated server-side — code against the roster,
 *     variant against a whitelist, mime must be image/webp, size capped.
 *   - Rule 7: deny on any validation failure; failures are logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { HERO_DESTINATION_BY_CODE } from '@/data/hero-destinations';
import { HERO_LOCATIONS_BY_COUNTRY, isKnownLocation } from '@/data/hero-locations';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'destination-heroes';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — generous for an optimised webp
const VARIANTS = new Set(['portrait', 'landscape']);

/** Validate an ISO-2 code against the known roster. */
function isValidCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(HERO_DESTINATION_BY_CODE, code);
}

/**
 * Storage object path. Country hero: {CODE}/{variant}.webp. Location hero
 * (city/region within the country): {CODE}/{slug}/{variant}.webp.
 */
function objectPath(code: string, variant: string, slug?: string): string {
  return slug ? `${code}/${slug}/${variant}.webp` : `${code}/${variant}.webp`;
}

/** Map key used by the client: country = `CODE-variant`, location = `CODE/slug-variant`. */
function slotKey(code: string, variant: string, slug?: string): string {
  return slug ? `${code}/${slug}-${variant}` : `${code}-${variant}`;
}

/** Public URL for an object in the public bucket. */
function publicUrl(code: string, variant: string, slug?: string): string {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath(code, variant, slug));
  return data.publicUrl;
}

// ─────────── GET — list all stored heroes ───────────

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const heroes: Record<string, { url: string; updatedAt: string | null }> = {};
  const single = (req.nextUrl.searchParams.get('code') || '').trim().toUpperCase();

  // Drill-down: one country's own heroes PLUS its location (city/region) heroes.
  if (single) {
    if (!isValidCode(single)) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });

    // The country's own two slots.
    const { data: files } = await supabase.storage.from(BUCKET).list(single, { limit: 100 });
    for (const f of files || []) {
      if (!f.name) continue;
      const variant = f.name.replace(/\.webp$/i, '');
      if (f.name.includes('.') && VARIANTS.has(variant)) {
        heroes[slotKey(single, variant)] = {
          url: publicUrl(single, variant),
          updatedAt: (f.updated_at as string) || (f.created_at as string) || null,
        };
      }
    }

    // Each known location's slots (one list per location that has any image).
    for (const loc of HERO_LOCATIONS_BY_COUNTRY[single] || []) {
      const { data: lfiles } = await supabase.storage.from(BUCKET).list(`${single}/${loc.slug}`, { limit: 10 });
      for (const f of lfiles || []) {
        const variant = f.name.replace(/\.webp$/i, '');
        if (!VARIANTS.has(variant)) continue;
        heroes[slotKey(single, variant, loc.slug)] = {
          url: publicUrl(single, variant, loc.slug),
          updatedAt: (f.updated_at as string) || (f.created_at as string) || null,
        };
      }
    }
    return NextResponse.json({ heroes });
  }

  // Default: every country's own heroes (country-level grid). Location heroes
  // are only loaded on demand when a country is drilled into (above).
  const { data: folders, error: folderErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (folderErr) {
    console.warn('[heroes.GET] list root failed (bucket may be new):', folderErr.message);
    return NextResponse.json({ heroes: {} });
  }

  for (const folder of folders || []) {
    if (!folder.name || folder.name.includes('.')) continue;
    const code = folder.name;
    if (!isValidCode(code)) continue;

    const { data: files } = await supabase.storage.from(BUCKET).list(code, { limit: 100 });
    for (const f of files || []) {
      const variant = f.name.replace(/\.webp$/i, '');
      // Only the country's own files (ending .webp); slug SUBFOLDERS are skipped
      // here and surfaced under the drill-down.
      if (f.name.includes('.') && VARIANTS.has(variant)) {
        heroes[`${code}-${variant}`] = {
          url: publicUrl(code, variant),
          updatedAt: (f.updated_at as string) || (f.created_at as string) || null,
        };
      }
    }
  }

  return NextResponse.json({ heroes });
}

// ─────────── POST — upload one converted webp ───────────

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  const code = String(form.get('code') || '').trim().toUpperCase();
  const variant = String(form.get('variant') || '').trim().toLowerCase();
  const slug = String(form.get('slug') || '').trim() || undefined;

  // Validate metadata
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code', message: 'Unknown destination code' }, { status: 400 });
  }
  if (!VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'invalid_variant', message: 'variant must be portrait or landscape' }, { status: 400 });
  }
  // A location hero must name a known city/region within this country.
  if (slug && !isKnownLocation(code, slug)) {
    return NextResponse.json({ error: 'invalid_location', message: 'Unknown location for this country' }, { status: 400 });
  }

  // Validate file
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'file_empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', message: 'Maximum 5 MB' }, { status: 400 });
  }
  const mime = file.type || '';
  if (mime !== 'image/webp') {
    // The browser is responsible for converting to webp before upload. If we
    // receive anything else, refuse rather than store an unconverted file.
    return NextResponse.json({ error: 'unsupported_type', message: 'Expected image/webp (browser conversion failed?)' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const path = objectPath(code, variant, slug);
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: 'image/webp',
      upsert: true,            // replacing an existing hero is the norm
      cacheControl: '3600',
    });

  if (uploadErr) {
    console.error('[heroes.POST] upload failed:', uploadErr.message);
    // Most likely cause: bucket missing. Surface a clear, actionable error.
    return NextResponse.json({
      error: 'upload_failed',
      message: uploadErr.message.includes('Bucket not found')
        ? 'Storage bucket "destination-heroes" does not exist yet — create it (public) in Supabase.'
        : 'Upload failed',
    }, { status: 500 });
  }

  const actor = req.headers.get('x-admin-email') || 'system';
  const label = slug
    ? `${HERO_DESTINATION_BY_CODE[code]} / ${slug} (${variant})`
    : `${HERO_DESTINATION_BY_CODE[code]} (${variant})`;
  void logAuditEvent({
    eventType: 'hero.uploaded',
    actor,
    targetId: slotKey(code, variant, slug),
    targetLabel: label,
    metadata: { code, variant, slug: slug ?? null, sizeBytes: file.size },
  });

  return NextResponse.json({
    ok: true,
    code,
    variant,
    slug: slug ?? null,
    key: slotKey(code, variant, slug),
    url: publicUrl(code, variant, slug),
  });
}

// ─────────── DELETE — remove one hero ───────────

export async function DELETE(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const code = (req.nextUrl.searchParams.get('code') || '').trim().toUpperCase();
  const variant = (req.nextUrl.searchParams.get('variant') || '').trim().toLowerCase();
  const slug = (req.nextUrl.searchParams.get('slug') || '').trim() || undefined;

  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }
  if (!VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'invalid_variant' }, { status: 400 });
  }
  if (slug && !isKnownLocation(code, slug)) {
    return NextResponse.json({ error: 'invalid_location' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).remove([objectPath(code, variant, slug)]);

  if (error) {
    console.error('[heroes.DELETE] remove failed:', error.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  const actor = req.headers.get('x-admin-email') || 'system';
  void logAuditEvent({
    eventType: 'hero.removed',
    actor,
    targetId: slotKey(code, variant, slug),
    targetLabel: slug ? `${HERO_DESTINATION_BY_CODE[code]} / ${slug} (${variant})` : `${HERO_DESTINATION_BY_CODE[code]} (${variant})`,
    metadata: { code, variant, slug: slug ?? null },
  });

  return NextResponse.json({ ok: true });
}
