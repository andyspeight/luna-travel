import { describe, it, expect } from 'vitest';
import { essentialsAnswer, type EssentialsContext } from '@/lib/luna-essentials';
import { packingList } from '@/lib/packing';

const greece: EssentialsContext = {
  destinationLabel: 'Greece',
  currencyLabel: 'Euro (€)',
  languageLabel: 'Greek',
  voltageAndPlug: '230V · Type C/F',
  emergencyNumber: '112',
  packing: packingList({ tags: ['Beach'], travellerTypes: ['adult'] }),
};

const bare: EssentialsContext = { destinationLabel: 'Somewhere' };

// Luna Brain's structured country facts, as the live payload returns them.
const brainy: EssentialsContext = {
  ...greece,
  destinationLabel: 'Maldives',
  tapWaterSafe: 'No',
  vaccinations: 'Required: None. Recommended: Routine UK vaccinations. Hep A, Typhoid considered. Malaria: No risk.',
  drivingSide: 'Left',
  diallingCode: '+960',
  ukEmbassy: 'British High Commission, Male. +960 301 0100.',
  timeZone: 'GMT +5',
};

describe("Luna Brain's structured facts", () => {
  it('answers whether the tap water is safe, and says what that covers', () => {
    const r = essentialsAnswer('is the water safe to drink?', brainy);
    expect(r?.text).toMatch(/^No —/);
    expect(r?.text).toMatch(/ice|teeth/);
  });

  it('gets the sense the right way round when it IS safe', () => {
    const safe = { ...brainy, destinationLabel: 'Greece', tapWaterSafe: 'Yes' };
    expect(essentialsAnswer('can I drink the tap water?', safe)?.text).toMatch(/^Yes —/);
  });

  it('answers a question about jabs, and sends them to a clinic', () => {
    const r = essentialsAnswer('do I need a jab for this?', brainy);
    expect(r?.text).toContain('Malaria: No risk');
    expect(r?.text).toMatch(/travel clinic/);
  });

  it('answers which side they drive on, relative to home', () => {
    expect(essentialsAnswer('which side of the road do they drive on?', brainy)?.text)
      .toMatch(/left.*same as home/i);
    const right = { ...brainy, drivingSide: 'Right' };
    expect(essentialsAnswer('is it hard to drive there?', right)?.text)
      .toMatch(/right.*opposite of home/i);
  });

  it('gives the dialling code and how to ring home', () => {
    const r = essentialsAnswer('what is the country dialling code?', brainy);
    expect(r?.text).toContain('+960');
    expect(r?.text).toContain('+44');
  });

  it('gives the embassy when that is what was asked', () => {
    expect(essentialsAnswer('where is the British embassy?', brainy)?.text)
      .toContain('British High Commission');
  });

  it('answers the time difference', () => {
    expect(essentialsAnswer('what is the time difference?', brainy)?.text).toContain('GMT +5');
  });

  // Rule 8: Brain not holding a field is a normal outcome, not an error.
  it('declines every one of them when Brain has nothing', () => {
    for (const q of [
      'is the water safe to drink',
      'do I need a jab',
      'which side do they drive on',
      'what is the dialling code',
      'where is the embassy',
      'what is the time difference',
    ]) {
      expect(essentialsAnswer(q, bare), q).toBeNull();
    }
  });
});

describe('power', () => {
  it('answers what plug to bring', () => {
    const reply = essentialsAnswer('what plug do I need?', greece);
    expect(reply?.text).toContain('230V · Type C/F');
    expect(reply?.text).toMatch(/travel adapter/i);
  });

  it('tells a traveller to leave the adapter at home where that is true', () => {
    const malta = { ...greece, destinationLabel: 'Malta', voltageAndPlug: '230V · Type G' };
    expect(essentialsAnswer('do I need an adapter?', malta)?.text).toMatch(/same three-pin|leave the adapter/i);
  });

  it('recognises the question however it is asked', () => {
    for (const q of ['what adapter', 'which socket', 'how do I charge my phone', 'what voltage is it']) {
      expect(essentialsAnswer(q, greece), q).not.toBeNull();
    }
  });
});

describe('emergencies', () => {
  it('gives the number', () => {
    expect(essentialsAnswer('what is the emergency number', greece)?.text).toContain('112');
    expect(essentialsAnswer('how do I call an ambulance', greece)?.text).toContain('112');
  });
});

describe('money', () => {
  it('names the currency and points at the converter', () => {
    const reply = essentialsAnswer('what currency do they use?', greece);
    expect(reply?.text).toContain('Euro');
    expect(reply?.text).toMatch(/converter/i);
  });

  it('does not print the symbol as though it were the name', () => {
    expect(essentialsAnswer('what currency?', greece)?.text).not.toContain('(€)');
  });
});

describe('language', () => {
  it('gives two phrases it can actually say', () => {
    const reply = essentialsAnswer('how do I say hello?', greece);
    expect(reply?.text).toContain('Γεια σας');
    expect(reply?.text).toContain('Ευχαριστώ');
    expect(reply?.text).toMatch(/yah sahs/);
  });

  it('says nothing for an English-speaking destination', () => {
    const barbados = { ...greece, destinationLabel: 'Barbados', languageLabel: 'English' };
    expect(essentialsAnswer('how do I say thank you?', barbados)).toBeNull();
  });
});

describe('packing', () => {
  it('builds the answer from the trip rather than a country list', () => {
    const reply = essentialsAnswer('build a packing list', greece);
    expect(reply?.text).toContain('Greece');
    expect(reply?.text.toLowerCase()).toContain('swimwear');
  });

  it('leads with the destination, not the passport', () => {
    // Documents are the same everywhere and make a dull opening line.
    const reply = essentialsAnswer('what should I take?', greece);
    expect(reply?.text.split('\n\n')[1]?.startsWith('Documents')).toBe(false);
  });
});

// The whole point of returning null: Luna's own handler then offers the agent
// rather than this inventing something.
describe('when there is no data', () => {
  it('declines every topic rather than guessing', () => {
    for (const q of [
      'what plug do I need',
      'emergency number',
      'what currency',
      'how do I say hello',
      'what should I pack',
      'how much should I tip',
    ]) {
      expect(essentialsAnswer(q, bare), q).toBeNull();
    }
  });

  it('declines tipping until somebody has verified it', () => {
    expect(essentialsAnswer('how much should I tip?', greece)).toBeNull();
    const withTipping = { ...greece, tipping: 'Round up in tavernas; 5–10% for good service.' };
    expect(essentialsAnswer('how much should I tip?', withTipping)?.text).toContain('tavernas');
  });
});

describe('questions it should not intercept', () => {
  it('leaves visas, weather and lounges to Luna', () => {
    for (const q of ['do I need a visa', "what's the weather like", 'lounge access details']) {
      expect(essentialsAnswer(q, greece), q).toBeNull();
    }
  });

  // "how much is a taxi from the airport" was answered with "Greece uses the
  // Euro" — a non-answer that displaced the honest handoff to the agent.
  it('does not answer a price question by naming the currency', () => {
    for (const q of [
      'how much is a taxi from the airport',
      'how much is a beer',
      'how much are the excursions',
    ]) {
      expect(essentialsAnswer(q, greece), q).toBeNull();
    }
  });

  it('still answers a genuine money question', () => {
    for (const q of [
      'what currency do they use',
      'should I take cash',
      "what's the exchange rate",
      'are there ATMs',
    ]) {
      expect(essentialsAnswer(q, greece), q).not.toBeNull();
    }
  });
});
