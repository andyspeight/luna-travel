'use client';

/**
 * /agency/messages — the agency's conversations with its travellers. Master
 * /detail: pick a traveller (or arrive with ?travellerId= from the Travellers
 * list), then read the thread and send a message. All scoped to the session's
 * agency by the API. Two-way ready: traveller replies render on the left.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, ChevronLeft, Send, AlertTriangle, ExternalLink } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn } from '../portal-chrome';

interface Traveller {
  id: string;
  name: string;
  destination: string | null;
  bookingRef: string | null;
  opened: boolean;
}
interface Attachment { type: 'link'; url: string; label?: string }
interface Msg {
  id: string;
  direction: string; // agency_to_traveller | traveller_to_agency
  subject: string | null;
  body: string;
  attachments: Attachment[];
  priority: string;
  sentAt: string;
  readAt: string | null;
}

function MessagesPage() {
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ranInit = useRef(false);

  useEffect(() => {
    if (ranInit.current) return;
    ranInit.current = true;
    const tid = new URLSearchParams(window.location.search).get('travellerId');
    if (tid) setSelectedId(tid);
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/travellers', { cache: 'no-store' });
      if (res.ok) setTravellers((await res.json()).travellers ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);

  const selected = travellers.find((t) => t.id === selectedId) || null;

  if (selectedId) {
    return (
      <Thread
        travellerId={selectedId}
        name={selected?.name || 'Traveller'}
        subtitle={selected ? [selected.destination, selected.bookingRef].filter(Boolean).join(' · ') : ''}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Messages</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
        Message a traveller directly in their app. They see it the moment they open their trip, and
        can reply back to you here.
      </p>

      {loadingList ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : travellers.length === 0 ? (
        <div style={{ marginTop: 18 }}>
          <Callout title="No travellers yet" icon={<MessageSquare size={16} />}>
            Send a traveller access first (from <strong>Send access</strong>). Once they&rsquo;ve opened
            their trip you can message them here.
          </Callout>
        </div>
      ) : (
        <div style={{ ...card, marginTop: 18, overflow: 'hidden' }}>
          {travellers.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}`, background: '#fff', border: 'none', borderTopStyle: 'solid', cursor: 'pointer' }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 999, flexShrink: 0, background: `${P.teal}1a`, color: P.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                {initials(t.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[t.destination, t.bookingRef].filter(Boolean).join(' · ') || 'Tap to open the conversation'}
                </div>
              </div>
              <MessageSquare size={16} color={P.ink3} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Thread({ travellerId, name, subtitle, onBack }: { travellerId: string; name: string; subtitle: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('info');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/messages?travellerId=${encodeURIComponent(travellerId)}`, { cache: 'no-store' });
      if (res.ok) setMessages((await res.json()).messages ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [travellerId]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/agency/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travellerId, body: body.trim(), priority }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(prettyError(data.error));
        return;
      }
      setMessages((prev) => [...prev, data.message as Msg]);
      setBody('');
      setPriority('info');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: P.ink2, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
        <ChevronLeft size={16} /> All travellers
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, background: `${P.teal}1a`, color: P.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
          {initials(name)}
        </span>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, color: P.ink, margin: 0 }}>{name}</h1>
          {subtitle && <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>

      {/* thread */}
      <div style={{ ...card, marginTop: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
        {loading ? (
          <p style={{ color: P.ink3, fontSize: 13, margin: 0 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: P.ink3, fontSize: 13, margin: 0, textAlign: 'center', padding: '20px 0' }}>
            No messages yet. Say hello — {name.split(' ')[0]} will see it in their app.
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* composer */}
      <div style={{ ...card, marginTop: 14, padding: 14 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={`Message ${name.split(' ')[0]}…`}
          style={{ width: '100%', border: `1px solid ${P.line}`, borderRadius: 11, padding: '11px 13px', fontSize: 14, color: P.ink, background: '#fff', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, outlineColor: P.teal }}
        />
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: P.ink2 }}>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ border: `1px solid ${P.line}`, borderRadius: 8, padding: '7px 9px', fontSize: 13, color: P.ink, background: '#fff' }}>
              <option value="info">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={send} disabled={sending || !body.trim()} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: sending || !body.trim() ? 0.6 : 1 }}>
            <Send size={15} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const mine = m.direction === 'agency_to_traveller';
  const urgent = m.priority === 'urgent';
  const important = m.priority === 'important';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '82%',
          background: mine ? P.navy : '#fff',
          color: mine ? '#fff' : P.ink,
          border: mine ? 'none' : `1px solid ${P.line}`,
          borderRadius: 14,
          borderBottomRightRadius: mine ? 4 : 14,
          borderBottomLeftRadius: mine ? 14 : 4,
          padding: '10px 13px',
          boxShadow: '0 2px 8px -6px rgba(15,23,42,0.25)',
        }}
      >
        {(urgent || important) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: urgent ? '#fecaca' : (mine ? '#fde68a' : '#b45309'), marginBottom: 4 }}>
            <AlertTriangle size={11} /> {urgent ? 'Urgent' : 'Important'}
          </div>
        )}
        {m.subject && <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>{m.subject}</div>}
        <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
        {m.attachments?.filter((a) => a.type === 'link').map((a, i) => (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, marginTop: 6, color: mine ? '#bae6fd' : P.tealDark, textDecoration: 'none' }}>
            {a.label || a.url} <ExternalLink size={11} />
          </a>
        ))}
        <div style={{ fontSize: 10.5, marginTop: 5, opacity: 0.7, textAlign: mine ? 'right' : 'left' }}>
          {fmtTime(m.sentAt)}{mine && m.readAt ? ' · Read' : ''}
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'T';
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function prettyError(code?: string): string {
  switch (code) {
    case 'body_required': return 'Please write a message.';
    case 'body_too_long': return 'That message is too long.';
    case 'agency_inactive': return 'This agency is no longer active — contact Luna Travel.';
    case 'traveller_not_found': return 'That traveller could not be found.';
    case 'unauthorised': return 'Your session has ended — reopen the portal from your Control dashboard.';
    default: return 'Could not send. Please try again.';
  }
}

export default function AgencyMessagesPage() {
  return (
    <AgencyShell active="messages">
      <MessagesPage />
    </AgencyShell>
  );
}
