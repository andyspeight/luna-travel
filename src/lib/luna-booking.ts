/**
 * Luna, answering from the booking.
 *
 * The gap this closes: asked "what time do we land", "what time is check out",
 * "how much luggage can I take" or "who's on the booking", Luna said it could
 * not answer and offered to fetch a human — while the answers sat in the
 * booking already on the device. Twelve of twenty-four realistic questions
 * landed there.
 *
 * DETERMINISTIC, AND THAT IS THE POINT. These are facts about a booking
 * somebody has paid for. A model paraphrasing a check-out time or a baggage
 * allowance is a liability, so nothing here is generated: every sentence is
 * assembled from fields, and a field that is absent produces no sentence.
 *
 * Pure, so it works offline. The booking is already cached on the device, which
 * means the questions a traveller asks at the airport with no signal are
 * exactly the ones answered without a network.
 *
 * Rule 8 throughout. "Is the hotel near the beach" is NOT answered, because the
 * booking does not say. Declining is the correct behaviour, and the caller then
 * offers the agent.
 */

import type { Booking, FlightLeg, Hotel } from '@/types/booking';
import {
  formatBoard,
  formatCabin,
  formatDate,
  formatDayMonth,
  formatMoney,
  formatTime,
  formatDuration,
} from '@/lib/format';
import { paymentState } from '@/lib/order-money';

export interface BookingReply {
  text: string;
  pills?: string[];
}

/** Outbound = first by departure; inbound = last, when there is more than one. */
function outbound(booking: Booking): FlightLeg | null {
  const sorted = [...booking.flights].sort((a, b) => a.depTime.localeCompare(b.depTime));
  return sorted[0] ?? null;
}

function inbound(booking: Booking): FlightLeg | null {
  const sorted = [...booking.flights].sort((a, b) => a.depTime.localeCompare(b.depTime));
  return sorted.length > 1 ? sorted[sorted.length - 1] : null;
}

function firstHotel(booking: Booking): Hotel | null {
  const sorted = [...booking.hotels].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return sorted[0] ?? null;
}

/**
 * The flight designator.
 *
 * FlightLeg.flightNumber already carries the carrier code on every real booking
 * ("EY20"), so concatenating the two produced "EYEY20". A supplier sending a
 * bare "20" is still handled, because it might.
 */
function designator(f: FlightLeg): string {
  const num = (f.flightNumber || '').trim();
  const code = (f.carrierCode || '').trim();
  if (!code) return num;
  return num.toUpperCase().startsWith(code.toUpperCase()) ? num : `${code}${num}`;
}

/** "BA2678 from Gatwick to Malaga". Airport names where we have them. */
function legLabel(f: FlightLeg): string {
  const from = f.depAirportName || f.depCity || f.depAirport;
  const to = f.arrAirportName || f.arrCity || f.arrAirport;
  return `${designator(f)} from ${from} to ${to}`;
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * An answer from the booking, or null to let the caller try elsewhere.
 *
 * Order matters: the narrowest phrases are tested first, because "what time"
 * appears in half of these questions and only the rest of the sentence says
 * which one is meant.
 */
export function bookingAnswer(question: string, booking: Booking): BookingReply | null {
  const q = question.toLowerCase();

  const out = outbound(booking);
  const back = inbound(booking);
  const hotel = firstHotel(booking);

  const asksFlight = /\b(flight|fly|flying|plane|land|landing|take ?off|depart|arrive|arrival|departure)\b/.test(q);
  // Deliberately excludes check-in: "online check-in time?" is a flight
  // question and belongs to the caller's own branch, not to the hotel.
  const asksHotel = /\b(hotel|room|board|breakfast|accommodation|resort|stay)\b/.test(q);
  const asksFlightCheckIn = /\b(online|flight|airline|airport|boarding)\b/.test(q);

  // ── Landing and take-off times ──
  if (/\b(land|landing|arrive|arrival|get there|get in)\b/.test(q) && out) {
    const leg = /\b(home|back|return|coming back)\b/.test(q) && back ? back : out;
    const parts = [
      `${designator(leg)} lands at ${leg.arrAirportName || leg.arrCity || leg.arrAirport} at ${formatTime(leg.arrTime)} on ${formatDayMonth(leg.arrTime)}.`,
    ];
    if (leg.arrTerminal) parts.push(`Terminal ${leg.arrTerminal}.`);
    parts.push('All times are local to the airport.');
    return { text: parts.join(' '), pills: ['What time do we take off?', 'How much luggage can I take?'] };
  }

  if (/\b(take ?off|depart|departure|leave|set off)\b/.test(q) && out) {
    const leg = /\b(home|back|return|coming back)\b/.test(q) && back ? back : out;
    const parts = [
      `${legLabel(leg)} departs at ${formatTime(leg.depTime)} on ${formatDayMonth(leg.depTime)}.`,
    ];
    if (leg.depTerminal) parts.push(`Terminal ${leg.depTerminal}.`);
    if (leg.durationMinutes) parts.push(`It is about ${formatDuration(leg.durationMinutes)} in the air.`);
    return { text: parts.join(' '), pills: ['Online check-in time?', 'What time do we land?'] };
  }

  // ── Baggage ──
  if (/\b(luggage|baggage|bags?|suitcase|hold|checked)\b/.test(q) && booking.flights.length) {
    const allowances = booking.flights
      .filter((f) => f.baggageAllowance)
      .map((f) => `${designator(f)}: ${f.baggageAllowance}`);
    if (!allowances.length) {
      // The booking does not carry it. Saying so is better than a general
      // airline rule that may not be the one sold.
      return {
        text: `Your booking does not list a baggage allowance, and I would rather not quote ${out?.carrierName || 'the airline'}'s general rules in case yours differs. ${booking.agency.name} will have it on the confirmation.`,
        pills: agentPills(booking),
      };
    }
    return {
      text: `Baggage on your flights — ${list(allowances)}. Hand luggage rules are set by the airline and can change, so it is worth checking their site before you pack.`,
      pills: ['What time do we take off?'],
    };
  }

  // ── Seats ──
  if (/\b(seat|seats|seated|sitting together)\b/.test(q) && booking.flights.length) {
    const withSeats = booking.flights.filter((f) => f.seats && Object.keys(f.seats).length);
    if (!withSeats.length) {
      return {
        text: 'No seats are allocated on your booking yet. They are usually assigned at online check-in, which opens 24 hours before departure — I will tell you the moment it does.',
        pills: ['Online check-in time?'],
      };
    }
    const lines = withSeats.map((f) => {
      const seats = Object.entries(f.seats ?? {}).map(([travellerId, seat]) => {
        const t = booking.travellers.find((p) => p.id === travellerId);
        return t ? `${t.firstName} ${seat}` : seat;
      });
      return `${designator(f)}: ${list(seats)}`;
    });
    return { text: `Your seats — ${lines.join('; ')}.` };
  }

  // ── Hotel check-in and check-out ──
  if (/\bcheck[- ]?out\b/.test(q) && hotel) {
    return {
      text: `Check-out from ${hotel.name} is on ${formatDate(hotel.checkOut)}. Most hotels ask you to be out by late morning and will hold your bags afterwards — ${booking.agency.name} can confirm the exact time if you need it.`,
      pills: ['What time is check-in?', ...agentPills(booking)],
    };
  }

  if (/\bcheck[- ]?in\b/.test(q) && !asksFlightCheckIn && hotel) {
    return {
      text: `You check in to ${hotel.name} on ${formatDate(hotel.checkIn)}, for ${hotel.nights} night${hotel.nights === 1 ? '' : 's'}. Rooms are usually ready from mid-afternoon; if you land earlier they will normally take your bags.`,
      pills: ['What time is check out?', "What's included?"],
    };
  }

  // ── Room and board ──
  if (/\b(room|suite|villa|board|breakfast|all[- ]inclusive|half[- ]board|included|meals?)\b/.test(q) && hotel) {
    const bits = [`You are in ${hotel.roomName || hotel.roomType || 'your room'} at ${hotel.name}`];
    // formatBoard returns null for "Unknown" as well as for a missing value,
    // which is exactly right: no board basis produces no clause, rather than
    // "on unknown".
    const board = formatBoard(hotel.boardBasis);
    if (board) bits.push(`on ${board.toLowerCase()}`);
    let text = `${bits.join(' ')}.`;
    if (hotel.specialRequests) {
      text += ` Your booking notes: "${hotel.specialRequests}" — requests are with the hotel rather than guaranteed, so worth confirming on arrival.`;
    }
    return { text, pills: ['What time is check-in?'] };
  }

  // ── Where is the hotel ──
  if (/\b(where|address|located|location)\b/.test(q) && asksHotel && hotel) {
    const where = [hotel.resort, hotel.city, hotel.country].filter(Boolean).join(', ');
    return {
      text: `${hotel.name} is in ${where}. The trip map has it pinned, along with everywhere else on your itinerary.`,
      pills: ['What time is check-in?'],
    };
  }

  // ── How long is the trip ──
  if (/\b(how long|how many nights|how many days|duration)\b/.test(q)) {
    return {
      text: `Your trip runs ${formatDate(booking.tripStart)} to ${formatDate(booking.tripEnd)} — ${booking.durationLabel}.`,
    };
  }

  // ── Who is going ──
  if (/\b(who|how many of us|party|travellers?|passengers?|names?)\b/.test(q) && /\b(book|booking|us|going|travel|party|name)\b/.test(q)) {
    const names = booking.travellers.map((t) => `${t.firstName} ${t.lastName}`);
    const adults = booking.travellers.filter((t) => t.type === 'adult').length;
    const children = booking.travellers.filter((t) => t.type === 'child').length;
    const infants = booking.travellers.filter((t) => t.type === 'infant').length;
    const shape = [
      adults ? `${adults} adult${adults === 1 ? '' : 's'}` : '',
      children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
      infants ? `${infants} infant${infants === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    return {
      text: `${booking.travellers.length} of you are on booking ${booking.reference} — ${list(names)} (${shape.join(', ')}). Names must match the passports exactly; tell ${booking.agency.name} straight away if any of them do not.`,
    };
  }

  // ── Transfers and other extras ──
  if (/\b(transfer|pick ?up|taxi|shuttle|coach|getting to the hotel|from the airport)\b/.test(q)) {
    const transfers = (booking.experiences ?? []).filter((e) => e.kind === 'transfer');
    if (transfers.length) {
      const lines = transfers.map((t) => {
        const when = t.time ? `${formatDayMonth(t.startDate)} at ${t.time}` : formatDayMonth(t.startDate);
        return `${t.title} on ${when}${t.supplier ? ` with ${t.supplier}` : ''}${t.reference ? ` (ref ${t.reference})` : ''}`;
      });
      return { text: `You have a transfer booked — ${list(lines)}.`, pills: ['Where is the hotel?'] };
    }
    return {
      text: `There is no transfer on your booking, so getting from the airport to ${hotel?.name || 'your hotel'} is yours to arrange. ${booking.agency.name} can usually add one if you would like.`,
      pills: agentPills(booking),
    };
  }

  // ── Lounge, parking, fast track ──
  if (/\b(lounge|parking|park the car|fast[- ]?track)\b/.test(q)) {
    const wanted = /lounge/.test(q) ? 'lounge' : /park/.test(q) ? 'parking' : 'fast-track';
    const extra = booking.airportExtras.find((x) => x.type === wanted);
    if (extra) {
      const when = extra.time ? `${formatDayMonth(extra.date)} at ${extra.time}` : formatDayMonth(extra.date);
      return {
        text: `${extra.name} is booked for ${when}${extra.guests ? `, for ${extra.guests} guest${extra.guests === 1 ? '' : 's'}` : ''}. Your pass is in Documents.`,
        pills: ['Where are my documents?'],
      };
    }
    return {
      text: `There is no ${wanted.replace('-', ' ')} on your booking. ${booking.agency.name} can normally add one before you travel.`,
      pills: agentPills(booking),
    };
  }

  // ── Excursions and activities ──
  //
  // "ticket" is deliberately absent: "where are my tickets" is nearly always
  // about documents, and having it here meant a booking with no excursions
  // returned null from this branch and never reached the documents one below.
  if (/\b(excursion|tour|activity|activities|what have we booked|what's booked)\b/.test(q)) {
    const things = (booking.experiences ?? []).filter((e) => e.kind !== 'transfer');
    // Fall through rather than return: with nothing booked, a later branch or
    // the caller's handoff is a better answer than a dead end.
    if (things.length) {
      const lines = things.map((e) => `${e.title} on ${formatDayMonth(e.startDate)}`);
      return {
        text: `Booked and paid for — ${list(lines)}. Each one has its own page in your itinerary with the details.`,
      };
    }
  }

  // ── Documents ──
  if (/\b(document|documents|ticket|tickets|voucher|e-?ticket|booking pack|atol|paperwork|confirmation)\b/.test(q)) {
    if (!booking.documents.length) {
      return {
        text: `Nothing has been uploaded to your Documents yet. ${booking.agency.name} adds them as they come through, and you will get a notification each time.`,
        pills: agentPills(booking),
      };
    }
    const names = booking.documents.map((d) => d.name);
    return {
      text: `You have ${booking.documents.length} document${booking.documents.length === 1 ? '' : 's'} — ${list(names)}. They are in the Docs tab and download for offline use, which is worth doing before you fly.`,
    };
  }

  // ── Money ──
  // Read through paymentState, so this and the home screen cannot disagree.
  // A balance the booking does not carry is UNKNOWN: this used to say "nothing
  // left to pay" to every real traveller, because no real booking carried one.
  if (/\b(balance|owe|owing|pay|paid|payment|deposit|cost|price|how much did)\b/.test(q)) {
    const p = booking.payment;
    if (!p) return null;
    const total = `Your trip total is ${formatMoney(p.total, p.currency)}`;
    const state = paymentState(p);
    const agency = booking.agency.name || 'your travel agent';
    if (state.kind === 'unknown') {
      return {
        text: `${total}. I can't see what has been paid so far — ${agency} can tell you.`,
        pills: agentPills(booking),
      };
    }
    if (state.kind === 'settled') {
      return { text: `${total}, and it is paid in full — nothing left to pay.`, pills: agentPills(booking) };
    }
    const owed = formatMoney(state.balance, state.currency);
    const next = state.nextPayment ? formatMoney(state.nextPayment, state.currency) : null;
    let when = '';
    if (state.dueNow) when = next ? `, with ${next} due now` : ', due now';
    else if (state.dueDate) {
      when = next ? `, with the next payment of ${next} due by ${formatDate(state.dueDate)}` : `, due by ${formatDate(state.dueDate)}`;
    }
    return {
      text: `${total}. There is ${owed} left to pay${when}. ${agency} can take a payment or answer any questions.`,
      pills: agentPills(booking),
    };
  }

  // ── Reaching the agency ──
  if (/\b(contact|phone|call|reach|emergency number for|out of hours)\b/.test(q) && /\b(agent|agency|you|travel company)\b/.test(q)) {
    const bits = [`${booking.agency.name}`];
    if (booking.agency.phone) bits.push(`on ${booking.agency.phone}`);
    if (booking.agency.emergencyPhone) bits.push(`out of hours ${booking.agency.emergencyPhone}`);
    if (booking.agency.email) bits.push(booking.agency.email);
    return { text: `${bits.join(', ')}.`, pills: agentPills(booking) };
  }

  // ── Disruption ──
  //
  // "My flight is cancelled, what do I do" was matching the flight-list branch
  // below and being answered with a timetable. Somebody standing at a departure
  // board needs a person, and we know which flights are theirs.
  if (/\b(cancel|cancelled|canceled|delayed|diverted|disrupt|strike|missed my flight|stranded)\b/.test(q) && asksFlight) {
    const contact = [
      booking.agency.emergencyPhone
        ? `${booking.agency.name} out of hours on ${booking.agency.emergencyPhone}`
        : booking.agency.phone
          ? `${booking.agency.name} on ${booking.agency.phone}`
          : booking.agency.name,
    ];
    return {
      text:
        `Speak to the airline desk first — they have to rebook you or refund you, and being at the desk early matters. Then tell ${contact[0]}, because anything else on your booking may need moving with it.\n\n` +
        `I am watching your flights, so if the status changes again you will get a notification without having to check.`,
      pills: agentPills(booking),
    };
  }

  // ── Flight number / airline, asked directly ──
  if (asksFlight && /\b(what|which|number|airline|carrier|who are we flying)\b/.test(q) && out) {
    const lines = booking.flights.map(
      (f) => `${f.carrierName} ${designator(f)}, ${f.depAirport}–${f.arrAirport}, ${formatDayMonth(f.depTime)} ${formatTime(f.depTime)}${f.cabin ? ` (${formatCabin(f.cabin).toLowerCase()})` : ''}`,
    );
    return { text: `Your flights — ${lines.join('; ')}.`, pills: ['How much luggage can I take?'] };
  }

  return null;
}

function agentPills(booking: Booking): string[] {
  const pills: string[] = [];
  if (booking.agency.email) pills.push('Email my agent');
  if (booking.agency.phone) pills.push('Call my agent');
  return pills;
}

/**
 * When nobody has the answer, at least say who does.
 *
 * Five of the twenty-four test questions are genuinely unanswerable from any
 * source we hold — a kids club, a cot, the wifi password, whether the hotel is
 * near the beach, changing a flight. Declining is right. Declining all five
 * with the same sentence is not: "I can't answer that one for certain" reads as
 * a shrug when the honest answer is "the hotel knows that, and here is what
 * your booking already says".
 *
 * Still invents nothing. It routes, and where the booking carries something
 * relevant — the special requests the agent already logged — it shows it.
 */
export function signpostAnswer(question: string, booking: Booking): BookingReply | null {
  const q = question.toLowerCase();
  const hotel = firstHotel(booking);

  // ── The hotel's to answer, not ours ──
  const hotelMatters =
    /\b(wifi|wi-fi|password|kids club|creche|crèche|babysit|cot|highchair|high chair|gym|spa|pool|safe in the room|iron|laundry|adaptor at the hotel|beach|sea view|balcony|air ?con)\b/.test(q);
  if (hotelMatters && hotel) {
    const bits = [
      `That one is ${hotel.name}'s to answer — facilities and room details are not on your booking, and I would rather point you at them than guess.`,
    ];
    if (hotel.specialRequests) {
      bits.push(`Your booking does note: "${hotel.specialRequests}".`);
    }
    bits.push(`${booking.agency.name} can ask them for you before you travel.`);
    return { text: bits.join(' '), pills: agentPills(booking) };
  }

  // ── Changing or cancelling anything ──
  if (/\b(change|amend|move|cancel|refund|upgrade|add)\b/.test(q) && /\b(flight|booking|hotel|room|date|name|holiday|trip)\b/.test(q)) {
    return {
      text:
        `Changes to a booking go through ${booking.agency.name} rather than through me — airlines and hotels charge differently for them and only your agent can see what your fare allows. ` +
        `Quote ${booking.reference} when you get in touch and they will have it all in front of them.`,
      pills: agentPills(booking),
    };
  }

  // ── Insurance and cover ──
  if (/\b(insurance|insured|cover|covered|claim|medical cover)\b/.test(q)) {
    const policy = booking.documents.find((d) => d.kind === 'insurance');
    return {
      text: policy
        ? `Your policy — ${policy.name} — is in Documents, and what is covered is in there rather than anywhere I can see. Worth downloading it before you fly so it is there without a signal.`
        : `There is no insurance document on your booking. If you arranged cover elsewhere, keep the policy number with you; if you did not, ${booking.agency.name} can usually still arrange it before you travel.`,
      pills: agentPills(booking),
    };
  }

  return null;
}
