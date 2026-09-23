/**
 * Where an agency's branding images live in Blob storage, and the rule that
 * keeps each agency inside its own folder. Shared by the upload route (which
 * enforces it) and the branding form (which builds the paths).
 */

export const BRAND_FOLDERS = { logo: 'agency-logos', icon: 'agency-icons' } as const;
export type BrandImageKind = keyof typeof BRAND_FOLDERS;

/** Raster only: an uploaded SVG cannot be sanitised and can run script. */
export const BRAND_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const BRAND_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Is `pathname` inside this agency's own folder for one of the kinds? */
export function isOwnBrandPath(pathname: unknown, agencyId: string): boolean {
  if (typeof pathname !== 'string' || !agencyId) return false;
  if (pathname.includes('..') || pathname.includes('//') || pathname.includes('\\')) return false;
  return Object.values(BRAND_FOLDERS).some((folder) => pathname.startsWith(`${folder}/${agencyId}-`));
}

/** The path a browser uploads to. The file name is reduced to safe characters. */
export function brandPath(kind: BrandImageKind, agencyId: string, fileName: string, now = Date.now()): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60) || kind;
  return `${BRAND_FOLDERS[kind]}/${agencyId}-${now}-${safe}`;
}
