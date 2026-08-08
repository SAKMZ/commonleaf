/**
 * Dates, formatted the same way on the server and in the browser.
 *
 * `Intl` would be the obvious tool, but it resolves month names against the
 * host locale — which differs between the server that renders a page and the
 * browser that hydrates it, producing a mismatch. A small fixed table is
 * deterministic, has no dependency, and is easy to extend if the project is
 * ever translated.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Patterns offered in settings. Any combination of the tokens below works. */
export const DATE_FORMATS = [
  'D MMMM YYYY',
  'MMMM D, YYYY',
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'ddd, D MMM YYYY',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a stored date.
 *
 * A bare `YYYY-MM-DD` is read as a local date rather than as UTC midnight —
 * otherwise a note written on the 7th shows as the 6th for anyone west of
 * Greenwich, which is the kind of bug that quietly annoys people for years.
 */
export function parseDate(value: string): Date | null {
  if (value === '') return null;

  const iso = ISO_DATE.exec(value);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const TOKENS = /YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|mm/g;

export function formatDate(value: string | Date, pattern = 'D MMMM YYYY'): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';

  const pad = (number: number) => String(number).padStart(2, '0');

  return pattern.replace(TOKENS, (token) => {
    switch (token) {
      case 'YYYY':
        return String(date.getFullYear());
      case 'YY':
        return pad(date.getFullYear() % 100);
      case 'MMMM':
        return MONTHS[date.getMonth()];
      case 'MMM':
        return MONTHS[date.getMonth()].slice(0, 3);
      case 'MM':
        return pad(date.getMonth() + 1);
      case 'M':
        return String(date.getMonth() + 1);
      case 'DD':
        return pad(date.getDate());
      case 'D':
        return String(date.getDate());
      case 'dddd':
        return WEEKDAYS[date.getDay()];
      case 'ddd':
        return WEEKDAYS[date.getDay()].slice(0, 3);
      case 'HH':
        return pad(date.getHours());
      case 'mm':
        return pad(date.getMinutes());
      default:
        return token;
    }
  });
}

/** `YYYY-MM-DD` in the given date's own timezone. */
export function toIsoDate(date: Date): string {
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * A timestamp for the `updated` field.
 *
 * Stored in UTC so that a vault edited from two timezones stays sortable.
 */
export function nowTimestamp(): string {
  return new Date().toISOString();
}

/** "3 days ago", for note lists. Falls back to a date beyond a month. */
export function relativeDate(value: string | Date, now = new Date(), pattern?: string): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';

  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  if (days > 1 && days < 7) return `${days} days ago`;
  if (days >= 7 && days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Last week' : `${weeks} weeks ago`;
  }

  return formatDate(date, pattern);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
