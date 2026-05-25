'use client';

/**
 * /admin/heroes — Destination hero image manager.
 *
 * A grid of every destination (from the static roster generated off the
 * Destination Content base). Each destination has two slots:
 *   - Portrait  (cover splash)   target 1080 × 1920  (9:16)
 *   - Landscape (dashboard hero) target 1600 × 900   (16:9)
 *
 * Flow: pick a file → browser resizes + converts to webp via canvas →
 * uploads the webp to /api/admin/heroes → slot shows the live image.
 * No server-side image library, no native deps.
 *
 * Tracking: a header shows how many of the (roster × 2) slots are filled,
 * and each card shows tick / empty state per slot. Search filters by name
 * or code; a "Show only missing" toggle helps you work through the backlog.
 *
 * Styling matches the admin shell (inline styles, Inter, light/dark via the
 * same localStorage key 'tg-admin-theme').
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ImageIcon, Check, Search, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { HERO_DESTINATIONS } from '@/data/hero-destinations';

type Variant = 'portrait' | 'landscape';

interface VariantSpec {
  key: Variant;
  label: string;
  // Target output dimensions for the webp we store.
  w: number;
  h: number;
  // Aspect ratio for validation/cropping (w/h).
  ratioLabel: string;
}

const SPECS: VariantSpec[] = [
  { key: 'portrait', label: 'Portrait (cover)', w: 1080, h: 1920, ratioLabel: '9:16' },
  { key: 'landscape', label: 'Landscape (hero)', w: 1600, h: 900, ratioLabel: '16:9' },
];

const WEBP_QUALITY = 0.9;

// ---- theme (mirrors admin/layout.tsx) ----
const LIGHT = {
  bg: '#F8FAFC', bgElevated: '#FFFFFF', bgTertiary: '#F1F5F9', border: '#E2E8F0',
  text: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
  primary: '#1B2B5B', accent: '#00B4D8', success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
};
const DARK = {
  bg: '#0F172A', bgElevated: '#1E293B', bgTertiary: '#334155', border: '#334155',
  text: '#F8FAFC', textSecondary: '#CBD5E1', textTertiary: '#64748B',
  primary: '#1B2B5B', accent: '#00B4D8', success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
};

/**
 * Resize + convert an image File to a webp Blob at target dimensions using a
 * canvas. Centre-crops to the target aspect ratio so we never distort and
 * never produce an out-of-spec ratio (the bug class that got us rejected by
 * Instagram before). Returns a webp Blob.
 */
async function toWebp(file: File, targetW: number, targetH: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const srcRatio = bitmap.width / bitmap.height;
  const dstRatio = targetW / targetH;

  // Work out the source crop rectangle (centre crop to target ratio).
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (srcRatio > dstRatio) {
    // Source too wide — crop width.
    sw = Math.round(bitmap.height * dstRatio);
    sx = Math.round((bitmap.width - sw) / 2);
  } else if (srcRatio < dstRatio) {
    // Source too tall — crop height.
    sh = Math.round(bitmap.width / dstRatio);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetW, targetH);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('webp conversion failed'))),
      'image/webp',
      WEBP_QUALITY,
    );
  });
}

export default function HeroImagesPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [heroes, setHeroes] = useState<Record<string, { url: string; updatedAt: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = localStorage.getItem('tg-admin-theme') as 'light' | 'dark' | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(stored ?? (systemDark ? 'dark' : 'light'));
  }, []);

  const c = theme === 'dark' ? DARK : LIGHT;

  const loadHeroes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/heroes', { credentials: 'include' });
      const data = await res.json();
      setHeroes(data.heroes || {});
    } catch {
      setHeroes({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHeroes(); }, [loadHeroes]);

  const totalSlots = HERO_DESTINATIONS.length * SPECS.length;
  const filledSlots = Object.keys(heroes).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HERO_DESTINATIONS.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !d.code.toLowerCase().includes(q)) return false;
      if (onlyMissing) {
        const hasAll = SPECS.every((s) => heroes[`${d.code}-${s.key}`]);
        if (hasAll) return false;
      }
      return true;
    });
  }, [query, onlyMissing, heroes]);

  const handleFile = async (code: string, spec: VariantSpec, file: File) => {
    const slotKey = `${code}-${spec.key}`;
    setErrors((e) => ({ ...e, [slotKey]: '' }));
    setBusy((b) => ({ ...b, [slotKey]: true }));
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose an image file');
      }
      const webp = await toWebp(file, spec.w, spec.h);
      const fd = new FormData();
      fd.append('file', new File([webp], `${code}-${spec.key}.webp`, { type: 'image/webp' }));
      fd.append('code', code);
      fd.append('variant', spec.key);

      const res = await fetch('/api/admin/heroes', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');

      // Cache-bust the preview so the new image shows immediately.
      setHeroes((h) => ({ ...h, [slotKey]: { url: `${data.url}?t=${Date.now()}`, updatedAt: new Date().toISOString() } }));
    } catch (err) {
      setErrors((e) => ({ ...e, [slotKey]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setBusy((b) => ({ ...b, [slotKey]: false }));
    }
  };

  const handleDelete = async (code: string, spec: VariantSpec) => {
    const slotKey = `${code}-${spec.key}`;
    if (!confirm(`Remove the ${spec.label} image for this destination?`)) return;
    setBusy((b) => ({ ...b, [slotKey]: true }));
    try {
      const res = await fetch(`/api/admin/heroes?code=${code}&variant=${spec.key}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setHeroes((h) => { const n = { ...h }; delete n[slotKey]; return n; });
    } catch (err) {
      setErrors((e) => ({ ...e, [slotKey]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setBusy((b) => ({ ...b, [slotKey]: false }));
    }
  };

  return (
    <div style={{ padding: '24px 16px 80px', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, -apple-system, sans-serif', color: c.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ImageIcon size={20} style={{ color: c.accent }} /> Hero images
          </h1>
          <p style={{ fontSize: 13, color: c.textSecondary, margin: '6px 0 0' }}>
            Upload portrait + landscape hero photography per destination. Images are auto-converted to webp and resized on upload.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: c.accent }}>{filledSlots}<span style={{ fontSize: 14, color: c.textTertiary, fontWeight: 500 }}> / {totalSlots}</span></div>
          <div style={{ fontSize: 11, color: c.textTertiary }}>slots filled</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: c.bgTertiary, overflow: 'hidden', margin: '12px 0 20px' }}>
        <div style={{ height: '100%', width: `${totalSlots ? (filledSlots / totalSlots) * 100 : 0}%`, background: c.accent, transition: 'width .3s' }} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: c.textTertiary }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination or code…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgElevated, color: c.text, fontSize: 14, outline: 'none' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: c.textSecondary, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Show only incomplete
        </label>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: c.textSecondary, fontSize: 14, padding: 40 }}>
          <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading hero images…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((d) => (
            <div key={d.code} style={{ background: c.bgElevated, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: c.textTertiary, fontWeight: 600, letterSpacing: 0.5, background: c.bgTertiary, padding: '2px 7px', borderRadius: 5 }}>{d.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {SPECS.map((spec) => {
                  const slotKey = `${d.code}-${spec.key}`;
                  const hero = heroes[slotKey];
                  const isBusy = busy[slotKey];
                  const err = errors[slotKey];
                  const isPortrait = spec.key === 'portrait';
                  return (
                    <div key={spec.key} style={{ flex: 1 }}>
                      <SlotBox
                        c={c}
                        hero={hero?.url}
                        busy={!!isBusy}
                        portrait={isPortrait}
                        ratioLabel={spec.ratioLabel}
                        onPick={(file) => handleFile(d.code, spec, file)}
                        onDelete={() => handleDelete(d.code, spec)}
                      />
                      <div style={{ fontSize: 11, color: hero ? c.success : c.textTertiary, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {hero ? <><Check size={12} /> {spec.label}</> : spec.label}
                      </div>
                      {err && (
                        <div style={{ fontSize: 11, color: c.danger, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {err}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SlotBox({
  c, hero, busy, portrait, ratioLabel, onPick, onDelete,
}: {
  c: typeof LIGHT;
  hero?: string;
  busy: boolean;
  portrait: boolean;
  ratioLabel: string;
  onPick: (file: File) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const aspect = portrait ? '9 / 16' : '16 / 9';

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      style={{
        position: 'relative',
        aspectRatio: aspect,
        borderRadius: 8,
        border: `1.5px dashed ${hero ? 'transparent' : c.border}`,
        background: hero ? `center/cover no-repeat url("${hero}")` : c.bgTertiary,
        cursor: busy ? 'wait' : 'pointer',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      {busy && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      {!hero && !busy && (
        <div style={{ textAlign: 'center', color: c.textTertiary, fontSize: 11, padding: 8 }}>
          <ImageIcon size={18} style={{ opacity: 0.6 }} />
          <div style={{ marginTop: 4 }}>{ratioLabel}</div>
        </div>
      )}
      {hero && !busy && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Remove"
          style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
