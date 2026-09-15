/**
 * What kind of file a document is.
 *
 * Three things depend on getting this right, and they used to disagree:
 *   - which viewer the sheet renders (PDF.js cannot open a JPEG)
 *   - what the sheet calls the file, which said "PDF" for everything
 *   - the name a download is saved under, which appended ".pdf" to everything
 *
 * Travel documents are overwhelmingly PDFs, so an unknown extension resolves to
 * PDF — but tickets for the Orlando parks arrive as JPEGs, and one of the
 * biggest clients sells nothing else.
 *
 * Shared by the traveller documents page and the document proxy so the browser
 * and the server can never reach different conclusions about the same file.
 */

/** Extensions we render as a picture rather than through PDF.js. */
export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'tif', 'tiff']);

/**
 * Lowercase extension for a document, preferring a declared MIME type over the
 * filename because suppliers name files carelessly. Falls back to 'pdf'.
 */
export function extOf(nameOrUrl: string, mime?: string | null): string {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) {
    const sub = m.slice(6).split('+')[0];
    if (sub) return normaliseExt(sub);
  }
  const path = (nameOrUrl || '').split(/[?#]/)[0];
  const hit = /\.([a-z0-9]{1,5})$/i.exec(path);
  return hit ? normaliseExt(hit[1]) : 'pdf';
}

/** MIME type implied by a filename. The inverse of extOf, for the proxy. */
export function mimeFromName(nameOrUrl: string): string {
  switch (extOf(nameOrUrl)) {
    case 'jpg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'heic': return 'image/heic';
    case 'tiff': return 'image/tiff';
    default: return 'application/pdf';
  }
}

/** One spelling per format, so 'jpeg' and 'jpg' cannot be treated as different. */
function normaliseExt(raw: string): string {
  const e = raw.toLowerCase();
  if (e === 'jpeg') return 'jpg';
  if (e === 'tif') return 'tiff';
  if (e === 'heif') return 'heic';
  return e;
}
