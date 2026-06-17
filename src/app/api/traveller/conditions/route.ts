/**
 * GET /api/traveller/conditions?loc=lat,lng,CC,fromISO,toISO,label&loc=...
 *
 * The live, date-specific layer for the destination guide's "For your dates"
 * tab: per stay segment, the weather (forecast near / climate normals far) and
 * the public holidays + observances that fall inside that stay.
 *
 * One `loc` per stay segment — the page builds these from the booking's hotels
 * (merging consecutive stays in the same place). Public, traveller-facing — it
 * returns only destination conditions, no PII.
 *
 * Weather sources are keyless; Calendarific (holidays) uses CALENDARIFIC_KEY.
 * Each segment fails soft to nulls rather than erroring the whole response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStayWeather } from '@/lib/weather';
import { getStayHolidays } from '@/lib/holidays';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Segment {
  label: string;
  countryCode: string;
  lat: number;
  lng: number;
  from: string;
  to: string;
}

function parseLoc(raw: string): Segment | null {
  const [lat, lng, cc, from, to, ...labelParts] = raw.split(',');
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;
  if (!/^[A-Za-z]{2}$/.test(cc || '')) return null;
  if (!from || !to) return null;
  return {
    lat: latN,
    lng: lngN,
    countryCode: cc.toUpperCase(),
    from,
    to,
    label: (labelParts.join(',') || cc).trim(),
  };
}

export async function GET(req: NextRequest) {
  const locs = req.nextUrl.searchParams.getAll('loc').map(parseLoc).filter((s): s is Segment => !!s);
  if (!locs.length) {
    return NextResponse.json({ error: 'no_segments' }, { status: 400 });
  }
  // Cap to a sane number of segments per booking.
  const segments = locs.slice(0, 8);

  const results = await Promise.all(
    segments.map(async (s) => {
      const [weather, holidays] = await Promise.all([
        getStayWeather({ lat: s.lat, lng: s.lng, from: s.from, to: s.to }).catch(() => null),
        getStayHolidays({ countryCode: s.countryCode, from: s.from, to: s.to }).catch(() => null),
      ]);
      return {
        label: s.label,
        countryCode: s.countryCode,
        from: s.from,
        to: s.to,
        weather: weather && weather.mode !== 'unavailable' ? weather : null,
        holidays: holidays && holidays.holidays.length ? holidays : null,
      };
    }),
  );

  return NextResponse.json({ configured: true, segments: results, generatedAt: new Date().toISOString() });
}
