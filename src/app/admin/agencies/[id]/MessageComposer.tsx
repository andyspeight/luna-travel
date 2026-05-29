'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import {
  X,
  Loader2,
  AlertCircle,
  ImagePlus,
  Link2,
  Send,
  Trash2,
  Check,
} from 'lucide-react';

// Compose a single message to one traveller. Writes via
// POST /api/admin/agencies/[id]/messages (one messages row + one
// message_recipients row). Images upload straight to Blob from the browser via
// /message-image. Shows the history of what's already been sent to this
// traveller, with read status fed back from message_recipients.read_at.

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
  accent: '#00B4D8',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
};

type Priority = 'info' | 'important' | 'urgent';

type Attachment =
  | { type: 'image'; url: string }
  | { type: 'link'; url: string; label?: string };

interface SentMessage {
  id: string;
  subject: string | null;
  body: string;
  attachments: Attachment[];
  priority: string;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const PRIORITY_OPTS: { value: Priority; label: string; color: string; soft: string }[] = [
  { value: 'info', label: 'Info', color: C.textSecondary, soft: C.bgTertiary },
  { value: 'important', label: 'Important', color: C.warning, soft: C.warningSoft },
  { value: 'urgent', label: 'Urgent', color: C.error, soft: C.errorSoft },
];

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getImage(atts: Attachment[]): { url: string } | undefined {
  return atts.find((a): a is { type: 'image'; url: string } => a.type === 'image');
}
function getLink(atts: Attachment[]): { url: string; label?: string } | undefined {
  return atts.find((a): a is { type: 'link'; url: string; label?: string } => a.type === 'link');
}

export default function MessageComposer({
  agency,
  traveller,
  onClose,
  onSent,
}: {
  agency: { id: string; name?: string };
  traveller: { id: string; name: string };
  onClose: () => void;
  onSent?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('info');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const [history, setHistory] = useState<SentMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fileRef = useRef<HTMLInputElement | null>(null);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/admin/agencies/${agency.id}/messages?travellerId=${encodeURIComponent(traveller.id)}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) {
        setHistory(data.messages as SentMessage[]);
      }
    } catch {
      /* non-fatal: history just stays empty */
    } finally {
      setLoadingHistory(false);
    }
  }, [agency.id, traveller.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const pickImage = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Images only — PNG, JPG, GIF or WEBP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('That image is over 5MB. Please pick a smaller one.');
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const blob = await upload(`message-images/${Date.now()}-${safe}`, file, {
        access: 'public',
        handleUploadUrl: `/api/admin/agencies/${agency.id}/message-image`,
      });
      setImageUrl(blob.url);
    } catch {
      setError('That image could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canSend = body.trim().length > 0 && !sending && !uploading;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    setJustSent(false);
    try {
      const payload: Record<string, unknown> = {
        travellerId: traveller.id,
        body: body.trim(),
        priority,
      };
      if (title.trim()) payload.subject = title.trim();
      if (imageUrl) payload.imageUrl = imageUrl;
      if (linkUrl.trim()) {
        payload.link = linkLabel.trim()
          ? { url: linkUrl.trim(), label: linkLabel.trim() }
          : { url: linkUrl.trim() };
      }

      const res = await fetch(`/api/admin/agencies/${agency.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(prettyError(data?.error) || `Could not send (${res.status})`);
      }

      if (data.message) {
        setHistory((prev) => [data.message as SentMessage, ...prev]);
      }
      // Clear the form, keep the modal open so they can see it land / send another.
      setTitle('');
      setBody('');
      setLinkUrl('');
      setLinkLabel('');
      setImageUrl(null);
      setPriority('info');
      setJustSent(true);
      onSent?.();
      window.setTimeout(() => setJustSent(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(15,23,42,0.5)',
        animation: 'tg-fade-in 200ms ease-out',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <style>{`
        @keyframes tg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tg-modal-in { from { opacity: 0; transform: translateY(8px) scale(0.99); } to { opacity: 1; transform: none; } }
        @keyframes tg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: C.bgElevated, borderRadius: 16,
          boxShadow: '0 24px 48px rgba(15,23,42,0.25)',
          maxWidth: 560, width: '100%', maxHeight: '88vh',
          animation: 'tg-modal-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
              New message
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {traveller.name}
            </h2>
            <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}>
              Goes to their phone and the app&rsquo;s Notifications screen
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              height: 32, width: 32, borderRadius: 8, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', color: C.textSecondary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X style={{ height: 16, width: 16 }} strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>
              Title<span style={optStyle}>optional</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Your transfer is confirmed"
              style={inputStyle}
            />
          </div>

          {/* Message */}
          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={4}
              style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', minHeight: 96 }}
            />
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITY_OPTS.map((p) => {
                const active = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    style={{
                      flex: 1, height: 38, borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? p.color : C.border}`,
                      backgroundColor: active ? p.soft : C.bgElevated,
                      color: active ? p.color : C.textSecondary,
                      transition: 'all 120ms',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image */}
          <div>
            <label style={labelStyle}>
              Image<span style={optStyle}>optional</span>
            </label>
            <input ref={fileRef} type="file" accept={ALLOWED_TYPES.join(',')} onChange={onFile} style={{ display: 'none' }} />
            {imageUrl ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Attached" style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                <button
                  onClick={() => setImageUrl(null)}
                  aria-label="Remove image"
                  style={{
                    position: 'absolute', top: 8, right: 8, height: 30, width: 30, borderRadius: 8,
                    border: 'none', cursor: 'pointer', color: '#fff',
                    backgroundColor: 'rgba(15,23,42,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 style={{ height: 15, width: 15 }} strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickImage}
                disabled={uploading}
                style={{
                  width: '100%', height: 44, borderRadius: 8,
                  border: `1px dashed ${C.border}`, backgroundColor: C.bg,
                  color: C.textSecondary, fontSize: 13, fontWeight: 500,
                  cursor: uploading ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 style={{ height: 15, width: 15, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImagePlus style={{ height: 16, width: 16 }} strokeWidth={1.75} />
                    Add an image
                  </>
                )}
              </button>
            )}
          </div>

          {/* Link */}
          <div>
            <label style={labelStyle}>
              Link<span style={optStyle}>optional</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Link2 style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: 16, width: 16, color: C.textTertiary, pointerEvents: 'none' }} strokeWidth={1.75} />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  style={{ ...inputStyle, padding: '0 12px 0 36px' }}
                />
              </div>
              {linkUrl.trim() && (
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Button text (optional, e.g. View your itinerary)"
                  style={inputStyle}
                />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              backgroundColor: C.errorSoft, border: `1px solid ${C.error}`,
            }}>
              <AlertCircle style={{ height: 16, width: 16, color: C.error, flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
              <div style={{ fontSize: 13, color: C.text }}>{error}</div>
            </div>
          )}

          {/* History */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.textTertiary, fontWeight: 600, marginBottom: 10 }}>
              Sent to {traveller.name.split(' ')[0] || 'this traveller'}
            </div>
            {loadingHistory ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textTertiary, fontSize: 13, padding: '8px 0' }}>
                <Loader2 style={{ height: 14, width: 14, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} />
                Loading…
              </div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textTertiary, padding: '4px 0' }}>
                Nothing sent yet. Your first message will appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((m) => (
                  <HistoryItem key={m.id} m={m} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${C.border}`, backgroundColor: C.bg,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          {justSent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.success, fontWeight: 500 }}>
              <Check style={{ height: 15, width: 15 }} strokeWidth={2} />
              Sent
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '0 16px', height: 40, borderRadius: 8,
              backgroundColor: C.bgElevated, color: C.text, border: `1px solid ${C.border}`,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            Close
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0 18px', height: 40, borderRadius: 8, border: 'none',
              backgroundColor: canSend ? C.primary : C.textTertiary,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {sending ? (
              <Loader2 style={{ height: 15, width: 15, animation: 'tg-spin 1s linear infinite' }} strokeWidth={1.75} />
            ) : (
              <Send style={{ height: 15, width: 15 }} strokeWidth={1.75} />
            )}
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ m }: { m: SentMessage }) {
  const img = getImage(m.attachments || []);
  const link = getLink(m.attachments || []);
  const read = !!m.readAt;
  const pri = m.priority;
  const priColor = pri === 'urgent' ? C.error : pri === 'important' ? C.warning : C.textTertiary;

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: m.subject || m.body ? 6 : 0 }}>
        {(pri === 'urgent' || pri === 'important') && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            color: priColor, padding: '2px 6px', borderRadius: 4,
            backgroundColor: pri === 'urgent' ? C.errorSoft : C.warningSoft,
          }}>{pri}</span>
        )}
        <span style={{ fontSize: 12, color: C.textTertiary }}>{relTime(m.sentAt)}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 12, fontWeight: 500,
          color: read ? C.success : C.textTertiary,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {read ? <Check style={{ height: 13, width: 13 }} strokeWidth={2} /> : null}
          {read ? `Read ${relTime(m.readAt)}` : 'Delivered'}
        </span>
      </div>
      {m.subject && <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{m.subject}</div>}
      {m.body && <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>}
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt="" style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8, border: `1px solid ${C.border}` }} />
      )}
      {link && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
            color: C.accent, wordBreak: 'break-all',
          }}>
            <Link2 style={{ height: 13, width: 13, flexShrink: 0 }} strokeWidth={1.75} />
            {link.label || link.url}
          </span>
        </div>
      )}
    </div>
  );
}

function prettyError(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const map: Record<string, string> = {
    body_required: 'Please write a message.',
    traveller_not_found: 'That traveller could not be found for this agency.',
    invalid_image_url: 'The image link was not valid.',
    invalid_link_url: 'The link must start with http:// or https://',
    body_too_long: 'That message is too long.',
    unauthorised: 'Your session has expired. Please sign in again.',
  };
  return map[code] || null;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6,
};
const optStyle: React.CSSProperties = {
  color: C.textTertiary, marginLeft: 6, fontWeight: 400,
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, color: C.text,
  fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
