import type { LucideIcon } from 'lucide-react';

import type { Settings } from '../settings/types';

/**
 * One thing the reader can ask the application to do.
 *
 * Commands are plain data with a `run` function, which is what lets the same
 * list drive the palette today and a menu, a shortcut table or a plugin API
 * later. Nothing here knows about React.
 */
export interface Command {
  /** Stable across releases: a shortcut or a plugin may refer to it. */
  readonly id: string;
  readonly title: string;
  /** Shown after the title, in lighter ink. */
  readonly hint?: string;
  readonly group: string;
  readonly icon: LucideIcon;
  /** Extra words that should match this command when typed. */
  readonly keywords?: string;
  run(): void | Promise<void>;
}

/**
 * What commands are allowed to reach.
 *
 * Passing these in rather than importing them keeps `registry.ts` free of
 * React, of the router and of `window`, so the list of commands can be built
 * and asserted on in a test.
 */
export interface CommandContext {
  navigate(href: string): void;
  /** The note being read or edited, when there is one. */
  readonly currentSlug: string | null;
  readonly settings: Settings;
  update(changes: Partial<Settings>): void;
  /** Today's date where the reader is, as `YYYY-MM-DD`. */
  today(): string;
}
