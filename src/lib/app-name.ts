/**
 * What the traveller's app is called, and the letter on its mark.
 *
 * The agency's own app name if they set one, then the agency's name — never
 * "Luna Travel". Travelgenix clients' names live in Control, and most never set
 * a separate app name, so every "|| 'Luna Travel'" in the app showed our name to
 * their travellers, and the badge beside it said "L" (23 Sep 2026: "not everyone
 * will want Luna").
 *
 * When there is genuinely no agency to name yet — the invite screen before it
 * has loaded, a phone with no trip on it — the answer is an empty string, and
 * each caller says something neutral instead of borrowing ours.
 */

export interface Named {
  appName?: string | null;
  name?: string | null;
}

export function appNameOf(agency: Named | null | undefined): string {
  return (agency?.appName || '').trim() || (agency?.name || '').trim();
}

/** The first letter or digit of a name, capitalised; '' when there is none. */
export function initialOf(name: string | null | undefined): string {
  const m = /[\p{L}\p{N}]/u.exec(name || '');
  return m ? m[0].toLocaleUpperCase() : '';
}

/**
 * The assistant, by name. Agencies can call it what they like; left unset it is
 * Luna, which is also what every existing agency's travellers already know.
 */
export const DEFAULT_ASSISTANT = 'Luna';

/**
 * A name the assistant can go by: up to three words of letters and digits
 * (hyphens and apostrophes allowed), nothing that reads as markup or a
 * sentence. It is printed on tabs
 * and buttons, and the chat model is told it is its name, so it is held to
 * the shape of a name rather than trusted as free text.
 */
export function isAssistantName(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const n = v.trim();
  return n.length <= 30 && n.split(/\s+/).length <= 3 && /^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u.test(n);
}

export function assistantOf(agency: { assistantName?: string | null } | null | undefined): string {
  const n = (agency?.assistantName || '').trim().replace(/\s+/g, ' ');
  return isAssistantName(n) ? n : DEFAULT_ASSISTANT;
}
