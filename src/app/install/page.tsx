'use client';

import { PageEnter } from '@/components/page-enter';
import { IconShare } from '@/components/icons';

/**
 * /install — booth-display page with a big QR code pointing at /welcome.
 *
 * Designed to be pulled up on an iPad or laptop at the booth and pointed at
 * prospects. They scan, the welcome screen opens on their phone, they
 * onboard with DEMO81297 / Swan, and they have Luna Travel installed to
 * their home screen in under a minute.
 *
 * Tab bar hides naturally because this is its own route, not under /.
 * Background uses the brand gradient to feel like a marketing surface, not
 * a regular app screen.
 */
export default function InstallPage() {
  return (
    <PageEnter>
      <main
        className="fixed inset-0 flex flex-col text-white overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 75% 5%, rgba(0,180,216,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 15% 95%, rgba(245,158,11,0.15), transparent 60%), linear-gradient(160deg, #0F172A 0%, #1B2B5B 45%, #082F49 100%)',
        }}
      >
        {/* Header */}
        <header className="px-8 pt-10 text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center shadow-md">
              L
            </span>
            <span className="text-base font-semibold tracking-tight">Luna Travel</span>
          </div>
          <p className="text-xs text-white/55 uppercase tracking-[0.18em]">
            TravelTech Show · Stand TBC
          </p>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-4">
          <h1 className="font-serif text-[44px] leading-none tracking-tight text-center max-w-[480px] mb-3">
            Try it on <em className="text-teal-light">your phone</em>.
          </h1>
          <p className="text-base text-white/70 text-center max-w-[420px] leading-relaxed mb-10">
            Scan the code with your camera. Add to home screen.
            It looks and feels exactly like an app.
          </p>

          {/* QR card */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/install-qr.png"
              alt="Scan to install Luna Travel"
              width={260}
              height={260}
              className="block"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Demo creds hint */}
          <div className="mt-8 text-center">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5">
              Demo credentials
            </div>
            <div className="text-sm font-semibold tracking-wide">
              <span className="text-white tabular">DEMO81297</span>
              <span className="text-white/40 mx-2">·</span>
              <span className="text-white">Swan</span>
            </div>
          </div>
        </div>

        {/* Footer instruction strip */}
        <footer className="px-8 pb-8 pt-4">
          <div className="grid grid-cols-3 gap-3 max-w-[560px] mx-auto">
            <Step n={1} label="Scan with your camera" />
            <Step n={2} label="Tap the link that appears" />
            <Step n={3} label="Add to home screen" icon={<IconShare size={14} />} />
          </div>
          <p className="text-center text-[10px] text-white/40 mt-5 tracking-[0.06em]">
            travelgenix.io · The post-booking trip experience for SME travel agents
          </p>
        </footer>
      </main>
    </PageEnter>
  );
}

function Step({ n, label, icon }: { n: number; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <span className="w-7 h-7 rounded-full bg-white/15 text-white text-xs font-semibold flex items-center justify-center backdrop-blur">
        {icon ?? n}
      </span>
      <span className="text-[11px] text-white/70 leading-tight">{label}</span>
    </div>
  );
}
