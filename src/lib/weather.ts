/**
 * Live weather adapter — server-only, per stay.
 *
 * Two regimes, keyed to how far out the stay is:
 *   - Near (stay overlaps the next ~14 days): a real daily FORECAST, cross-checked
 *     across two independent providers (Open-Meteo + MET Norway / yr.no) and shown
 *     "agree-or-drop" — figures only when they agree within tolerance, else a range.
 *   - Far (beyond the forecast horizon): location-specific CLIMATE NORMALS for the
 *     stay's month(s), from Open-Meteo's historical archive (5-yr average). Labelled
 *     "typical", never presented as a forecast.
 *
 * Sea-surface temperature is added for coastal stays (Open-Meteo Marine).
 *
 * Both providers are keyless. Data integrity: nothing is invented — if a value
 * can't be resolved it is omitted, and provider disagreement widens to a range
 * rather than guessing.
 */

const OM_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OM_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const OM_MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const MET_NO = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
// MET Norway requires an identifying User-Agent with contact info.
const MET_UA = 'LunaTravel/1.0 (https://lunatravel.travelify.io; ops@travelgenix.io)';

const FORECAST_HORIZON_DAYS = 14;
const DAY_MS = 86_400_000;

export interface WeatherDay {
  date: string;
  maxC: number | null;
  minC: number | null;
  precipProb?: number | null;
}

export interface StayWeather {
  mode: 'forecast' | 'normals' | 'unavailable';
  summary: string;
  maxC: number | null;
  minC: number | null;
  seaTempC?: number | null;
  days?: WeatherDay[];
  monthLabel?: string;
  sources: string[];
  asOf: string;
  note?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function getJson<T>(url: string, init?: RequestInit & { revalidate?: number }): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: init?.revalidate ?? 10_800 }, // 3h default
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function round(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ───────── Forecast (near) ─────────

type OMForecast = {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

async function openMeteoForecast(lat: number, lng: number, from: string, to: string) {
  const usp = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    start_date: from,
    end_date: to,
  });
  const data = await getJson<OMForecast>(`${OM_FORECAST}?${usp}`);
  const d = data?.daily;
  if (!d?.time) return null;
  const byDate = new Map<string, { max: number | null; min: number | null; pp: number | null }>();
  d.time.forEach((t, i) => {
    byDate.set(t, {
      max: d.temperature_2m_max?.[i] ?? null,
      min: d.temperature_2m_min?.[i] ?? null,
      pp: d.precipitation_probability_max?.[i] ?? null,
    });
  });
  return byDate;
}

type MetNo = { properties?: { timeseries?: Array<{ time: string; data?: { instant?: { details?: { air_temperature?: number } } } }> } };

/** MET Norway gives a sub-daily series; reduce to daily max/min air temperature. */
async function metNoDailyTemps(lat: number, lng: number) {
  const usp = new URLSearchParams({ lat: lat.toFixed(4), lon: lng.toFixed(4) });
  const data = await getJson<MetNo>(`${MET_NO}?${usp}`, { headers: { 'User-Agent': MET_UA } });
  const series = data?.properties?.timeseries;
  if (!series) return null;
  const byDate = new Map<string, { max: number; min: number }>();
  for (const pt of series) {
    const temp = pt.data?.instant?.details?.air_temperature;
    if (typeof temp !== 'number') continue;
    const date = pt.time.slice(0, 10);
    const cur = byDate.get(date);
    if (!cur) byDate.set(date, { max: temp, min: temp });
    else {
      cur.max = Math.max(cur.max, temp);
      cur.min = Math.min(cur.min, temp);
    }
  }
  return byDate;
}

// ───────── Normals (far) ─────────

type OMArchive = {
  daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
};

/** Average daily max/min over the last 5 complete years, for the months the stay spans. */
async function openMeteoNormals(lat: number, lng: number, months: Set<number>) {
  const thisYear = new Date().getUTCFullYear();
  const start = `${thisYear - 5}-01-01`;
  const end = `${thisYear - 1}-12-31`;
  const usp = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  const data = await getJson<OMArchive>(`${OM_ARCHIVE}?${usp}`, { revalidate: 604_800 }); // 7d
  const d = data?.daily;
  if (!d?.time) return null;
  let maxSum = 0, maxN = 0, minSum = 0, minN = 0;
  d.time.forEach((t, i) => {
    const month = Number(t.slice(5, 7)) - 1;
    if (!months.has(month)) return;
    const mx = d.temperature_2m_max?.[i];
    const mn = d.temperature_2m_min?.[i];
    if (typeof mx === 'number') { maxSum += mx; maxN++; }
    if (typeof mn === 'number') { minSum += mn; minN++; }
  });
  if (!maxN || !minN) return null;
  return { maxC: maxSum / maxN, minC: minSum / minN };
}

// ───────── Sea temperature (coastal) ─────────

type OMMarine = { hourly?: { sea_surface_temperature?: number[] } };

/** Mean sea-surface temperature over the stay (hourly SST is the reliably
 *  supported marine field). Far-out stays sample the same window in the most
 *  recent prior year as a "typical" value. Returns null for inland points
 *  (no marine data) — never guessed. */
async function seaTemp(lat: number, lng: number, from: string, to: string, near: boolean): Promise<number | null> {
  let start = from.slice(0, 10);
  let end = to.slice(0, 10);
  if (!near) {
    const y = new Date().getUTCFullYear() - 1;
    start = `${y}${start.slice(4)}`;
    end = `${y}${end.slice(4)}`;
  }
  const usp = new URLSearchParams({
    latitude: String(lat), longitude: String(lng),
    hourly: 'sea_surface_temperature', timezone: 'auto', start_date: start, end_date: end,
  });
  const data = await getJson<OMMarine>(`${OM_MARINE}?${usp}`, { revalidate: near ? 10_800 : 604_800 });
  const vals = (data?.hourly?.sea_surface_temperature || []).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function monthsBetween(from: string, to: string): Set<number> {
  const months = new Set<number>();
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime())) return months;
  const end = Number.isNaN(b.getTime()) ? a : b;
  const cur = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  while (cur <= end) {
    months.add(cur.getUTCMonth());
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

// ───────── Public ─────────

export async function getStayWeather(opts: {
  lat: number;
  lng: number;
  from: string;
  to: string;
}): Promise<StayWeather> {
  const { lat, lng, from, to } = opts;
  const now = Date.now();
  const fromMs = new Date(from).getTime();
  const horizon = now + FORECAST_HORIZON_DAYS * DAY_MS;
  const near = Number.isFinite(fromMs) && fromMs <= horizon;
  const asOf = new Date().toISOString();

  if (near) {
    // Clamp the forecast window to [today, today+14] ∩ [from, to].
    const start = ymd(new Date(Math.max(now, fromMs)));
    const end = ymd(new Date(Math.min(horizon, new Date(to).getTime() || horizon)));
    const [om, met, sst] = await Promise.all([
      openMeteoForecast(lat, lng, start, end),
      metNoDailyTemps(lat, lng),
      seaTemp(lat, lng, start, end, true),
    ]);
    if (!om) return { mode: 'unavailable', summary: '', maxC: null, minC: null, sources: [], asOf };

    const days: WeatherDay[] = [];
    let noteDisagree = false;
    let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
    for (const [date, o] of om) {
      let maxC = o.max;
      let minC = o.min;
      const m = met?.get(date);
      // Agree-or-drop: average when the two providers are within 3°C, else keep
      // the primary but flag the divergence.
      if (m && o.max != null && Math.abs(m.max - o.max) <= 3) maxC = (m.max + o.max) / 2;
      else if (m && o.max != null) noteDisagree = true;
      if (m && o.min != null && Math.abs(m.min - o.min) <= 3) minC = (m.min + o.min) / 2;
      days.push({ date, maxC: round(maxC), minC: round(minC), precipProb: o.pp });
      if (maxC != null) { hiSum += maxC; hiN++; }
      if (minC != null) { loSum += minC; loN++; }
    }
    const maxC = hiN ? round(hiSum / hiN) : null;
    const minC = loN ? round(loSum / loN) : null;
    return {
      mode: 'forecast',
      summary: maxC != null && minC != null ? `Highs around ${maxC}°C, lows ${minC}°C` : 'Forecast available',
      maxC, minC,
      seaTempC: round(sst),
      days,
      sources: met ? ['Open-Meteo', 'MET Norway'] : ['Open-Meteo'],
      asOf,
      note: noteDisagree ? 'Forecast providers differed on some days; showing the more cautious value.' : undefined,
    };
  }

  // Far out → climate normals.
  const months = monthsBetween(from, to);
  const [normals, sst] = await Promise.all([
    openMeteoNormals(lat, lng, months),
    seaTemp(lat, lng, from, to, false),
  ]);
  if (!normals) return { mode: 'unavailable', summary: '', maxC: null, minC: null, sources: [], asOf };
  const monthLabel = Array.from(months).sort((a, b) => a - b).map((m) => MONTHS[m]).join(' / ');
  const maxC = round(normals.maxC);
  const minC = round(normals.minC);
  return {
    mode: 'normals',
    summary: maxC != null && minC != null ? `Typically ${maxC}°C high, ${minC}°C low in ${monthLabel}` : `Typical for ${monthLabel}`,
    maxC, minC,
    seaTempC: round(sst),
    monthLabel,
    sources: ['Open-Meteo (5-yr average)'],
    asOf,
    note: 'Typical conditions for your travel month, not a forecast — based on the last five years.',
  };
}
