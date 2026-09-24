/**
 * Upload a branding image from the portal, in the browser.
 *
 * The same two steps @vercel/blob's upload() takes (ask our route for a
 * one-off token, then send the file straight to Blob storage with it), with
 * one difference: the token is asked for with the page's own fetch, looked up
 * when the upload starts.
 *
 * That difference is the whole point. The library keeps its own copy of fetch,
 * taken when its code first loads, which is before the portal wraps fetch to
 * add the "acting as" header (lib/act-as-client). So for a Travelgenix staff
 * member acting as a client, the token request went out as themselves, the
 * route correctly refused to put their upload in the client's folder, and the
 * screen said "The upload did not go through" (24 Sep 2026: "Invalid upload
 * path" in the log). Asked for through window.fetch, it carries the header
 * like every other portal call.
 *
 * The file itself goes to Blob storage with the token and needs no header.
 */

import { put } from '@vercel/blob/client';

const HANDLE_UPLOAD_URL = '/api/agency/upload-image';

/** Why an upload was refused, from our route's error code. */
export class UploadRefused extends Error {
  constructor(public code: string) {
    super(`upload refused: ${code}`);
  }
}

/** A one-off Blob upload token for this exact path. */
export async function requestUploadToken(pathname: string): Promise<string> {
  const url = new URL(HANDLE_UPLOAD_URL, window.location.origin).toString();
  // Looked up now, not imported: this must be the portal's wrapped fetch.
  const res = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, callbackUrl: url, clientPayload: null, multipart: false },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { clientToken?: unknown; error?: unknown };
  if (!res.ok) throw new UploadRefused(typeof json.error === 'string' ? json.error : String(res.status));
  if (typeof json.clientToken !== 'string' || !json.clientToken) throw new UploadRefused('no_token');
  return json.clientToken;
}

/** Upload `file` to `pathname`; resolves to the public URL it landed at. */
export async function uploadBrandImage(pathname: string, file: File): Promise<string> {
  const token = await requestUploadToken(pathname);
  const blob = await put(pathname, file, { access: 'public', token, contentType: file.type });
  return blob.url;
}
