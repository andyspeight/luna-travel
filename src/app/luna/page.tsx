'use client';

export default function LunaPage() {
  return (
    <main className="px-5 pt-4">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Luna</h1>
        <p className="text-sm text-ink-2 mt-1">Your trip concierge — lands in sprint 4.</p>
      </header>
      <section className="mt-4 p-4 rounded-2xl bg-surface border border-line-light text-sm text-ink-2 leading-relaxed">
        Luna Chat with full trip context, pill prompts, and pre-canned answers
        ships in sprint 4. The booking context summary already redacts names,
        emails, and prices before any AI call.
      </section>
    </main>
  );
}
