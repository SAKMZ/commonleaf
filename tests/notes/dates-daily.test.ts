import { describe, expect, it } from 'vitest';

import {
  adjacentDailySlugs,
  dailySlug,
  dailyTitle,
  dateOfDailySlug,
  isDailySlug,
  shortcutDate,
} from '@/lib/notes/daily';
import { addDays, formatDate, parseDate, relativeDate, toIsoDate } from '@/lib/notes/dates';

describe('parseDate', () => {
  it('reads a bare date as local, not as UTC midnight', () => {
    const date = parseDate('2026-08-07')!;

    // Read back in local time it must still be the 7th, whatever the timezone.
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(7);
  });

  it('reads a full timestamp', () => {
    expect(parseDate('2026-08-07T09:30:00Z')?.toISOString()).toBe('2026-08-07T09:30:00.000Z');
  });

  it('returns null for nonsense', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('formatDate', () => {
  const date = '2026-08-07';

  it('supports the offered patterns', () => {
    expect(formatDate(date, 'D MMMM YYYY')).toBe('7 August 2026');
    expect(formatDate(date, 'MMMM D, YYYY')).toBe('August 7, 2026');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-08-07');
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('07/08/2026');
    expect(formatDate(date, 'ddd, D MMM YYYY')).toBe('Fri, 7 Aug 2026');
  });

  it('leaves unknown characters untouched', () => {
    expect(formatDate(date, 'on D MMMM')).toBe('on 7 August');
  });

  it('returns an empty string rather than "Invalid Date"', () => {
    expect(formatDate('not a date')).toBe('');
  });
});

describe('relativeDate', () => {
  const now = new Date(2026, 7, 7);

  it('names the days around today', () => {
    expect(relativeDate('2026-08-07', now)).toBe('Today');
    expect(relativeDate('2026-08-06', now)).toBe('Yesterday');
    expect(relativeDate('2026-08-08', now)).toBe('Tomorrow');
  });

  it('counts days, then weeks', () => {
    expect(relativeDate('2026-08-04', now)).toBe('3 days ago');
    expect(relativeDate('2026-07-31', now)).toBe('Last week');
    expect(relativeDate('2026-07-20', now)).toBe('2 weeks ago');
  });

  it('falls back to a date beyond a month', () => {
    expect(relativeDate('2026-05-01', now)).toBe('1 May 2026');
  });
});

describe('toIsoDate', () => {
  it('formats in local time so the day never slips', () => {
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(toIsoDate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(toIsoDate(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  it('does not mutate its argument', () => {
    const original = new Date(2026, 0, 1);
    addDays(original, 5);

    expect(toIsoDate(original)).toBe('2026-01-01');
  });
});

describe('daily notes', () => {
  const date = new Date(2026, 7, 7);

  it('names a note for its date', () => {
    expect(dailySlug(date)).toBe('daily/2026-08-07');
    expect(dailySlug('2026-08-07')).toBe('daily/2026-08-07');
  });

  it('recognises its own slugs and rejects others', () => {
    expect(isDailySlug('daily/2026-08-07')).toBe(true);
    expect(isDailySlug('daily/notes')).toBe(false);
    expect(isDailySlug('journal/2026-08-07')).toBe(false);
    expect(isDailySlug('daily/nested/2026-08-07')).toBe(false);
  });

  it('reads the date back out of a slug', () => {
    expect(toIsoDate(dateOfDailySlug('daily/2026-08-07')!)).toBe('2026-08-07');
    expect(dateOfDailySlug('books/one')).toBeNull();
  });

  it('resolves the shortcuts against a given day', () => {
    expect(toIsoDate(shortcutDate('today', date))).toBe('2026-08-07');
    expect(toIsoDate(shortcutDate('yesterday', date))).toBe('2026-08-06');
    expect(toIsoDate(shortcutDate('tomorrow', date))).toBe('2026-08-08');
  });

  it('links to the neighbouring days', () => {
    expect(adjacentDailySlugs(date)).toEqual({
      previous: 'daily/2026-08-06',
      next: 'daily/2026-08-08',
    });
  });

  it('titles a daily note with its date', () => {
    expect(dailyTitle(date)).toBe('7 August 2026');
  });
});
