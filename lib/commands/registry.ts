import {
  CalendarDays,
  Contrast,
  History,
  Home,
  Palette,
  PanelLeft,
  Pencil,
  Settings as SettingsIcon,
  Shuffle,
  Sparkles,
  Star,
  Tags,
  Unlink,
} from 'lucide-react';

import { routes } from '../notes/links';
import { themes } from '../theme/themes';
import type { Command, CommandContext } from './types';

/**
 * Every command, in the order the palette shows them.
 *
 * Two rules keep this list honest. Nothing here opens a second dialog — a
 * command either acts or navigates, because a palette that asks a follow-up
 * question is a menu wearing a disguise. And nothing here is destructive:
 * deleting a note is deliberate work that belongs on the page it affects, not
 * one fuzzy match away from "daily".
 */
export function buildCommands(context: CommandContext): Command[] {
  const { navigate, currentSlug, settings, update, today } = context;

  const commands: Command[] = [
    {
      id: 'daily.today',
      title: "Today's note",
      hint: 'Open or start the entry for today',
      group: 'Notebook',
      icon: CalendarDays,
      keywords: 'journal diary daily',
      run: () => navigate(routes.daily(today())),
    },
    {
      id: 'note.random',
      title: 'Random note',
      hint: 'Reread something you had forgotten',
      group: 'Notebook',
      icon: Shuffle,
      keywords: 'shuffle surprise',
      run: () => navigate(routes.random),
    },
    {
      id: 'go.home',
      title: 'The library',
      group: 'Go to',
      icon: Home,
      keywords: 'index home recent',
      run: () => navigate(routes.home),
    },
    {
      id: 'go.favorites',
      title: 'Favourites',
      group: 'Go to',
      icon: Star,
      keywords: 'starred saved',
      run: () => navigate(routes.favorites),
    },
    {
      id: 'go.tags',
      title: 'All tags',
      group: 'Go to',
      icon: Tags,
      run: () => navigate(routes.tags),
    },
    {
      id: 'go.unwritten',
      title: 'Unwritten notes',
      hint: 'Links pointing at notes that do not exist yet',
      group: 'Go to',
      icon: Unlink,
      keywords: 'missing broken orphan todo',
      run: () => navigate(routes.unwritten),
    },
    {
      id: 'go.settings',
      title: 'Settings',
      group: 'Go to',
      icon: SettingsIcon,
      keywords: 'preferences options',
      run: () => navigate(routes.settings),
    },
  ];

  // Commands that only mean something while a note is on screen.
  if (currentSlug) {
    commands.unshift(
      {
        id: 'note.edit',
        title: 'Edit this note',
        group: 'Notebook',
        icon: Pencil,
        keywords: 'write change',
        run: () => navigate(routes.edit(currentSlug)),
      },
      {
        id: 'note.history',
        title: 'History of this note',
        hint: 'Every version, from the Git log',
        group: 'Notebook',
        icon: History,
        keywords: 'versions revisions git log',
        run: () => navigate(routes.history(currentSlug)),
      },
    );
  }

  commands.push(
    {
      id: 'view.sidebar',
      title: settings.sidebar ? 'Hide the index' : 'Show the index',
      group: 'Appearance',
      icon: PanelLeft,
      keywords: 'sidebar panel toggle',
      run: () => update({ sidebar: !settings.sidebar }),
    },
    {
      id: 'view.contrast',
      title: settings.highContrast ? 'Normal contrast' : 'High contrast',
      group: 'Appearance',
      icon: Contrast,
      keywords: 'accessibility legibility',
      run: () => update({ highContrast: !settings.highContrast }),
    },
    {
      id: 'view.animations',
      title: settings.animations ? 'Turn off motion' : 'Turn on motion',
      group: 'Appearance',
      icon: Sparkles,
      keywords: 'animation reduced motion',
      run: () => update({ animations: !settings.animations }),
    },
    // One entry per theme rather than a "change theme" command that opens a
    // second list: typing "dark" should land on dark paper in one step.
    ...themes.map((theme): Command => ({
      id: `theme.${theme.id}`,
      title: `Paper: ${theme.label}`,
      group: 'Appearance',
      icon: Palette,
      keywords: `theme colour color ${theme.mode}`,
      run: () => update({ theme: theme.id }),
    })),
    {
      id: 'theme.system',
      title: 'Paper: follow the system',
      group: 'Appearance',
      icon: Palette,
      keywords: 'theme auto dark light system',
      run: () => update({ theme: 'system' }),
    },
  );

  return commands;
}

/**
 * Ranks commands against what has been typed.
 *
 * Deliberately not Fuse: a command list is a few dozen entries the reader is
 * choosing from a known set, where substring matching is predictable and
 * fuzziness mostly produces surprises. Search over *notes* is the opposite
 * problem, and that is where Fuse earns its place.
 */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...commands];

  const scored: Array<{ command: Command; score: number }> = [];

  for (const command of commands) {
    const title = command.title.toLowerCase();
    const haystack = `${title} ${command.hint ?? ''} ${command.keywords ?? ''}`.toLowerCase();

    // Title beats hint beats keyword, and a prefix beats a match in the middle.
    const score = title.startsWith(needle)
      ? 3
      : title.includes(needle)
        ? 2
        : haystack.includes(needle)
          ? 1
          : 0;

    if (score > 0) scored.push({ command, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.command);
}
