'use client';

/**
 * A high-fidelity, live-reskinning preview of the traveller app, for the agency
 * branding screen. Everything tinted by `primary`/`accent` re-themes instantly
 * as the agency edits, so the phone is the "wow" — a real-looking trip, not a
 * skeleton. Pure CSS/SVG: no external images (works under the app's strict CSP).
 */

import { Plane, Bell, BedDouble, FileText, Home, CalendarDays, MessageCircle, User, Wifi } from 'lucide-react';
import { SERIF } from './portal-chrome';

export function PhonePreview({
  name,
  primary,
  accent,
  welcome,
  logoUrl,
}: {
  name: string;
  primary: string;
  accent: string;
  welcome: string;
  logoUrl: string;
}) {
  const cover = `radial-gradient(85% 65% at 78% 12%, rgba(255,255,255,0.34), transparent 55%), linear-gradient(158deg, ${accent} -12%, ${primary} 72%)`;

  return (
    <div className="portal-float" style={{ position: 'relative', width: 258 }}>
      {/* side buttons */}
      <span style={sideBtn(96, 'l')} />
      <span style={sideBtn(140, 'l')} />
      <span style={sideBtn(120, 'r', 46)} />

      {/* device frame */}
      <div
        style={{
          borderRadius: 50,
          padding: 11,
          background: 'linear-gradient(155deg,#28324f,#0b1430 60%)',
          boxShadow: '0 40px 70px -28px rgba(11,20,48,0.75), inset 0 1px 1px rgba(255,255,255,0.14)',
        }}
      >
        <div style={{ position: 'relative', borderRadius: 40, overflow: 'hidden', background: '#eef2f8' }}>
          {/* dynamic island */}
          <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 86, height: 22, borderRadius: 14, background: '#05070f', zIndex: 5 }} />

          {/* cover / hero */}
          <div style={{ background: cover, padding: '13px 15px 20px', color: '#fff', position: 'relative' }}>
            {/* status bar */}
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700, height: 16, opacity: 0.95 }}>
              <span>9:41</span>
              <span style={{ flex: 1 }} />
              <SignalBars />
              <Wifi size={11} style={{ marginLeft: 5 }} />
              <Battery />
            </div>

            {/* identity row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.9)', color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</div>
              <span style={{ flex: 1 }} />
              <Bell size={15} style={{ opacity: 0.9 }} />
            </div>

            {/* destination + countdown */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', opacity: 0.85 }}>YOUR TRIP</div>
              <div style={{ fontFamily: SERIF, fontSize: 27, lineHeight: 1.05, marginTop: 2 }}>Maldives</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 600 }}>
                <Plane size={12} /> 12 days until you fly
              </div>
            </div>
          </div>

          {/* content sheet (overlaps cover) */}
          <div style={{ marginTop: -14, borderRadius: '18px 18px 0 0', background: '#f4f7fb', padding: '15px 13px 12px', position: 'relative' }}>
            {welcome && (
              <div style={{ background: '#fff', borderRadius: 11, padding: '9px 11px', fontSize: 10.5, color: '#475569', lineHeight: 1.45, boxShadow: '0 1px 4px rgba(15,23,42,0.05)', marginBottom: 11 }}>
                {welcome}
              </div>
            )}

            {/* wallet quick tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
              {[
                { icon: <Plane size={14} />, label: 'Flights' },
                { icon: <BedDouble size={14} />, label: 'Hotel' },
                { icon: <FileText size={14} />, label: 'Docs' },
              ].map((t) => (
                <div key={t.label} style={{ background: '#fff', borderRadius: 11, padding: '10px 6px', textAlign: 'center', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
                  <div style={{ width: 26, height: 26, margin: '0 auto', borderRadius: 8, background: hexA(accent, 0.14), color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', marginTop: 5 }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* flight card */}
            <div style={{ background: '#fff', borderRadius: 13, padding: 12, marginTop: 11, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>British Airways</span>
                <span style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 700, color: accent, background: hexA(accent, 0.14), borderRadius: 999, padding: '2px 7px' }}>On time</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <Airport code="LHR" time="10:25" />
                <div style={{ flex: 1, position: 'relative', height: 1, background: '#e2e8f0' }}>
                  <Plane size={12} color={primary} style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', background: '#fff', padding: '0 2px' }} />
                </div>
                <Airport code="MLE" time="23:40" right />
              </div>
            </div>

            {/* hotel card */}
            <div style={{ background: '#fff', borderRadius: 13, padding: 11, marginTop: 9, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: hexA(primary, 0.1), color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BedDouble size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Kuramathi Island Resort</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>3–10 Nov · 7 nights · All inclusive</div>
              </div>
            </div>
          </div>

          {/* tab bar */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '9px 0 13px', background: '#fff', borderTop: '1px solid #eef1f6' }}>
            {[
              { icon: Home, on: true },
              { icon: CalendarDays },
              { icon: FileText },
              { icon: MessageCircle },
              { icon: User },
            ].map((t, i) => {
              const Icon = t.icon;
              return <Icon key={i} size={17} color={t.on ? primary : '#c2ccda'} strokeWidth={t.on ? 2.4 : 2} />;
            })}
          </div>

          {/* screen gloss */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(125deg, rgba(255,255,255,0.16) 0%, transparent 32%)', borderRadius: 40 }} />
        </div>
      </div>
    </div>
  );
}

function Airport({ code, time, right }: { code: string; time: string; right?: boolean }) {
  return (
    <div style={{ textAlign: right ? 'right' : 'left' }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>{code}</div>
      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{time}</div>
    </div>
  );
}

function SignalBars() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5, height: 10 }}>
      {[4, 6, 8, 10].map((h, i) => (
        <span key={i} style={{ width: 2.5, height: h, borderRadius: 1, background: '#fff', opacity: 0.95 }} />
      ))}
    </span>
  );
}

function Battery() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 5 }}>
      <span style={{ width: 17, height: 9, borderRadius: 2.5, border: '1px solid rgba(255,255,255,0.85)', padding: 1.5, display: 'inline-flex' }}>
        <span style={{ flex: 1, background: '#fff', borderRadius: 1 }} />
      </span>
      <span style={{ width: 1.5, height: 4, background: 'rgba(255,255,255,0.85)', borderRadius: 1, marginLeft: 0.5 }} />
    </span>
  );
}

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function sideBtn(top: number, side: 'l' | 'r', height = 30): React.CSSProperties {
  return {
    position: 'absolute',
    top,
    [side === 'l' ? 'left' : 'right']: -2,
    width: 3,
    height,
    borderRadius: 3,
    background: 'linear-gradient(#3a4666,#1a2340)',
    zIndex: 0,
  } as React.CSSProperties;
}
