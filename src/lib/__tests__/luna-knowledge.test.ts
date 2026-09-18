import { describe, it, expect } from 'vitest';
import { findKnowledge, knowledgeReply, type KnowledgeItem } from '@/lib/luna-knowledge';

// Real rows, shortened, from Luna Brain's Maldives payload.
const ITEMS: KnowledgeItem[] = [
  {
    id: 'visa',
    question: 'Do I need a visa to visit the Maldives?',
    answer:
      'No advance visa needed. Free 30-day visa on arrival. IMUGA form: complete the online traveller declaration within 96 hours before your flight arrives.',
    category: 'Entry & Visas',
    confidence: 'Verified',
    lastVerified: '2026-09-04',
  },
  {
    id: 'ferries',
    question: 'How do I get between islands or use boats and ferries at my destination?',
    answer:
      'Many of the best destinations involve getting around by boat. Greek islands: ferries connect all major islands. Croatia: ferries and catamarans connect Split and Dubrovnik. Thailand: ferries and speedboats connect the Gulf islands. Maldives: speedboat or seaplane from Male airport to your resort. Venice: vaporetto is public transport.',
    category: 'Getting Around',
    confidence: 'Verified',
    lastVerified: '2026-06-30',
  },
  {
    id: 'dress',
    question: 'What should I wear on holiday? Are there dress codes?',
    answer:
      'Beach resorts: swimwear fine at the beach and pool, smart casual for evening dining. Dubai: cover shoulders and knees in malls. Maldives: no restrictions at resort islands, cover up on local islands.',
    category: 'Culture & Practical',
    confidence: 'Verified',
    lastVerified: '2026-04-06',
  },
  {
    id: 'transfer',
    question: 'How do I get from the airport to my hotel?',
    answer:
      'Package holidays: transfers almost always included. Flight-only: arrange your own. Maldives: speedboat or seaplane to your resort, arranged by the resort.',
    category: 'Getting There',
    confidence: 'Verified',
    lastVerified: '2026-04-06',
  },
];

describe('findKnowledge', () => {
  it('finds the row that actually answers the question', () => {
    expect(findKnowledge('what should I wear?', ITEMS)?.item.id).toBe('dress');
    expect(findKnowledge('is there a dress code?', ITEMS)?.item.id).toBe('dress');
  });

  it('picks the ferry row for a boat question', () => {
    expect(findKnowledge('how do I get between the islands by boat?', ITEMS)?.item.id).toBe('ferries');
  });

  // A wrong answer from Brain is worse than none: these rows carry a source and
  // a verification date, so they read as authoritative.
  it('returns nothing when nothing really matches', () => {
    expect(findKnowledge('is there a kids club at the hotel?', ITEMS)).toBeNull();
    expect(findKnowledge('what time is check out?', ITEMS)).toBeNull();
    expect(findKnowledge('can I get a cot?', ITEMS)).toBeNull();
  });

  it('will not match on one incidental shared word', () => {
    // Shares "hotel" with the transfer row and "resort" with two others, and
    // answers none of them.
    expect(findKnowledge('does the hotel have a gym and a spa?', ITEMS)).toBeNull();
  });

  it('does answer a bare keyword that IS one of the questions', () => {
    // A one-word query is allowed, but only against the item's own question.
    expect(findKnowledge('ferries', ITEMS)?.item.id).toBe('ferries');
  });

  it('copes with an empty knowledge base', () => {
    expect(findKnowledge('what should I wear?', [])).toBeNull();
  });

  it('ignores a row with no answer in it', () => {
    const empty: KnowledgeItem[] = [{ ...ITEMS[0], answer: '   ' }];
    expect(findKnowledge('do I need a visa for the Maldives?', empty)).toBeNull();
  });
});

describe('knowledgeReply', () => {
  it('gives the answer with the date it was checked', () => {
    const match = findKnowledge('do I need a visa?', ITEMS)!;
    const reply = knowledgeReply(match);
    expect(reply.text).toContain('30-day visa on arrival');
    expect(reply.text).toContain('Checked 2026-09-04');
  });

  it('trims a long row without cutting mid-sentence', () => {
    const long: KnowledgeItem = {
      id: 'long',
      question: 'What is the monsoon season?',
      answer: `${'Monsoon brings heavy rain but is not a holiday-ruiner. '.repeat(30)}`,
      category: 'Climate',
    };
    const match = findKnowledge('what is the monsoon season?', [long])!;
    const text = knowledgeReply(match).text;
    expect(text.length).toBeLessThan(760);
    expect(text.trimEnd()).toMatch(/[.…]$/);
  });

  it('leaves a short row alone', () => {
    const match = findKnowledge('what should I wear?', ITEMS)!;
    expect(knowledgeReply(match).text).toContain('smart casual for evening dining');
  });
});
