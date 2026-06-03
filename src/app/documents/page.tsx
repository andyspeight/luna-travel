'use client';

import { useEffect, useRef, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import {
  IconDoc,
  IconChevR,
  IconDownload,
  IconShare,
  IconEye,
  IconShield2,
  IconTicket,
  IconBed,
  IconLounge,
  IconList,
  IconMail,
  IconCheck,
} from '@/components/icons';
import { fileSize, formatDate } from '@/lib/format';
import type { Document } from '@/types/booking';

/* -------------------------------------------------------------------------
 * Display model
 *
 * Documents arrive from two places:
 *   1. Agency uploads — the documents an agent attaches to a traveller via
 *      Control. Served by GET /api/traveller/documents (session-gated, signed
 *      URLs). These are the real, authoritative documents and take priority.
 *   2. The booking's own documents — Travelify-embedded order docs on a live
 *      booking, or the demo/mock placeholders on the TravelTech Show path.
 *
 * Both are normalised to a single DisplayDoc shape so the render path never
 * does a fragile lookup and can never crash on an unrecognised category/kind.
 * ---------------------------------------------------------------------- */

type DisplayDoc = {
  id: string;
  name: string;
  pill: string;
  gradient: string;
  icon: React.ReactNode;
  sizeBytes?: number;
  updatedAt?: string;
  url: string;
};

type Style = { gradient: string; icon: React.ReactNode; pill: string };

// Keyed by the booking Document['kind'] union (mock + Travelify order docs).
const KIND_META: Record<Document['kind'], Style> = {
  'booking-pack': {
    gradient: 'linear-gradient(135deg, #DC2626, #991B1B)',
    icon: <IconDoc size={22} />,
    pill: 'Booking pack',
  },
  'e-ticket': {
    gradient: 'linear-gradient(135deg, #1B2B5B, #2A3F7A)',
    icon: <IconTicket size={22} />,
    pill: 'E-ticket',
  },
  voucher: {
    gradient: 'linear-gradient(135deg, #0EA5E9, #0369A1)',
    icon: <IconBed size={22} />,
    pill: 'Voucher',
  },
  'lounge-pass': {
    gradient: 'linear-gradient(135deg, #1B2B5B, #0096B7)',
    icon: <IconLounge size={22} />,
    pill: 'Lounge pass',
  },
  atol: {
    gradient: 'linear-gradient(135deg, #16A34A, #14532D)',
    icon: <IconShield2 size={22} />,
    pill: 'ATOL',
  },
  insurance: {
    gradient: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
    icon: <IconShield2 size={22} />,
    pill: 'Insurance',
  },
  other: {
    gradient: 'linear-gradient(135deg, #475569, #1E293B)',
    icon: <IconDoc size={22} />,
    pill: 'Document',
  },
};

// Keyed by the stored document category (categorise-document.ts):
// 'voucher' | 'ticket' | 'itinerary' | 'insurance' | 'other'.
const CATEGORY_META: Record<string, Style> = {
  voucher: {
    gradient: 'linear-gradient(135deg, #0EA5E9, #0369A1)',
    icon: <IconBed size={22} />,
    pill: 'Voucher',
  },
  ticket: {
    gradient: 'linear-gradient(135deg, #1B2B5B, #2A3F7A)',
    icon: <IconTicket size={22} />,
    pill: 'E-ticket',
  },
  itinerary: {
    gradient: 'linear-gradient(135deg, #0096B7, #1B2B5B)',
    icon: <IconList size={22} />,
    pill: 'Itinerary',
  },
  insurance: {
    gradient: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
    icon: <IconShield2 size={22} />,
    pill: 'Insurance',
  },
  other: {
    gradient: 'linear-gradient(135deg, #475569, #1E293B)',
    icon: <IconDoc size={22} />,
    pill: 'Document',
  },
};

// Safe lookups — an unknown kind/category can never blank the screen.
const kindStyle = (kind: string): Style => KIND_META[kind as Document['kind']] ?? KIND_META.other;
const categoryStyle = (category: string): Style => CATEGORY_META[category] ?? CATEGORY_META.other;

/** The raw row shape returned by GET /api/traveller/documents. */
type AgencyDoc = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
  category: string;
  uploadedAt: string;
  url: string | null;
};

/** "01_flight-confirmation.pdf" -> "Flight confirmation". */
function prettyName(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, ''); // drop extension
  const noPrefix = base.replace(/^\d+[\s._-]+/, ''); // drop a leading "01_" / "02 - "
  const spaced = noPrefix.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const text = spaced || base || filename;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function agencyToDisplay(d: AgencyDoc): DisplayDoc {
  const m = categoryStyle(d.category);
  return {
    id: d.id,
    name: prettyName(d.filename),
    pill: m.pill,
    gradient: m.gradient,
    icon: m.icon,
    sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : undefined,
    updatedAt: d.uploadedAt || undefined,
    url: d.url || '#',
  };
}

function bookingToDisplay(d: Document): DisplayDoc {
  const m = kindStyle(d.kind);
  return {
    id: d.id,
    name: d.name,
    pill: m.pill,
    gradient: m.gradient,
    icon: m.icon,
    sizeBytes: d.sizeBytes,
    updatedAt: d.updatedAt || undefined,
    url: d.url || '#',
  };
}

export default function DocumentsPage() {
  const { booking } = useBooking();
  const [agencyDocs, setAgencyDocs] = useState<AgencyDoc[] | null>(null); // null = still loading
  const [active, setActive] = useState<DisplayDoc | null>(null);

  // Pull the traveller's agency-uploaded documents. Fail closed: any non-200
  // (e.g. 401 on the mock/demo path with no session) or network error falls
  // back to the booking's own documents, so the demo never breaks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/traveller/documents', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 200) {
          const data = await res.json();
          setAgencyDocs(Array.isArray(data?.documents) ? (data.documents as AgencyDoc[]) : []);
        } else {
          setAgencyDocs([]);
        }
      } catch {
        if (!cancelled) setAgencyDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = agencyDocs === null;
  const realDocs = (agencyDocs ?? []).map(agencyToDisplay);
  const fallbackDocs = booking.documents.map(bookingToDisplay);
  // Real agency uploads win. Otherwise show the booking's own docs (live order
  // docs, or the demo placeholders on the mock path).
  const docs: DisplayDoc[] = realDocs.length > 0 ? realDocs : fallbackDocs;

  return (
    <PageEnter>
      <main className="px-5 pt-2 pb-6">
        <header className="py-3">
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
            Documents
          </h1>
          <p className="text-sm text-ink-2 mt-1.5">
            {loading
              ? 'Loading your documents…'
              : docs.length === 0
                ? 'Nothing here yet'
                : `Available offline · ${docs.length} item${docs.length === 1 ? '' : 's'}`}
          </p>
        </header>

        {/* Offline-ready badge — only once we actually have documents */}
        {!loading && docs.length > 0 && (
          <div className="mt-2 mb-4 inline-flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-1 rounded-full text-[11px] font-semibold">
            <IconCheck size={12} />
            All saved on this device
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <section className="space-y-2.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light animate-pulse"
              >
                <span className="rounded-lg bg-line-light flex-shrink-0" style={{ height: 60, width: 48 }} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-line-light" />
                  <div className="h-2.5 w-2/5 rounded bg-line-light" />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Empty state */}
        {!loading && docs.length === 0 && (
          <section className="mt-6 flex flex-col items-center text-center px-6 py-10 rounded-2xl bg-surface border border-line-light">
            <span className="w-12 h-12 rounded-full bg-surface-2 text-ink-3 flex items-center justify-center mb-3">
              <IconDoc size={22} />
            </span>
            <div className="text-sm font-semibold text-ink">No documents yet</div>
            <p className="text-xs text-ink-2 mt-1 max-w-[15rem]">
              Your travel documents will appear here as soon as your travel agent adds them.
            </p>
          </section>
        )}

        {/* Document list */}
        {!loading && docs.length > 0 && (
          <section className="space-y-2.5">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActive(d)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light hover:shadow-sm transition-shadow tap text-left"
              >
                <span
                  className="rounded-lg text-white flex items-center justify-center flex-shrink-0 shadow-md"
                  style={{ background: d.gradient, height: 60, width: 48 }}
                >
                  {d.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{d.name}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">
                    PDF
                    {typeof d.sizeBytes === 'number' ? ` · ${fileSize(d.sizeBytes)}` : ''}
                    {d.updatedAt ? ` · Updated ${formatDate(d.updatedAt, { day: 'numeric', month: 'short' })}` : ''}
                  </div>
                </div>
                <IconChevR size={18} className="text-ink-3 flex-shrink-0" />
              </button>
            ))}
          </section>
        )}

        {/* Email all card */}
        {!loading && docs.length > 0 && (
          <section className="mt-6 p-4 rounded-2xl bg-surface border border-line-light">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
                <IconMail size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">Email everything to yourself</div>
                <div className="text-xs text-ink-2 mt-0.5">
                  We&rsquo;ll send the whole pack to {booking.leadEmail}.
                </div>
              </div>
            </div>
            <ActionButton variant="secondary" icon={<IconMail size={16} />}>
              Email all documents
            </ActionButton>
          </section>
        )}
      </main>

      {active && <DocSheet doc={active} onClose={() => setActive(null)} />}
    </PageEnter>
  );
}

/**
 * Bottom sheet for a single document — preview, share, download.
 * Click outside, Escape, or the X button to close.
 */
function DocSheet({ doc, onClose }: { doc: DisplayDoc; onClose: () => void }) {
  const [shareToast, setShareToast] = useState<string | null>(null);
  const canPreview = !!doc.url && doc.url !== '#';

  const showToast = (msg: string) => {
    setShareToast(msg);
    window.setTimeout(() => setShareToast(null), 2500);
  };

  const openDoc = () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const downloadDoc = () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    // Trigger a real download using a temporary anchor element.
    // The `download` attribute forces a save dialog rather than in-tab preview.
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-') + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareDoc = async () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    const absoluteUrl = new URL(doc.url, window.location.origin).toString();
    // Web Share API where available (iOS Safari, Android Chrome)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: doc.name,
          text: `${doc.name} — sent from Luna Travel`,
          url: absoluteUrl,
        });
        return;
      } catch (err) {
        // AbortError = user cancelled. Anything else, fall through to clipboard.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    // Fallback: copy the URL to the clipboard
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Sharing not supported on this device');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={doc.name}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-surface rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3/40" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className="w-14 rounded-lg text-white flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: doc.gradient, height: 70 }}
          >
            {doc.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {doc.pill}
            </div>
            <h2 className="text-base font-semibold text-ink leading-snug mt-0.5">
              {doc.name}
            </h2>
            <div className="text-[11px] text-ink-3 mt-0.5">
              PDF{typeof doc.sizeBytes === 'number' ? ` · ${fileSize(doc.sizeBytes)}` : ''}
            </div>
          </div>
        </div>

        {/* In-app PDF preview — rendered to canvas so it works on phones too */}
        {canPreview ? (
          <PdfViewer url={doc.url} />
        ) : (
          <div className="mb-4 w-full rounded-xl border border-line bg-surface-2 aspect-[3/4] flex items-center justify-center text-ink-3">
            <div className="text-center px-6">
              <span
                className="inline-flex w-14 h-16 rounded-lg text-white items-center justify-center mb-3 shadow-md"
                style={{ background: doc.gradient }}
              >
                {doc.icon}
              </span>
              <div className="text-xs font-medium text-ink">Preview unavailable</div>
              <div className="text-[10px] mt-1 opacity-75">
                This document isn&rsquo;t available in this build
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton onClick={openDoc} icon={<IconEye size={18} />}>
            Open full screen
          </ActionButton>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={shareDoc} variant="secondary" icon={<IconShare size={16} />}>
              Share
            </ActionButton>
            <ActionButton onClick={downloadDoc} variant="secondary" icon={<IconDownload size={16} />}>
              Download
            </ActionButton>
          </div>
        </div>

        {shareToast && (
          <div className="mt-2 text-center text-[11px] text-success font-medium">
            {shareToast}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 h-10 text-sm font-medium text-ink-2 hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * In-app PDF viewer
 *
 * Mobile browsers (Android Chrome, iOS Safari) refuse to render a PDF inside
 * an <iframe> and substitute their own "tap to open" placeholder, which
 * strands the traveller in an external tab. To keep them inside the app we
 * render the PDF ourselves to <canvas> pages using PDF.js.
 *
 * PDF.js is loaded from a CDN on demand, so there's no npm dependency and the
 * library is only fetched the first time a document is opened. The PDF bytes
 * are fetched straight from the signed Supabase URL and processed entirely on
 * the device — nothing is sent to any third party. If anything fails (e.g. an
 * unexpected CORS block) we fall back to the Open / Download actions below.
 * ---------------------------------------------------------------------- */
const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const existing = (window as any).pdfjsLib;
  if (existing) return Promise.resolve(existing);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_LIB;
    s.async = true;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) {
        reject(new Error('pdfjsLib unavailable'));
        return;
      }
      try {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      } catch {
        /* worker is best-effort; PDF.js falls back to the main thread */
      }
      resolve(lib);
    };
    s.onerror = () => {
      pdfjsPromise = null; // allow a retry next open
      reject(new Error('failed to load PDF.js'));
    };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

function PdfViewer({ url }: { url: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;

        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;

        const container = scrollRef.current;
        if (!container) return;
        container.querySelectorAll('canvas').forEach((c) => c.remove());

        const cssWidth = container.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdf.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(n);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.borderRadius = '8px';
          canvas.style.marginBottom = n < pdf.numPages ? '8px' : '0';

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          container.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) {
            canvas.remove();
            return;
          }
          if (n === 1) setStatus('ready');
        }

        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      className="mb-4 relative rounded-xl border border-line bg-surface-2 overflow-hidden"
      style={{ height: '52vh' }}
    >
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-2" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
          <div className="flex flex-col items-center gap-2 text-ink-3">
            <span className="w-6 h-6 rounded-full border-2 border-teal/30 border-t-teal animate-spin" />
            <span className="text-[11px]">Loading preview…</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-center px-6 bg-surface-2">
          <div>
            <div className="text-xs font-medium text-ink">Preview couldn&rsquo;t load here</div>
            <div className="text-[10px] mt-1 text-ink-3">
              Use Open full screen or Download below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
