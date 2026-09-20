import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { classifyStatus, messageFor, extractBookingFromPdf } from '@/lib/booking-extract';

/**
 * These exist because of a specific, expensive failure.
 *
 * The Anthropic backend defaulted to a model id that does not exist, so every
 * fallback extraction 404'd — and the admin was told "Could not read this PDF
 * automatically. Try a clearer file." Blaming the document for a settings
 * problem is how a broken feature survives for months: you try another PDF,
 * conclude it is rubbish, and never raise it.
 */

describe('classifyStatus', () => {
  it('calls a rejected key a configuration problem', () => {
    expect(classifyStatus(401)).toBe('config');
    expect(classifyStatus(403)).toBe('config');
  });

  // THE one. A real key pointed at a model that does not exist.
  it('calls an unknown model a configuration problem', () => {
    expect(classifyStatus(404)).toBe('config');
  });

  it('sees through a 400 that is really about the model', () => {
    expect(classifyStatus(400, 'model: claude-sonnet-4-6 not found')).toBe('config');
    expect(classifyStatus(400, 'Invalid model name')).toBe('config');
  });

  it('treats busy and broken as worth retrying', () => {
    expect(classifyStatus(429)).toBe('transient');
    expect(classifyStatus(500)).toBe('transient');
    expect(classifyStatus(529)).toBe('transient');
  });

  it('only blames the document when it is genuinely about the document', () => {
    expect(classifyStatus(400, 'could not process the attached file')).toBe('document');
    expect(classifyStatus(413)).toBe('document');
  });
});

describe('messageFor', () => {
  it('tells an admin plainly that a config failure is not their file', () => {
    const m = messageFor('config');
    expect(m).toMatch(/misconfigured/i);
    // The sentence that saves somebody twenty minutes of trying other PDFs.
    expect(m).toMatch(/not a problem with your file|a different PDF will not help/i);
    expect(m).toMatch(/administrator/i);
  });

  it('suggests trying again only when trying again could work', () => {
    expect(messageFor('transient')).toMatch(/try again/i);
    expect(messageFor('config')).not.toMatch(/try again in a moment/i);
  });

  it('keeps the honest message for a genuinely unreadable file', () => {
    expect(messageFor('document')).toMatch(/clearer file/i);
  });

  it('always offers the manual route, whatever went wrong', () => {
    for (const kind of ['config', 'transient', 'document'] as const) {
      expect(messageFor(kind), kind).toMatch(/manually/i);
    }
  });
});


/**
 * The orchestration, with fetch stubbed.
 *
 * The admin route cannot be driven locally — admin sessions are validated
 * against Travelgenix ID rather than signed here — so this exercises the layer
 * that actually changed: pick a backend, fail, classify, choose the message.
 */
describe('extractBookingFromPdf, end to end', () => {
  const realFetch = globalThis.fetch;
  const realEnv = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.LUNA_CHAT_EXTRACT_URL;
    delete process.env.ANTHROPIC_MODEL;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env = { ...realEnv };
  });

  const stub = (status: number, body: unknown) => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
  };

  /** A stub that remembers what it was called with, typed so the args survive. */
  const spyingStub = () => {
    const spy = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) => new Response('{}', { status: 500 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;
    return spy;
  };

  const modelSentBy = (spy: ReturnType<typeof spyingStub>): unknown => {
    const init = spy.mock.calls[0]?.[1];
    return JSON.parse(String(init?.body ?? '{}')).model;
  };

  // The exact failure that has been live since July.
  it('tells the admin it is a settings problem when the model does not exist', async () => {
    stub(404, { error: { message: 'model: claude-sonnet-4-6' } });
    const result = await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'confirmation.pdf');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.configured).toBe(true);
    expect(result.error).toMatch(/misconfigured/i);
    expect(result.error).not.toMatch(/clearer file/i);
  });

  it('still blames the file when the backend genuinely could not read it', async () => {
    stub(400, { error: { message: 'unsupported document' } });
    const result = await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'scan.pdf');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/clearer file/i);
  });

  it('says try again when the service is merely busy', async () => {
    stub(529, { error: { message: 'overloaded' } });
    const result = await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'x.pdf');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/try again/i);
  });

  it('sends the corrected model id by default', async () => {
    const spy = spyingStub();
    await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'x.pdf');

    expect(modelSentBy(spy)).toBe('claude-sonnet-5');
    expect(modelSentBy(spy)).not.toBe('claude-sonnet-4-6');
  });

  it('still honours an explicit ANTHROPIC_MODEL', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-5';
    const spy = spyingStub();
    await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'x.pdf');

    expect(modelSentBy(spy)).toBe('claude-opus-5');
  });

  it('says so plainly when nothing is configured at all', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await extractBookingFromPdf(Buffer.from('%PDF-1.4'), 'x.pdf');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.configured).toBe(false);
    expect(result.error).toMatch(/not switched on/i);
  });
});
