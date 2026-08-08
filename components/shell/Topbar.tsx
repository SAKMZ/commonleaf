'use client';

import {
  CalendarDays,
  PanelLeft,
  PenLine,
  Search,
  Settings as SettingsIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useModifierLabel } from '@/hooks/useModifierLabel';
import { useSettings } from '@/hooks/useSettings';
import { toIsoDate } from '@/lib/notes/dates';
import { routes } from '@/lib/notes/links';
import { openPalette } from '@/lib/palette/store';

/**
 * The strip above the page.
 *
 * Everything here is also reachable from the palette; the bar exists for the
 * few things worth doing without learning a shortcut first — find something,
 * write today's entry, and change how the page looks.
 */
export function Topbar({
  drawerOpen,
  onToggleDrawer,
}: {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const { settings, update } = useSettings();

  return (
    <header className="shell-bar no-print">
      {/*
       * Two buttons rather than one that behaves differently by viewport: on a
       * narrow screen the index is a drawer that opens and shuts, on a wide one
       * it is a preference that persists. CSS decides which is shown.
       */}
      <button
        type="button"
        className="shell-action lg:hidden"
        aria-expanded={drawerOpen}
        aria-controls="notebook-index"
        onClick={onToggleDrawer}
      >
        <PanelLeft size={17} aria-hidden="true" />
        <span className="sr-only">{drawerOpen ? 'Hide the index' : 'Show the index'}</span>
      </button>

      <button
        type="button"
        className="shell-action hidden lg:inline-flex"
        aria-pressed={settings.sidebar}
        onClick={() => update({ sidebar: !settings.sidebar })}
      >
        <PanelLeft size={17} aria-hidden="true" />
        <span className="sr-only">
          {settings.sidebar ? 'Hide the index' : 'Show the index'}
        </span>
      </button>

      <SearchTrigger />

      <NewNoteButton />

      <TodayButton />

      <Link href={routes.settings} className="shell-action" title="Settings">
        <SettingsIcon size={17} aria-hidden="true" />
        <span className="sr-only">Settings</span>
      </Link>
    </header>
  );
}

/**
 * Looks like a search field but is a button.
 *
 * Typing belongs in the palette; a real input here would mean two places to
 * type and a decision about which one owns the query.
 */
function SearchTrigger() {
  const modifier = useModifierLabel();

  return (
    <button
      type="button"
      className="shell-action border-rule text-ink-faint hover:border-ink-faint mx-1 min-w-0 flex-1 justify-start border sm:max-w-sm"
      onClick={() => openPalette('search')}
    >
      <Search size={15} aria-hidden="true" />
      <span className="truncate">Search the notebook…</span>
      <kbd className="palette-key ms-auto hidden sm:inline">{modifier} K</kbd>
    </button>
  );
}

/**
 * Starting a note.
 *
 * Opens the palette rather than creating anything itself: a note needs a name
 * before it can be a file, and the palette is already the one place in the app
 * that takes a title and turns it into a note. Two ways in, one implementation.
 */
function NewNoteButton() {
  return (
    <button
      type="button"
      className="shell-action shell-action-primary"
      title="Write a new note"
      onClick={() => openPalette('create')}
    >
      <PenLine size={17} aria-hidden="true" />
      <span className="hidden text-sm sm:inline">New note</span>
      <span className="sr-only sm:hidden">Write a new note</span>
    </button>
  );
}

/**
 * Today's entry.
 *
 * A button rather than a link because the date is read at the moment of the
 * click: the server is in whatever timezone it happens to be in, and a link
 * rendered at midnight would point at yesterday.
 */
function TodayButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="shell-action"
      title="Today's note"
      onClick={() => router.push(routes.daily(toIsoDate(new Date())))}
    >
      <CalendarDays size={17} aria-hidden="true" />
      <span className="sr-only">Today&rsquo;s note</span>
    </button>
  );
}
