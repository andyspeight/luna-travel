'use client';

/**
 * /agency/content — "Trip pages": the agency edits the content pages
 * travellers see in the app.
 *
 *   Before you travel  — accordion sections (also editable as an agency-wide
 *                        DEFAULT that applies to every booking without its own)
 *   Itinerary          — accordion sections, per booking
 *   Find your way      — map places (search via the geocode proxy, or manual
 *                        coordinates), per booking
 *
 * Scope picker at the top: Agency default, one of the agency's travellers'
 * bookings, or a manually typed booking reference. Each page saves
 * independently via PUT /api/agency/content.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, Plus, Trash2, ChevronUp, ChevronDown, Search, MapPin, Check,
} from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card, primaryBtn } from '../portal-chrome';
import {
  PLACE_CATEGORIES,
  type AccordionItem,
  type PlaceItem,
  type TripContentPage,
  type TripContentPages,
} from '@/lib/trip-content';

interface TripOption {
  bookingRef: string;
  label: string;
}

interface GeoResult {
  name: string;
  lat: number;
  lng: number;
}

const PAGE_TABS: { key: TripContentPage; label: string; hint: string }[] = [
  { key: 'before-you-travel', label: 'Before you travel', hint: 'Visas, packing, check-in — an accordion of advice sections.' },
  { key: 'itinerary', label: 'Itinerary', hint: 'The trip day by day, in your own words — an accordion of sections.' },
  { key: 'find-your-way', label: 'Find your way around', hint: 'Places worth knowing, shown as pins on a street map with directions.' },
];

const EMPTY: TripContentPages = { 'before-you-travel': [], itinerary: [], 'find-your-way': [] };

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function ContentPage() {
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [scope, setScope] = useState<string>(''); // '' = agency default
  const [manualRef, setManualRef] = useState('');
  const [tab, setTab] = useState<TripContentPage>('before-you-travel');
  const [pages, setPages] = useState<TripContentPages>(EMPTY);
  const [defaultBytCount, setDefaultBytCount] = useState(0);
  const [dirty, setDirty] = useState<Record<TripContentPage, boolean>>({ 'before-you-travel': false, itinerary: false, 'find-your-way': false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState('');

  // Trip options come from the travellers list — every booking the agency has
  // sent access for. A manual ref covers bookings not yet invited.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/agency/travellers', { cache: 'no-store' });
        if (!res.ok) return;
        const list = ((await res.json()).travellers ?? []) as Array<{ bookingRef: string | null; name: string | null; destination: string | null }>;
        const seen = new Set<string>();
        const opts: TripOption[] = [];
        for (const t of list) {
          const ref = (t.bookingRef || '').trim();
          if (!ref || seen.has(ref)) continue;
          seen.add(ref);
          const bits = [ref, t.name, t.destination].filter(Boolean);
          opts.push({ bookingRef: ref, label: bits.join(' — ') });
        }
        setTrips(opts);
      } catch {
        /* picker just stays short */
      }
    })();
  }, []);

  const loadScope = useCallback(async (ref: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/agency/content${ref ? `?bookingRef=${encodeURIComponent(ref)}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = await res.json();
      setPages(json.pages ?? EMPTY);
      setDefaultBytCount(Array.isArray(json.defaultBeforeYouTravel) ? json.defaultBeforeYouTravel.length : 0);
      setDirty({ 'before-you-travel': false, itinerary: false, 'find-your-way': false });
    } catch {
      setError('Could not load content — try again.');
      setPages(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScope(scope);
  }, [scope, loadScope]);

  // Default scope only carries Before you travel.
  useEffect(() => {
    if (!scope && tab !== 'before-you-travel') setTab('before-you-travel');
  }, [scope, tab]);

  const setPageItems = (page: TripContentPage, items: AccordionItem[] | PlaceItem[]) => {
    setPages((p) => ({ ...p, [page]: items }));
    setDirty((d) => ({ ...d, [page]: true }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/agency/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef: scope, page: tab, items: pages[tab] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Save failed');
      }
      setDirty((d) => ({ ...d, [tab]: false }));
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const activeHint = PAGE_TABS.find((p) => p.key === tab)?.hint ?? '';
  const scopeLabel = scope ? scope : 'Agency default';

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Trip pages</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 560 }}>
        Content pages travellers see in their app: what to know before they go, their itinerary in
        your words, and the places that matter on a map. Pages appear on the traveller&rsquo;s home
        screen as soon as they have content.
      </p>

      {/* Scope picker */}
      <div style={{ ...card, marginTop: 18, padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="tp-scope" style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Editing</label>
        <select
          id="tp-scope"
          value={trips.some((t) => t.bookingRef === scope) || scope === '' ? scope : '__manual'}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== '__manual') setScope(v);
          }}
          style={{ flex: '1 1 260px', minWidth: 220, padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13.5, color: P.ink, background: '#fff' }}
        >
          <option value="">Agency default (Before you travel)</option>
          {trips.map((t) => (
            <option key={t.bookingRef} value={t.bookingRef}>{t.label}</option>
          ))}
          {scope && !trips.some((t) => t.bookingRef === scope) && (
            <option value="__manual">{scope} (entered manually)</option>
          )}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = manualRef.trim().toUpperCase();
            if (v) {
              setScope(v);
              setManualRef('');
            }
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="…or booking reference"
            style={{ width: 170, padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13.5 }}
          />
          <button type="submit" style={{ ...primaryBtn, padding: '9px 14px', borderRadius: 10, fontSize: 13, border: 'none', cursor: 'pointer' }}>
            Open
          </button>
        </form>
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {PAGE_TABS.map((p) => {
          const disabled = !scope && p.key !== 'before-you-travel';
          const active = tab === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              onClick={() => setTab(p.key)}
              style={{
                padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? P.navy : '#fff', color: active ? '#fff' : disabled ? P.ink3 : P.ink,
                border: `1px solid ${active ? P.navy : P.line}`, opacity: disabled ? 0.55 : 1,
              }}
            >
              {p.label}
              {dirty[p.key] && <span style={{ marginLeft: 6, color: active ? P.tealLight : P.tealDark }}>•</span>}
            </button>
          );
        })}
      </div>
      <p style={{ color: P.ink3, fontSize: 12.5, marginTop: 8 }}>
        {activeHint}
        {!scope && ' Saved as your agency default — used for every booking without its own version.'}
      </p>

      {scope && tab === 'before-you-travel' && pages['before-you-travel'].length === 0 && defaultBytCount > 0 && (
        <div style={{ marginTop: 10 }}>
          <Callout title="Using your agency default" icon={<BookOpen size={16} />}>
            This booking has no &ldquo;Before you travel&rdquo; of its own yet, so travellers currently see
            your agency default ({defaultBytCount} section{defaultBytCount === 1 ? '' : 's'}). Add
            sections below to override it for this booking only.
          </Callout>
        </div>
      )}

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : tab === 'find-your-way' ? (
        <PlacesEditor
          places={pages['find-your-way']}
          onChange={(items) => setPageItems('find-your-way', items)}
        />
      ) : (
        <AccordionEditor
          items={pages[tab]}
          onChange={(items) => setPageItems(tab, items)}
        />
      )}

      {/* Save bar */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty[tab]}
            style={{
              ...primaryBtn, padding: '11px 22px', borderRadius: 12, fontSize: 14, border: 'none',
              cursor: saving || !dirty[tab] ? 'default' : 'pointer', opacity: saving || !dirty[tab] ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {savedTick ? <Check size={15} /> : null}
            {saving ? 'Saving…' : savedTick ? 'Saved' : `Save ${scopeLabel === 'Agency default' ? 'default' : scopeLabel}`}
          </button>
          {dirty[tab] && !saving && (
            <span style={{ color: P.ink3, fontSize: 12.5 }}>Unsaved changes</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────── Accordion editor (Before you travel / Itinerary) ───────────

function AccordionEditor({ items, onChange }: { items: AccordionItem[]; onChange: (items: AccordionItem[]) => void }) {
  const update = (idx: number, patch: Partial<AccordionItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div style={{ marginTop: 16 }}>
      {items.length === 0 && (
        <Callout title="No sections yet" icon={<BookOpen size={16} />}>
          Add your first section — each one becomes a tappable row travellers expand to read.
        </Callout>
      )}
      {items.map((it, idx) => (
        <div key={it.id} style={{ ...card, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: P.ink3, width: 22 }}>{idx + 1}.</span>
            <input
              value={it.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder="Section title — e.g. Passports & visas"
              maxLength={160}
              style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 14, fontWeight: 600, color: P.ink }}
            />
            <RowBtn title="Move up" onClick={() => move(idx, -1)} disabled={idx === 0}><ChevronUp size={15} /></RowBtn>
            <RowBtn title="Move down" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}><ChevronDown size={15} /></RowBtn>
            <RowBtn title="Remove" onClick={() => onChange(items.filter((_, i) => i !== idx))} danger><Trash2 size={15} /></RowBtn>
          </div>
          <textarea
            value={it.body}
            onChange={(e) => update(idx, { body: e.target.value })}
            placeholder="The detail travellers see when they expand this section. Line breaks are kept."
            maxLength={6000}
            rows={4}
            style={{ width: '100%', marginTop: 10, padding: '10px 11px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13.5, lineHeight: 1.55, color: P.ink2, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { id: newId(), title: '', body: '' }])}
        style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 12, border: `1.5px dashed ${P.line}`, background: '#fff', color: P.ink, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
      >
        <Plus size={15} /> Add section
      </button>
    </div>
  );
}

// ─────────── Places editor (Find your way around) ───────────

function PlacesEditor({ places, onChange }: { places: PlaceItem[]; onChange: (items: PlaceItem[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');

  const search = async () => {
    const query = q.trim();
    if (query.length < 2) return;
    setSearching(true);
    setSearchNote('');
    setResults([]);
    try {
      const res = await fetch(`/api/agency/geocode?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const json = await res.json();
      const rs = (json.results ?? []) as GeoResult[];
      setResults(rs);
      if (rs.length === 0) setSearchNote('No matches — try a fuller name, or add the place manually below.');
    } catch {
      setSearchNote('Search unavailable — add the place manually below.');
    } finally {
      setSearching(false);
    }
  };

  const addFromResult = (r: GeoResult) => {
    const shortName = r.name.split(',')[0].trim().slice(0, 120) || r.name.slice(0, 120);
    onChange([...places, { id: newId(), name: shortName, description: '', lat: r.lat, lng: r.lng, category: 'other' }]);
    setResults([]);
    setQ('');
  };

  const update = (idx: number, patch: Partial<PlaceItem>) => {
    onChange(places.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= places.length) return;
    const next = places.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const numInput = (v: number, set: (n: number) => void, ph: string) => (
    <input
      value={Number.isFinite(v) ? String(v) : ''}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) set(n);
      }}
      placeholder={ph}
      inputMode="decimal"
      style={{ width: 110, padding: '8px 9px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13 }}
    />
  );

  return (
    <div style={{ marginTop: 16 }}>
      {/* Search-to-add */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 8 }}>Add a place</div>
        <form onSubmit={(e) => { e.preventDefault(); void search(); }} style={{ display: 'flex', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — e.g. Sheikh Zayed Grand Mosque"
            style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13.5 }}
          />
          <button type="submit" disabled={searching} style={{ ...primaryBtn, padding: '9px 14px', borderRadius: 10, fontSize: 13, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: searching ? 0.6 : 1 }}>
            <Search size={14} /> {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {results.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addFromResult(r)}
                style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, border: `1px solid ${P.line}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: P.ink2, display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <MapPin size={14} style={{ flexShrink: 0, color: P.tealDark }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
        {searchNote && <p style={{ color: P.ink3, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{searchNote}</p>}
        <button
          type="button"
          onClick={() => onChange([...places, { id: newId(), name: '', description: '', lat: 0, lng: 0, category: 'other' }])}
          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: `1.5px dashed ${P.line}`, background: '#fff', color: P.ink, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={14} /> Add manually (paste coordinates)
        </button>
      </div>

      {places.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <Callout title="No places yet" icon={<MapPin size={16} />}>
            Search for hotels, beaches, restaurants and sights — each becomes a pin on the
            traveller&rsquo;s map with one-tap directions.
          </Callout>
        </div>
      )}

      {places.map((p, idx) => (
        <div key={p.id} style={{ ...card, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: P.ink3, width: 22 }}>{idx + 1}.</span>
            <input
              value={p.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Place name"
              maxLength={120}
              style={{ flex: '1 1 200px', padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 14, fontWeight: 600, color: P.ink }}
            />
            <select
              value={p.category}
              onChange={(e) => update(idx, { category: e.target.value as PlaceItem['category'] })}
              style={{ padding: '9px 10px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13, background: '#fff' }}
            >
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === 'other' ? 'place' : c}</option>
              ))}
            </select>
            <RowBtn title="Move up" onClick={() => move(idx, -1)} disabled={idx === 0}><ChevronUp size={15} /></RowBtn>
            <RowBtn title="Move down" onClick={() => move(idx, 1)} disabled={idx === places.length - 1}><ChevronDown size={15} /></RowBtn>
            <RowBtn title="Remove" onClick={() => onChange(places.filter((_, i) => i !== idx))} danger><Trash2 size={15} /></RowBtn>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: P.ink3, fontWeight: 700 }}>Lat / Lng</span>
            {numInput(p.lat, (n) => update(idx, { lat: n }), 'Latitude')}
            {numInput(p.lng, (n) => update(idx, { lng: n }), 'Longitude')}
            {(p.lat !== 0 || p.lng !== 0) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12.5, color: P.tealDark, fontWeight: 700 }}
              >
                Check on map ↗
              </a>
            )}
          </div>
          <textarea
            value={p.description}
            onChange={(e) => update(idx, { description: e.target.value })}
            placeholder="Why it matters — a line or two travellers see under the name."
            maxLength={1000}
            rows={2}
            style={{ width: '100%', marginTop: 10, padding: '10px 11px', borderRadius: 10, border: `1px solid ${P.line}`, fontSize: 13.5, lineHeight: 1.55, color: P.ink2, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      ))}
    </div>
  );
}

function RowBtn({ children, onClick, title, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.line}`, background: '#fff',
        color: danger ? '#b91c1c' : P.ink2, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function AgencyContentPage() {
  return (
    <AgencyShell active="content">
      <ContentPage />
    </AgencyShell>
  );
}
