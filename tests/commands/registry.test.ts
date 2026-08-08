import { describe, expect, it, vi } from 'vitest';

import { buildCommands, filterCommands } from '@/lib/commands/registry';
import type { CommandContext } from '@/lib/commands/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/types';

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    navigate: vi.fn(),
    currentSlug: null,
    settings: DEFAULT_SETTINGS,
    update: vi.fn(),
    today: () => '2026-08-07',
    ...overrides,
  };
}

describe('buildCommands', () => {
  it('gives every command a unique id', () => {
    const ids = buildCommands(context({ currentSlug: 'a/b' })).map((command) => command.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers note commands only while a note is on screen', () => {
    const without = buildCommands(context()).map((command) => command.id);
    const with_ = buildCommands(context({ currentSlug: 'philosophy/stoicism' })).map(
      (command) => command.id,
    );

    expect(without).not.toContain('note.edit');
    expect(with_).toContain('note.edit');
    expect(with_).toContain('note.history');
  });

  it('sends the reader to the note being read, not to a fixed URL', () => {
    const navigate = vi.fn();
    const commands = buildCommands(context({ currentSlug: 'books/atomic habits', navigate }));

    commands.find((command) => command.id === 'note.edit')?.run();

    expect(navigate).toHaveBeenCalledWith('/edit/books/atomic%20habits');
  });

  it("asks for today's date at the moment it is run", () => {
    const navigate = vi.fn();
    const today = vi.fn(() => '2026-12-25');

    buildCommands(context({ navigate, today }))
      .find((command) => command.id === 'daily.today')
      ?.run();

    expect(navigate).toHaveBeenCalledWith('/daily?date=2026-12-25');
  });

  it('names the toggles after what pressing them will do', () => {
    const shown = buildCommands(context({ settings: { ...DEFAULT_SETTINGS, sidebar: true } }));
    const hidden = buildCommands(
      context({ settings: { ...DEFAULT_SETTINGS, sidebar: false } }),
    );

    expect(shown.find((command) => command.id === 'view.sidebar')?.title).toBe(
      'Hide the index',
    );
    expect(hidden.find((command) => command.id === 'view.sidebar')?.title).toBe(
      'Show the index',
    );
  });

  it('offers every theme directly, so choosing one is a single step', () => {
    const ids = buildCommands(context()).map((command) => command.id);

    expect(ids).toContain('theme.classic-ivory');
    expect(ids).toContain('theme.dark-library');
    expect(ids).toContain('theme.system');
  });

  it('never offers anything that deletes', () => {
    const titles = buildCommands(context({ currentSlug: 'a' })).map((command) =>
      command.title.toLowerCase(),
    );

    expect(titles.some((title) => title.includes('delete'))).toBe(false);
  });
});

describe('filterCommands', () => {
  const commands = buildCommands(context());

  it('returns everything for an empty query', () => {
    expect(filterCommands(commands, '   ')).toHaveLength(commands.length);
  });

  it('ranks a title prefix above a match in the middle', () => {
    const results = filterCommands(commands, 'ran');

    expect(results[0].id).toBe('note.random');
  });

  it('matches keywords that do not appear in the title', () => {
    const results = filterCommands(commands, 'diary');

    expect(results.map((command) => command.id)).toContain('daily.today');
  });

  it('ignores case', () => {
    expect(filterCommands(commands, 'SETTINGS').map((command) => command.id)).toContain(
      'go.settings',
    );
  });

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(commands, 'xyzzy')).toEqual([]);
  });
});
