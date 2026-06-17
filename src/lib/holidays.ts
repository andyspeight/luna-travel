/**
 * Public-holiday + observance adapter — server-only, per stay.
 *
 * Two sources:
 *   - Nager.Date (keyless) — public holidays by country/year.
 *   - Calendarific (CALENDARIFIC_KEY) — broader coverage incl. religious
 *     observances (Ramadan, Eid, regional dates) that keyless sources miss.
 *
 * Verification (agree-or-drop): a PUBLIC HOLIDAY is shown only when both sources
 * confirm it on the same date (when both are available). OBSERVANCES (e.g.
 * Ramadan) come from Calendarific — Nager doesn't track them — and are clearly
 * labelled as such. When only one source is available (e.g. no key locally),
 * its results are shown but flagged single-source. Only dates inside the stay
 * window are returned.
 */

const NAGER = 'https://date.nager.at/api/v3/PublicHolidays';
const CALENDARIFIC = 'https://calendarific.com/api/v2/holidays';

export interface StayHoliday {
  date: string;
  name: string;
  kind: 'public' | 'observance';
  sources: string[];
}

export interface StayHolidays {
  holidays: StayHoliday[];
  sourceCount: number;
  asOf: string;
}

export function holidaysConfigured(): boolean {
  return true; // Nager.Date is always available; Calendarific is additive.
}

async function getJson<T>(url: string, revalidate = 86_400): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function yearsBetween(from: string, to: string): number[] {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime())) return [];
  const y1 = a.getUTCFullYear();
  const y2 = Number.isNaN(b.getTime()) ? y1 : b.getUTCFullYear();
  const out: number[] = [];
  for (let y = y1; y <= y2; y++) out.push(y);
  return out;
}

function inWindow(date: string, from: string, to: string): boolean {
  const d = date.slice(0, 10);
  return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}

type NagerHol = { date: string; localName?: string; name?: string };
type CalResp = {
  response?: { holidays?: Array<{ name?: string; type?: string[]; primary_type?: string; date?: { iso?: string } }> };
};

export async function getStayHolidays(opts: {
  countryCode: string;
  from: string;
  to: string;
}): Promise<StayHolidays> {
  const { countryCode, from, to } = opts;
  const cc = countryCode.toUpperCase().replace(/[^A-Z]/g, '');
  const asOf = new Date().toISOString();
  const years = yearsBetween(from, to);
  if (cc.length !== 2 || !years.length) return { holidays: [], sourceCount: 0, asOf };

  const key = process.env.CALENDARIFIC_KEY;

  // Nager.Date (keyless)
  const nagerByDate = new Map<string, string>();
  await Promise.all(
    years.map(async (y) => {
      const rows = await getJson<NagerHol[]>(`${NAGER}/${y}/${cc}`);
      for (const r of rows || []) {
        if (r.date && inWindow(r.date, from, to)) {
          nagerByDate.set(r.date.slice(0, 10), r.localName || r.name || 'Public holiday');
        }
      }
    }),
  );

  // Calendarific (keyed) — public + observances
  const calPublic = new Map<string, string>();
  const calObservance = new Map<string, string>();
  if (key) {
    await Promise.all(
      years.map(async (y) => {
        const usp = new URLSearchParams({ api_key: key, country: cc, year: String(y) });
        const data = await getJson<CalResp>(`${CALENDARIFIC}?${usp}`);
        for (const h of data?.response?.holidays || []) {
          const iso = h.date?.iso?.slice(0, 10);
          if (!iso || !inWindow(iso, from, to)) continue;
          const types = (h.type || []).join(' ').toLowerCase();
          const isPublic = /national|public|federal|bank/.test(types) || /national|public/.test((h.primary_type || '').toLowerCase());
          if (isPublic) calPublic.set(iso, h.name || 'Public holiday');
          else calObservance.set(iso, h.name || 'Observance');
        }
      }),
    );
  }

  const sourceCount = key ? 2 : 1;
  const out: StayHoliday[] = [];

  // Public holidays: require both sources to agree on the date when both exist.
  const publicDates = new Set<string>([...nagerByDate.keys(), ...calPublic.keys()]);
  for (const date of publicDates) {
    const inNager = nagerByDate.has(date);
    const inCal = calPublic.has(date);
    if (key) {
      if (inNager && inCal) {
        out.push({ date, name: nagerByDate.get(date)!, kind: 'public', sources: ['Nager.Date', 'Calendarific'] });
      }
      // present in only one of two available sources → not confirmed, drop.
    } else if (inNager) {
      out.push({ date, name: nagerByDate.get(date)!, kind: 'public', sources: ['Nager.Date'] });
    }
  }

  // Observances (Calendarific only — Nager doesn't track these).
  for (const [date, name] of calObservance) {
    out.push({ date, name, kind: 'observance', sources: ['Calendarific'] });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return { holidays: out, sourceCount, asOf };
}
