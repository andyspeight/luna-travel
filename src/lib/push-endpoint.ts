/** Push endpoints are https URLs issued by the browser's push service. */
export function isValidEndpoint(v: unknown): v is string {
  if (typeof v !== 'string' || v.length < 20 || v.length > 1000) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}
