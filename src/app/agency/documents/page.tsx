'use client';

/**
 * /agency/documents — the agency uploads traveller documents (vouchers,
 * tickets, insurance…) against a booking, and manages what it has uploaded.
 * Docs attach to a booking ref, so they can be added before the traveller
 * redeems; the traveller sees them once they open the app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, UploadCloud, Trash2, Check, Clock } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn } from '../portal-chrome';

interface Doc {
  id: string;
  bookingRef: string | null;
  delivered: boolean;
  filename: string;
  sizeBytes: number;
  category: string;
  uploadedAt: string;
}
interface Trip { reference: string; destination: string | null }

const CATEGORIES = ['auto', 'voucher', 'ticket', 'itinerary', 'insurance', 'other'];

function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const [bookingRef, setBookingRef] = useState('');
  const [category, setCategory] = useState('auto');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([
        fetch('/api/agency/documents', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { documents: [] })),
        fetch('/api/agency/bookings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { bookings: [] })),
      ]);
      setDocs(d.documents ?? []);
      setTrips((t.bookings ?? []).map((b: Record<string, unknown>) => ({ reference: b.reference, destination: b.destination })));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async () => {
    if (!file || !bookingRef.trim()) { setError('Pick a booking and a file.'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bookingRef', bookingRef.trim());
      if (category !== 'auto') fd.append('category', category);
      const res = await fetch('/api/agency/documents', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(prettyError(data.error, data.message)); setUploading(false); return; }
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: string) => {
    try {
      await fetch(`/api/agency/documents/${id}`, { method: 'DELETE' });
      await load();
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Documents</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
        Upload vouchers, tickets and insurance for a booking. Your traveller sees them in the app.
      </p>

      <div style={{ marginTop: 16 }}>
        <Callout title="Attach to a booking">
          Choose a booking reference (from your trips, or type one), pick the file, and upload. You can
          add documents before the traveller redeems — they&rsquo;ll appear the moment they open the app.
        </Callout>
      </div>

      {/* Upload */}
      <div style={{ ...card, padding: 20, marginTop: 18, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ flex: '2 1 200px' }}>
            <div style={lblTxt}>Booking reference</div>
            <input list="agency-trips" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="e.g. LT-4837" style={inp} />
            <datalist id="agency-trips">
              {trips.map((t) => <option key={t.reference} value={t.reference}>{t.destination || ''}</option>)}
            </datalist>
          </label>
          <label style={{ flex: '1 1 140px' }}>
            <div style={lblTxt}>Category</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'auto' ? 'Auto-detect' : c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </label>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
          style={{ border: `1.5px dashed ${file ? P.teal : P.line}`, borderRadius: 12, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', background: file ? `${P.teal}08` : '#fff' }}
        >
          <UploadCloud size={22} color={P.tealDark} style={{ margin: '0 auto' }} />
          <div style={{ fontSize: 13.5, color: P.ink, marginTop: 8, fontWeight: 600 }}>
            {file ? file.name : 'Drop a file here, or click to choose'}
          </div>
          <div style={{ fontSize: 12, color: P.ink3, marginTop: 3 }}>PDF or image · up to 10 MB</div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}

        <div>
          <button type="button" onClick={upload} disabled={uploading || !file || !bookingRef.trim()} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: uploading || !file || !bookingRef.trim() ? 0.6 : 1 }}>
            <UploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 26 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 20, color: P.ink, margin: 0 }}>Uploaded documents</h2>
        {loading ? (
          <p style={{ color: P.ink3, fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : docs.length === 0 ? (
          <div style={{ ...card, padding: 22, marginTop: 12, textAlign: 'center', color: P.ink3, fontSize: 13.5 }}>No documents yet.</div>
        ) : (
          <div style={{ ...card, marginTop: 12, overflow: 'hidden' }}>
            {docs.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: `${P.navy}0d`, color: P.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.filename}</div>
                  <div style={{ fontSize: 12, color: P.ink3, marginTop: 2 }}>
                    {cap(d.category)} · {fmtSize(d.sizeBytes)} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{d.bookingRef}</span>
                  </div>
                </div>
                {d.delivered ? (
                  <span title="Traveller can see this" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#047857', background: '#d1fae5', borderRadius: 999, padding: '2px 8px' }}>
                    <Check size={12} /> Delivered
                  </span>
                ) : (
                  <span title="Shows once the traveller redeems" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '2px 8px' }}>
                    <Clock size={12} /> Waiting
                  </span>
                )}
                <button type="button" onClick={() => del(d.id)} title="Delete" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.line}`, background: '#fff', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function fmtSize(b: number) { return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
function prettyError(code?: string, message?: string): string {
  if (message) return message;
  switch (code) {
    case 'booking_ref_required': return 'Choose a booking reference.';
    case 'file_required': return 'Choose a file to upload.';
    case 'file_too_large': return 'File is too large (max 10 MB).';
    case 'unsupported_type': return 'PDF and common image formats only.';
    case 'unauthorised': return 'Your session has ended — ask for a fresh access link.';
    default: return 'Upload failed. Please try again.';
  }
}

const inp: React.CSSProperties = { width: '100%', border: `1px solid ${P.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: P.ink, background: '#fff', boxSizing: 'border-box', outlineColor: P.teal };
const lblTxt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 6 };

export default function AgencyDocumentsPage() {
  return (
    <AgencyShell active="documents">
      <Documents />
    </AgencyShell>
  );
}
