import type { DestinationGuide } from '@/types/booking';

const GUIDES: Record<string, DestinationGuide> = {
  MV: {
    countryCode: 'MV',
    name: 'Maldives',
    region: 'Indian Ocean',
    currency: 'Maldivian Rufiyaa · USD widely accepted',
    timeZone: 'GMT +5',
    languages: ['Dhivehi', 'English'],
    weatherSummary: '29–31°C dry season Nov–Apr, occasional showers',
    introduction:
      'A nation of coral islands strung across the equator, the Maldives is built for slowing down. Overwater villas, glass-clear lagoons and reefs that read like aquariums — and on local islands like Gulhi, a quieter, more grounded way to experience island life.',
    whyWeLoveIt:
      'If you are staying on a local island, the contrast with the resort experience is the point. Quiet bikini beaches, breakfast on the sand at sunrise, dive boats heading out at first light. Easy to meet other travellers and your money goes much further.',
    insiderTips:
      'Fridays are quiet — most local shops close for prayers. Carry small denomination USD or rufiyaa for boat trips. Reef-safe sunscreen only on the bikini beach. Speedboat transfers run on a fixed schedule.',
    visaSummary:
      'UK passport holders get a free 30-day visa on arrival. Passport must be valid for one month past your return date. Proof of onward travel required (your return ticket covers this).',
    emergencyNumber: '102 (police) · 119 (medical)',
  },

  ES: {
    countryCode: 'ES',
    name: 'Mallorca',
    region: 'Balearic Islands',
    currency: 'Euro',
    timeZone: 'GMT +1 (BST −1)',
    languages: ['Spanish', 'Catalan', 'English widely spoken'],
    weatherSummary: '26–30°C July–August, dry, sea around 25°C',
    introduction:
      'The largest of the Balearics — and quietly one of the most varied islands in the Mediterranean. North coast cliffs, south coast bays, mountain villages in the Tramuntana, Palma itself a proper Spanish city. Families head for the resorts; the rest of the island keeps moving at its own pace.',
    whyWeLoveIt:
      'You can do nothing for a week and feel like you have done a lot. Beach mornings, long lunches, sunset paseos, ice cream that tastes of the place it is made. Kids fall in love with it.',
    insiderTips:
      'Hire a car for at least two days — the inland villages are the trip. Lunch is late, dinner is later. The Tramuntana road is one of the great drives in Europe.',
    visaSummary:
      'UK passport holders get up to 90 days visa-free in the Schengen area in any 180 days. Passport must have at least 3 months validity from your return date.',
    emergencyNumber: '112',
  },

  AE: {
    countryCode: 'AE',
    name: 'Dubai',
    region: 'United Arab Emirates · Persian Gulf',
    currency: 'UAE Dirham (AED)',
    timeZone: 'GMT +4',
    languages: ['Arabic', 'English'],
    weatherSummary: '30–35°C in October, dropping mid-month, low humidity, almost no rain',
    introduction:
      'Dubai earns the cliches and then quietly outgrows them. Yes the towers and the malls and the brunches, but also the Creek, the gold souk at sunset, Friday breakfasts in Al Fahidi, dune drives that finish under more stars than you expect.',
    whyWeLoveIt:
      'Anything is open, late, and very well done. The food is everything from £6 karak to two Michelin stars. The infrastructure works. And it is a remarkable place to stop on the way to somewhere else.',
    insiderTips:
      'Stay on Palm Jumeirah for the beach, in DIFC for the food, in Downtown for the spectacle. Friday brunch is the local sport. Carry a light layer for over-air-conditioning indoors.',
    visaSummary:
      'UK passport holders get a free 30 or 60-day visa on arrival depending on planned activities. Passport must be valid for 6 months from arrival.',
    emergencyNumber: '999 (police) · 998 (ambulance)',
  },

  GR: {
    countryCode: 'GR',
    name: 'Athens',
    region: 'Attica · Greece',
    currency: 'Euro',
    timeZone: 'GMT +2 (BST +1)',
    languages: ['Greek', 'English widely spoken'],
    weatherSummary: 'September averages 24–29°C, warm evenings, sea still around 24°C',
    introduction:
      'Athens has shaken off the "stopover" tag entirely. The neighbourhoods around Plaka and Koukaki are full of small hotels, smaller restaurants, rooftops with a view of something nearly three thousand years old. It is a great city for a long weekend.',
    whyWeLoveIt:
      'The Acropolis is genuinely as good as advertised. The food in tavernas off the tourist beat is some of the best in Europe. And the sunset from Filopappou Hill is free.',
    insiderTips:
      'Book the Acropolis Museum on the same day as the rock — they reinforce each other. Eat early in tourist Plaka, late in Pangrati. The metro from the airport is fast and cheap.',
    visaSummary:
      'UK passport holders get up to 90 days visa-free in the Schengen area in any 180 days. Passport must have at least 3 months validity from your return date.',
    emergencyNumber: '112',
  },
};

export function getDestinationGuide(countryCode: string): DestinationGuide | undefined {
  return GUIDES[countryCode.toUpperCase()];
}
