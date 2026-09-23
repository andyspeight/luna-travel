'use client';

import { IconWifiOff } from '@/components/icons';

export default function OfflinePage() {
  return (
    <main className="px-6 pt-16 text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 text-ink-2">
        <IconWifiOff size={30} />
      </span>
      <h1 className="font-serif text-3xl text-ink mb-2">You&rsquo;re offline</h1>
      <p className="text-sm text-ink-2 leading-relaxed max-w-xs mx-auto">
        Your trip details are saved on this device. Pages you&rsquo;ve already
        opened will keep working — others will refresh when you&rsquo;re back online.
      </p>
    </main>
  );
}
