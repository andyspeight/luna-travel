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
});
