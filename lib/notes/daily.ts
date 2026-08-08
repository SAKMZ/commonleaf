import { addDays, formatDate, parseDate, toIsoDate } from './dates';
import { DAILY_FOLDER, baseNameOf, folderOf } from './paths';

/**
 * Daily notes.
 *
 * One file per day, named `YYYY-MM-DD.md`, which sorts correctly everywhere
 * and needs no index to find. Everything here is pure and works from a `Date`
 * supplied by the caller: "today" depends on the reader's timezone, which the
 * server does not know, so the browser decides what today is and asks for that
 * date by name.
 */

const DAILY_NAME = /^\d{4}-\d{2}-\d{2}$/;

export function dailySlug(date: Date | string): string {
  const iso = typeof date === 'string' ? date : toIsoDate(date);
  return `${DAILY_FOLDER}/${iso}`;
}

export function isDailySlug(slug: string): boolean {
  return folderOf(slug) === DAILY_FOLDER && DAILY_NAME.test(baseNameOf(slug));
}

/** The date a daily note is for, or `null` if it is not a daily note. */
export function dateOfDailySlug(slug: string): Date | null {
  return isDailySlug(slug) ? parseDate(baseNameOf(slug)) : null;
}

export type DailyShortcut = 'yesterday' | 'today' | 'tomorrow';

export function shortcutDate(shortcut: DailyShortcut, today = new Date()): Date {
  switch (shortcut) {
    case 'yesterday':
      return addDays(today, -1);
    case 'tomorrow':
      return addDays(today, 1);
    case 'today':
      return today;
  }
}

/**
 * The starting text of a new daily note.
 *
 * Empty. The date is already the note's title, so a heading repeating it would
 * appear twice on the page — and a daily note that arrives full of prompts and
 * empty sections is a chore, where a blank page is an invitation.
 */
export function dailyTemplate(): string {
  return '';
}

/** The title stored in a daily note's frontmatter. */
export function dailyTitle(date: Date, pattern = 'D MMMM YYYY'): string {
  return formatDate(date, pattern);
}

/** Neighbouring days, for the previous and next arrows on a daily note. */
export function adjacentDailySlugs(date: Date): { previous: string; next: string } {
  return {
    previous: dailySlug(addDays(date, -1)),
    next: dailySlug(addDays(date, 1)),
  };
}
