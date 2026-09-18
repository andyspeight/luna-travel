/**
 * Emergency numbers, split into things a phone can actually dial.
 *
 * This exists because of a bug worth being blunt about. Both the destination
 * screen and the essentials screen rendered the whole field as one tap-to-call
 * link, built by stripping everything that was not a digit:
 *
 *   "102 (police) · 119 (medical)"  →  tel:102119
 *
 * Which is not a phone number anywhere on earth. A traveller tapping it in an
 * emergency gets a failed call and no idea why. Roughly a third of the records
 * carry two services like this, and they are exactly the countries where a
 * traveller is least likely to know the number already.
 *
 * So the field is parsed instead of mangled: each number becomes its own
 * button, labelled with the service it reaches.
 *
 * Pure, and deliberately conservative. Anything it cannot read confidently
 * comes back as text with no link at all, because a dead link on an emergency
 * number is worse than no link.
 */

export interface EmergencyNumber {
  /** As written, for display: "102". */
  display: string;
  /** Digits and a leading +, for the tel: href. */
  dial: string;
  /** "police", "ambulance" — absent when the field did not say. */
  service?: string;
}

/** A number, optionally followed by what it reaches in brackets. */
const ENTRY_RE = /(\+?\d[\d\s]{1,12}\d|\+?\d{2,4})\s*(?:\(([^)]{1,30})\))?/g;

/**
 * Every dialable number in an emergency field.
 *
 * Handles the shapes the data actually holds:
 *
 *   "112"                              one number, no label
 *   "102 (police) · 119 (medical)"     two numbers, each labelled
 *   "999 (police) · 998 (ambulance)"   likewise
 *
 * Returns [] for anything with no number in it, which the caller renders as
 * plain text.
 */
export function emergencyNumbers(field: string | null | undefined): EmergencyNumber[] {
  const raw = (field || '').trim();
  if (!raw) return [];

  const out: EmergencyNumber[] = [];
  const seen = new Set<string>();

  for (const match of raw.matchAll(ENTRY_RE)) {
    const display = match[1].trim();
    const dial = display.replace(/[^\d+]/g, '');
    // A single digit is a typo or a fragment, not an emergency number.
    if (dial.replace(/\D/g, '').length < 2) continue;
    if (seen.has(dial)) continue;
    seen.add(dial);

    const service = match[2]?.trim().toLowerCase();
    out.push(service ? { display, dial, service } : { display, dial });
  }

  return out;
}
