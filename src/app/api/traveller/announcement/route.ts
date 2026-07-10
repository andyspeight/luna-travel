/**
 * GET /api/traveller/announcement — public: the current maintenance-banner state
 * (set in admin Settings → kill switches). Returns only the safe public fields.
 * No auth: it's shown app-wide, including before a traveller has a session.
 */

import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/platform-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { maintenance } = await getPlatformSettings();
  return NextResponse.json({ maintenance: { enabled: maintenance.enabled, message: maintenance.message } });
}
