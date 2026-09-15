/**
 * Copy PDF.js's worker into public/ so it is served from our own origin.
 *
 * The worker cannot be imported like ordinary code — PDF.js loads it by URL at
 * runtime — so it has to exist as a static file. Serving it ourselves rather
 * than from a CDN is the whole point: the traveller app is a PWA that people
 * open in airports and abroad, and a document preview that depends on a third
 * party's CDN being reachable is a preview that fails exactly when it matters.
 * Same-origin also means the service worker can cache it.
 *
 * The LEGACY build is deliberate. Travellers open this on whatever phone they
 * own, including old iOS Safari, and the modern build assumes syntax those
 * browsers do not have. The lib import in documents/page.tsx uses the matching
 * legacy build; the two must stay a pair or PDF.js refuses to start.
 *
 * Runs before every build (and before dev), so the file can never drift from
 * the installed version of pdfjs-dist.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/pdfjs-dist/package.json'), 'utf8'));
const src = join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js');
const dest = join(root, 'public/pdf.worker.min.js');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[pdf-worker] public/pdf.worker.min.js <- pdfjs-dist@${pkg.version}`);
