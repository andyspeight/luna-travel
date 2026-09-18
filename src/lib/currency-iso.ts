/**
 * Currency label → ISO 4217 code.
 *
 * The content base writes currency for people to read — "Thai Baht (฿)",
 * "Euro (€)" — because that is what a destination page shows. A converter needs
 * a code, and no amount of string-mangling turns "฿" into "THB".
 *
 * So this maps the names. It is not destination data: ISO 4217 is a standard,
 * the same list for every agency, and it changes about twice a decade. Keeping
 * it in code means one place to correct, and a country whose currency changes
 * needs only its own record edited.
 *
 * Rule 8 applies to the failure case. An unrecognised label returns null and
 * the converter does not appear, rather than guessing a code and quietly
 * showing a traveller the wrong rate.
 */

/** Anything the base might write in the brackets that is already a code. */
const ISO_RE = /^[A-Z]{3}$/;

/**
 * Names as the content base writes them, lowercased and stripped of anything
 * that is not a letter or a space, so "Trinidad & Tobago Dollar" and
 * "Trinidad and Tobago Dollar" both land here.
 */
const BY_NAME: Record<string, string> = {
  // Europe
  'euro': 'EUR',
  'pound sterling': 'GBP',
  'british pound': 'GBP',
  'swiss franc': 'CHF',
  'swedish krona': 'SEK',
  'norwegian krone': 'NOK',
  'danish krone': 'DKK',
  'icelandic krona': 'ISK',
  'polish zloty': 'PLN',
  'czech koruna': 'CZK',
  'hungarian forint': 'HUF',
  'romanian leu': 'RON',
  'bulgarian lev': 'BGN',
  'serbian dinar': 'RSD',
  'albanian lek': 'ALL',
  'turkish lira': 'TRY',
  'georgian lari': 'GEL',
  'ukrainian hryvnia': 'UAH',
  'macedonian denar': 'MKD',
  'bosnian convertible mark': 'BAM',
  'moldovan leu': 'MDL',

  // Americas
  'us dollar': 'USD',
  'united states dollar': 'USD',
  'canadian dollar': 'CAD',
  'mexican peso': 'MXN',
  'brazilian real': 'BRL',
  'argentine peso': 'ARS',
  'chilean peso': 'CLP',
  'colombian peso': 'COP',
  'peruvian sol': 'PEN',
  'boliviano': 'BOB',
  'bolivian boliviano': 'BOB',
  'costa rican colon': 'CRC',
  'belize dollar': 'BZD',
  'guatemalan quetzal': 'GTQ',
  'uruguayan peso': 'UYU',

  // Caribbean
  'east caribbean dollar': 'XCD',
  'eastern caribbean dollar': 'XCD',   // both spellings are live in the base
  'jamaican dollar': 'JMD',
  'barbadian dollar': 'BBD',
  'bahamian dollar': 'BSD',
  'bermudian dollar': 'BMD',
  'cayman islands dollar': 'KYD',
  'trinidad tobago dollar': 'TTD',
  'trinidad and tobago dollar': 'TTD',
  'dominican peso': 'DOP',
  'cuban peso': 'CUP',
  'aruban florin': 'AWG',
  'caribbean guilder': 'XCG',
  'netherlands antillean guilder': 'ANG',

  // Middle East and North Africa
  'uae dirham': 'AED',
  'united arab emirates dirham': 'AED',
  'saudi riyal': 'SAR',
  'qatari riyal': 'QAR',
  'omani rial': 'OMR',
  'bahraini dinar': 'BHD',
  'kuwaiti dinar': 'KWD',
  'jordanian dinar': 'JOD',
  'israeli shekel': 'ILS',
  'israeli new shekel': 'ILS',
  'egyptian pound': 'EGP',
  'moroccan dirham': 'MAD',
  'tunisian dinar': 'TND',

  // Sub-Saharan Africa
  'south african rand': 'ZAR',
  'kenyan shilling': 'KES',
  'tanzanian shilling': 'TZS',
  'ugandan shilling': 'UGX',
  'rwandan franc': 'RWF',
  'zambian kwacha': 'ZMW',
  'botswana pula': 'BWP',
  'namibian dollar': 'NAD',
  'mozambican metical': 'MZN',
  'gambian dalasi': 'GMD',
  'ethiopian birr': 'ETB',
  'cape verdean escudo': 'CVE',
  'mauritian rupee': 'MUR',
  'seychellois rupee': 'SCR',

  // Asia
  'japanese yen': 'JPY',
  'chinese yuan': 'CNY',
  'hong kong dollar': 'HKD',
  'new taiwan dollar': 'TWD',
  'south korean won': 'KRW',
  'singapore dollar': 'SGD',
  'malaysian ringgit': 'MYR',
  'thai baht': 'THB',
  'vietnamese dong': 'VND',
  'cambodian riel': 'KHR',
  'lao kip': 'LAK',
  'indonesian rupiah': 'IDR',
  'philippine peso': 'PHP',
  'indian rupee': 'INR',
  'sri lankan rupee': 'LKR',
  'nepalese rupee': 'NPR',
  'pakistani rupee': 'PKR',
  'maldivian rufiyaa': 'MVR',

  // Oceania
  'australian dollar': 'AUD',
  'new zealand dollar': 'NZD',
  'fijian dollar': 'FJD',
  'samoan tala': 'WST',
  'cfp franc': 'XPF',
};

/** Lowercase, drop punctuation, collapse spaces. "Trinidad & Tobago" → "trinidad tobago". */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The ISO 4217 code for a currency label, or null when we cannot be sure.
 *
 * Handles the three shapes the base actually contains:
 *
 *   "Thai Baht (฿)"                 → THB   by name
 *   "Swiss Franc (CHF)"             → CHF   the brackets already hold a code
 *   "USD in practice (official: ZiG)" → USD  Zimbabwe, where the honest answer
 *                                           is the currency people actually pay
 *                                           in, and the record says so
 */
export function currencyIso(label: string | null | undefined): string | null {
  const raw = (label || '').trim();
  if (!raw) return null;

  // A bracketed code wins — it is unambiguous and someone typed it deliberately.
  const bracket = raw.match(/\(([^)]*)\)/)?.[1]?.trim() ?? '';
  if (ISO_RE.test(bracket)) return bracket;

  const beforeBracket = raw.split('(')[0].trim();

  // A label that opens with a bare code, as Zimbabwe's does.
  const firstWord = beforeBracket.split(/\s+/)[0] ?? '';
  if (ISO_RE.test(firstWord)) return firstWord;

  const direct = BY_NAME[normalise(beforeBracket)];
  if (direct) return direct;

  // The static guide writes qualified labels — "Maldivian Rufiyaa · USD widely
  // accepted" — where the currency is the first segment and the rest is advice.
  // The advice is worth keeping on screen; it just is not part of the name.
  const firstSegment = beforeBracket.split(/[·|]/)[0].trim();
  if (firstSegment && firstSegment !== beforeBracket) {
    return BY_NAME[normalise(firstSegment)] ?? null;
  }

  return null;
}

/**
 * The currency's NAME, for labelling a field: "Thai Baht (฿)" → "Thai Baht".
 *
 * Qualifiers are dropped as well as brackets. "Maldivian Rufiyaa · USD widely
 * accepted" is useful context and belongs on the screen, but not as the label
 * over an input box, where it wraps onto three lines and buries the number.
 * Show the full label somewhere with room for it.
 */
export function currencyName(label: string | null | undefined): string {
  return (label || '').split('(')[0].split(/[·|]/)[0].trim();
}

/**
 * The symbol the base put in brackets, or '' — never the ISO code, which is not
 * a symbol and reads wrong next to an amount.
 */
export function currencySymbol(label: string | null | undefined): string {
  const bracket = (label || '').match(/\(([^)]*)\)/)?.[1]?.trim() ?? '';
  if (!bracket || ISO_RE.test(bracket)) return '';
  // "official: ZiG" and friends are notes, not symbols.
  if (/[:]/.test(bracket)) return '';
  return bracket;
}
