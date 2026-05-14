'use client';

export default function OfflinePage() {
  return (
    <main className="px-6 pt-16 text-center">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="font-serif text-3xl text-ink mb-2">You&rsquo;re offline</h1>
      <p className="text-sm text-ink-2 leading-relaxed max-w-xs mx-auto">
        Your trip details are saved on this device. Pages you&rsquo;ve already
        opened will keep working — others will refresh when you&rsquo;re back online.
      </p>
    </main>
  );
}
