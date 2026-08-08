'use client';

import { FileText, Plus, type LucideIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { useModifierLabel } from '@/hooks/useModifierLabel';
import { usePalette } from '@/hooks/usePalette';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api/client';
import { buildCommands, filterCommands } from '@/lib/commands/registry';
import { isTypingTarget, matchesShortcut, SHORTCUTS } from '@/lib/keyboard';
import { toIsoDate } from '@/lib/notes/dates';
import { routes, slugFromPathname } from '@/lib/notes/links';
import { closePalette, togglePalette, type PaletteMode } from '@/lib/palette/store';
import { loadSearcher } from '@/lib/search/cache';
import type { SearchDocument } from '@/lib/search/documents';

/** How many notes are worth offering before the list becomes a chore to read. */
const NOTE_LIMIT = 7;

interface PaletteItem {
  readonly id: string;
  readonly title: string;
  readonly hint?: string;
  readonly group: string;
  readonly icon: LucideIcon;
  run(): void | Promise<void>;
}

/**
 * Find anything, do anything.
 *
 * Mounted once by the shell and closed almost all of the time, so the work —
 * fetching the index, loading Fuse — happens on first open rather than on
 * first paint. The two shortcuts differ only in what is offered first: ⌘K
 * leads with notes, ⌘⇧P with actions.
 */
export function CommandPalette() {
  const { open, mode } = usePalette();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Inside the palette's own input the shortcut still toggles, which is
      // how ⌘K closes it again; anywhere else, typing wins.
      const typing = isTypingTarget(event.target) && !isPaletteInput(event.target);

      if (matchesShortcut(event, SHORTCUTS.search)) {
        event.preventDefault();
        togglePalette('search');
      } else if (matchesShortcut(event, SHORTCUTS.commands)) {
        event.preventDefault();
        togglePalette('commands');
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        togglePalette('search');
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Remounted on every open so the query, the selection and the focus all
  // start clean without a single line resetting them.
  return open ? <Palette key={mode} mode={mode} /> : null;
}

function isPaletteInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.classList.contains('palette-input');
}

function Palette({ mode }: { mode: PaletteMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings, update } = useSettings();
  const modifier = useModifierLabel();

  const [query, setQuery] = useState('');
  /**
   * The chosen row, held by id rather than by position.
   *
   * Results arrive after the index has been fetched, so the list can grow
   * under the cursor between a keystroke and an arrow key. An index would then
   * point at a different row than the one highlighted when it was pressed;
   * an id cannot. `null` means "the first row, whatever that turns out to be".
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<readonly SearchDocument[]>([]);
  const [indexState, setIndexState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Command mode has nothing to fetch, so it is never waiting on anything.
  const status = mode === 'commands' ? 'ready' : indexState;

  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () =>
      buildCommands({
        navigate: (href) => router.push(href),
        currentSlug: slugFromPathname(pathname),
        settings,
        update,
        today: () => toIsoDate(new Date()),
      }),
    [router, pathname, settings, update],
  );

  /**
   * Notes matching the query.
   *
   * The searcher is loaded once and shared; the request is only cancelled in
   * the sense that a late reply is ignored, because the fetch itself is
   * already in flight for everyone.
   */
  useEffect(() => {
    if (mode !== 'search') return;
    let current = true;

    loadSearcher()
      .then((searcher) => {
        if (!current) return;
        setNotes(searcher.search(query, NOTE_LIMIT));
        setIndexState('ready');
      })
      .catch(() => {
        if (current) setIndexState('failed');
      });

    return () => {
      current = false;
    };
  }, [mode, query]);

  const items = useMemo(
    () => buildItems({ mode, query, notes, commands, router }),
    [mode, query, notes, commands, router],
  );

  // Falls back to the first row when the selected one is gone — or was never
  // chosen, which is the case every time the query changes.
  const found = items.findIndex((item) => item.id === selectedId);
  const active = found === -1 ? 0 : found;

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const move = (offset: number) => {
    if (items.length === 0) return;
    setSelectedId(items[(active + offset + items.length) % items.length].id);
  };

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    closePalette();
    void item.run();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Enter':
        event.preventDefault();
        choose(items[active]);
        break;
      case 'Escape':
        event.preventDefault();
        closePalette();
        break;
      case 'Tab':
        // Nothing else in the palette is focusable, so Tab would leave it.
        event.preventDefault();
        break;
    }
  };

  return (
    <div
      className="palette-backdrop no-print"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div className="palette">
        <input
          // The palette exists to be typed into, and Tab is trapped below, so
          // the input keeps focus for as long as it is open. Every key is
          // handled here rather than on a wrapper.
          autoFocus
          onKeyDown={onKeyDown}
          className="palette-input"
          type="text"
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={items[active] ? `palette-option-${active}` : undefined}
          aria-label={mode === 'search' ? 'Search the notebook' : 'Run a command'}
          placeholder={
            mode === 'search' ? 'Search notes, or type to create one…' : 'Run a command…'
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId(null);
          }}
        />

        <div className="palette-results" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 ? (
            <p className="palette-empty">
              {status === 'failed'
                ? 'The search index could not be loaded.'
                : status === 'loading'
                  ? 'Reading the notebook…'
                  : 'Nothing matches.'}
            </p>
          ) : (
            items.map((item, index) => (
              <Fragment key={item.id}>
                {item.group !== items[index - 1]?.group && (
                  <div className="palette-group">{item.group}</div>
                )}
                <Option
                  item={item}
                  index={index}
                  selected={index === active}
                  onHover={() => setSelectedId(item.id)}
                  onChoose={() => choose(item)}
                />
              </Fragment>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span>
            <kbd className="palette-key">↑↓</kbd> move
          </span>
          <span>
            <kbd className="palette-key">↵</kbd> open
          </span>
          <span className="ms-auto">
            <kbd className="palette-key">{modifier} ⇧ P</kbd> commands
          </span>
        </div>
      </div>
    </div>
  );
}

function Option({
  item,
  index,
  selected,
  onHover,
  onChoose,
}: {
  item: PaletteItem;
  index: number;
  selected: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const Icon = item.icon;

  return (
    <div
      id={`palette-option-${index}`}
      role="option"
      aria-selected={selected}
      data-index={index}
      data-selected={selected}
      className="palette-option"
      onMouseMove={onHover}
      onClick={onChoose}
    >
      <Icon size={15} className="palette-icon" aria-hidden="true" />
      <span className="palette-option-text">
        <span className="palette-option-title">{item.title}</span>
        {item.hint && <span className="palette-option-hint block">{item.hint}</span>}
      </span>
    </div>
  );
}

/**
 * Assembles what the list shows.
 *
 * In search mode notes come first, then a way to write the note you were
 * looking for and could not find, then any actions whose names match. That
 * order is the answer to "I pressed ⌘K, what did I want?" almost every time.
 */
function buildItems({
  mode,
  query,
  notes,
  commands,
  router,
}: {
  mode: PaletteMode;
  query: string;
  notes: readonly SearchDocument[];
  commands: ReturnType<typeof buildCommands>;
  router: ReturnType<typeof useRouter>;
}): PaletteItem[] {
  const trimmed = query.trim();

  // An empty search shows the notebook, not the whole command list — the
  // actions are there for someone who has started typing a verb.
  const matching =
    mode === 'search' && trimmed === ''
      ? []
      : filterCommands(commands, query).map((command): PaletteItem => ({
          id: command.id,
          title: command.title,
          hint: command.hint,
          group: command.group,
          icon: command.icon,
          run: command.run,
        }));

  if (mode === 'commands') return matching;

  const items: PaletteItem[] = notes.map((note) => ({
    id: `note:${note.slug}`,
    title: note.title,
    hint: note.folder || note.excerpt,
    group: trimmed === '' ? 'Recently written' : 'Notes',
    icon: FileText,
    run: () => router.push(routes.note(note.slug)),
  }));

  const exists = notes.some((note) => note.title.toLowerCase() === trimmed.toLowerCase());

  if (trimmed !== '' && !exists) {
    items.push({
      id: 'create',
      title: `Create “${trimmed}”`,
      hint: 'A new note, filed where you type it',
      group: 'Write',
      icon: Plus,
      run: async () => {
        const result = await api.createNote({ title: trimmed });
        router.push(routes.note(result.slug));
      },
    });
  }

  return [...items, ...matching];
}
