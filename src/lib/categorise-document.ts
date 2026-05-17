/**
 * Document categorisation from filename.
 *
 * Returns a best-guess category based on keywords. Admin can override
 * via the dropdown — this is the pre-fill, not the answer.
 *
 * Keyword lists are deliberately broad. False positives cost the admin
 * one click to correct; false negatives (everything → 'other') cost
 * us the magic feeling of "the system already knew what this was."
 *
 * Order matters when categories overlap (e.g. "atol_certificate.pdf"
 * could be insurance or other — insurance wins because it appears
 * first in the check list).
 */

export type DocumentCategory = 'voucher' | 'ticket' | 'itinerary' | 'insurance' | 'other';

type CategoryRule = {
  category: DocumentCategory;
  keywords: string[];
};

// Order matters: first match wins.
const RULES: CategoryRule[] = [
  {
    category: 'insurance',
    keywords: ['insurance', 'cover', 'atol', 'abta', 'policy'],
  },
  {
    category: 'ticket',
    keywords: ['ticket', 'eticket', 'e-ticket', 'boarding', 'boarding-pass', 'boardingpass'],
  },
  {
    category: 'voucher',
    keywords: ['voucher', 'hotel', 'accommodation', 'villa', 'lodging', 'resort', 'transfer', 'lounge'],
  },
  {
    category: 'itinerary',
    keywords: ['itinerary', 'schedule', 'agenda', 'programme', 'program', 'booking-pack', 'bookingpack', 'pack', 'confirmation'],
  },
];

/**
 * Suggest a category from a filename. Falls back to 'other'.
 *
 * @param filename Original filename including extension, e.g. "Hotel_Voucher_Marriott.pdf"
 * @returns category and a confidence flag (true if we matched a rule)
 */
export function categoriseFromFilename(filename: string): { category: DocumentCategory; confident: boolean } {
  if (typeof filename !== 'string' || filename.length === 0) {
    return { category: 'other', confident: false };
  }

  // Normalise: lowercase, strip path components, strip extension.
  const base = filename.toLowerCase().split(/[\\/]/).pop() || '';
  const stem = base.replace(/\.[a-z0-9]{1,5}$/, '');
  // Treat dashes, underscores, dots, spaces as word boundaries
  const normalised = stem.replace(/[_\-.\s]+/g, ' ');

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      // Match whole word OR substring — substring catches "etickets" matching "ticket"
      if (normalised.includes(kw)) {
        return { category: rule.category, confident: true };
      }
    }
  }
  return { category: 'other', confident: false };
}
