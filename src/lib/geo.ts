/**
 * Pure geometry helpers for the trip map — no React, no DOM, no dependencies.
 *
 * Projection: equirectangular (plate carrée) with a longitude scale of
 * cos(midLatitude) so landmasses and routes don't look horizontally stretched
 * at the trip's latitude. This is deliberately simple and fully offline — the
 * trip map is a stylised "shape of the journey" view, not a survey instrument,
 * so we avoid a heavyweight projection library and any tile fetching.
 */

export interface LngLat {
  lng: number;
  lat: number;
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface Projection {
  /** Project a lng/lat to SVG x/y inside the configured viewBox. */
  project: (lng: number, lat: number) => { x: number; y: number };
  width: number;
  height: number;
  /** True if a lng/lat falls within the (padded) projected frame. */
  inFrame: (lng: number, lat: number) => boolean;
}

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres between two points. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box of a set of points. Returns null for an empty set. */
export function boundsOf(points: LngLat[]): BBox | null {
  if (points.length === 0) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Build a projection that frames `bbox` inside a `width`-wide viewBox.
 *
 * - `padFrac` expands the frame around the trip so pins aren't on the edge.
 * - `minSpanDeg` stops a single-point trip (e.g. hotel-only) from zooming to
 *   an absurd level; it guarantees at least this many degrees are visible.
 * - The height is derived from the framed aspect ratio (after the cos-lat
 *   longitude correction), clamped so the map never becomes a thin sliver.
 */
export function makeProjection(
  bbox: BBox,
  width = 1000,
  padFrac = 0.35,
  minSpanDeg = 12,
): Projection {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const lngScale = Math.max(0.15, Math.cos(toRad(midLat)));

  // Raw spans, with a floor so tiny trips still get a sensible window.
  let spanLat = Math.max(bbox.maxLat - bbox.minLat, minSpanDeg);
  let spanLng = Math.max((bbox.maxLng - bbox.minLng) * lngScale, minSpanDeg);

  // Pad.
  const padLat = spanLat * padFrac;
  const padLng = spanLng * padFrac;
  spanLat += padLat * 2;
  spanLng += padLng * 2;

  const cLng = (bbox.minLng + bbox.maxLng) / 2;
  const cLat = (bbox.minLat + bbox.maxLat) / 2;

  const left = cLng - spanLng / 2 / lngScale;
  const right = cLng + spanLng / 2 / lngScale;
  const top = cLat + spanLat / 2;
  const bottom = cLat - spanLat / 2;

  // Height from aspect; clamp aspect to keep the card from getting too tall/short.
  const aspect = Math.min(1.5, Math.max(0.55, spanLat / spanLng));
  const height = Math.round(width * aspect);

  const project = (lng: number, lat: number) => {
    const x = ((lng - left) / (right - left)) * width;
    const y = ((top - lat) / (top - bottom)) * height;
    return { x, y };
  };

  const inFrame = (lng: number, lat: number) =>
    lng >= left - 5 && lng <= right + 5 && lat >= bottom - 5 && lat <= top + 5;

  return { project, width, height, inFrame };
}

/**
 * Quadratic-bezier "flight arc" between two projected points, bowed
 * perpendicular to the chord so legs read as routes rather than straight lines.
 * `bow` is a fraction of the chord length (positive bows "up-left").
 */
export function arcPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bow = 0.18,
): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector.
  const nx = -dy / len;
  const ny = dx / len;
  const off = len * bow;
  const cx = mx + nx * off;
  const cy = my + ny * off;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(
    1,
  )} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** Format a distance for display (km, rounded sensibly). */
export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '';
  if (km < 10) return `${km.toFixed(1)} km`;
  if (km < 1000) return `${Math.round(km)} km`;
  return `${Math.round(km / 10) * 10} km`;
}
