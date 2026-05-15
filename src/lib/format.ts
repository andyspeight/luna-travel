/**
 * Formatting helpers — port of widget-mybooking v1.4.1 conventions.
 *
 * Rule 8 (Supplier Data Integrity, travelgenix-security skill):
 *  - Never invent a fallback when a supplier field is missing.
 *  - Board basis mapped through a strict whitelist; unknown enums fall back
 *    to the raw string rather than a fabricated default.
 *  - Returning null/undefined is correct — the UI hides the line.
 */

import type { BoardBasis, FlightCabin, TripStartEvent } from '@/types/booking';

const BOARD_LABELS: Record<BoardBasis, string> = {
  RoomOnly: 'Room only',
  SelfCatering: 'Self catering',
  BedAndBreakfast: 'Bed & breakfast',
  HalfBoard: 'Half board',
  HalfBoardPlus: 'Half board plus',
  FullBoard: 'Full board',
  FullBoardPlus: 'Full board plus',
  AllInclusive: 'All inclusive',
  AllInclusivePlus: 'All inclusive plus',
  UltraAllInclusive: 'Ultra all inclusive',
};

const CABIN_LABELS: Record<FlightCabin, string> = {
  Economy: 'Economy',
  PremiumEconomy: 'Premium Economy',
  Business: 'Business',
  First: 'First',
};

export function formatBoard(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.toLowerCase() === 'unknown') return null;
  if (Object.prototype.hasOwnProperty.call(BOARD_LABELS, v)) {
    return BOARD_LABELS[v as BoardBasis];
  }
  return v; // fall back to raw rather than invent
}

export function formatCabin(raw: FlightCabin): string {
  return CABIN_LABELS[raw] ?? raw;
}

export function formatMoney(amount: number, currency: string = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDayMonth(iso: string): string {
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

export function formatWeekday(iso: string): string {
  return formatDate(iso, { weekday: 'short' });
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Terminal label that handles both number ("3") and name ("South", "North") variants.
 * Numbers get the "T" prefix (T3); names stay as written (South).
 * Empty / missing values return empty string, so the UI can drop the line entirely.
 */
export function formatTerminal(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  const v = raw.trim();
  if (!v) return '';
  return /^\d+$/.test(v) ? `T${v}` : v;
}

export function formatDuration(mins: number): string {
  if (typeof mins !== 'number' || !Number.isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function initials(first: string, last: string): string {
  const a = (first || '').trim();
  const b = (last || '').trim();
  return ((a[0] || '') + (b[0] || '')).toUpperCase() || '?';
}

export function fileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Countdown copy is context-aware (widget-mybooking v1.4.1):
 * - "until you fly"      → trip starts with a flight
 * - "until you check in" → accommodation-only start
 * - "until you travel"   → other (airport extras only)
 */
export function countdownLabel(event: TripStartEvent): string {
  switch (event) {
    case 'flight':
      return 'until you fly';
    case 'check-in':
      return 'until you check in';
    default:
      return 'until you travel';
  }
}

export function daysUntil(iso: string): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownTo(iso: string, now: number = Date.now()): CountdownParts {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const ms = Math.max(0, d.getTime() - now);
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}
