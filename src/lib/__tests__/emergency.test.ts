import { describe, it, expect } from 'vitest';
import { emergencyNumbers } from '@/lib/emergency';

describe('emergencyNumbers', () => {
  it('reads a single number', () => {
    expect(emergencyNumbers('112')).toEqual([{ display: '112', dial: '112' }]);
  });

  // THE bug. Stripping non-digits from this produced tel:102119, which dials
  // nothing, on the screen a traveller reaches for in an emergency.
  it('splits two services rather than fusing them into one wrong number', () => {
    expect(emergencyNumbers('102 (police) · 119 (medical)')).toEqual([
      { display: '102', dial: '102', service: 'police' },
      { display: '119', dial: '119', service: 'medical' },
    ]);
  });

  it('handles the other live example', () => {
    const out = emergencyNumbers('999 (police) · 998 (ambulance)');
    expect(out.map((n) => n.dial)).toEqual(['999', '998']);
    expect(out.map((n) => n.service)).toEqual(['police', 'ambulance']);
  });

  it('keeps an international prefix dialable', () => {
    expect(emergencyNumbers('+44 999')[0].dial).toBe('+44999');
  });

  it('never returns the same number twice', () => {
    expect(emergencyNumbers('112 (police) · 112 (ambulance)')).toHaveLength(1);
  });

  it('ignores a stray digit that is not a number', () => {
    expect(emergencyNumbers('Dial 1 then 112')).toEqual([{ display: '112', dial: '112' }]);
  });

  // A dead link on an emergency number is worse than no link, so the caller
  // needs to be able to tell "no numbers here" and fall back to plain text.
  it('returns nothing it cannot read', () => {
    expect(emergencyNumbers('Ask at reception')).toEqual([]);
    expect(emergencyNumbers('')).toEqual([]);
    expect(emergencyNumbers(null)).toEqual([]);
  });
});
