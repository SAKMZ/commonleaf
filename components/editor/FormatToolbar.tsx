'use client';

import type { StateCommand } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  Bold,
  CircleHelp,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { insertDivider, insertTable } from '@/lib/editor/blocks';
import {
  insertLink,
  insertWikiLink,
  setHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from '@/lib/editor/commands';

/**
 * Formatting, for people who do not write Markdown.
 *
 * The editor already hides the syntax while you read it; this is the other
 * half — a way to *produce* the syntax without knowing it. Every button runs
 * the same `StateCommand` as the matching keyboard shortcut and the matching
 * slash-menu entry, so the three can never drift apart.
 *
 * It can be turned off in settings, because someone fluent in Markdown is
 * better served by the space.
 */

/** Lucide's icons and the hand-drawn one below both satisfy this. */
type ToolIcon = React.ComponentType<{ size?: number; className?: string }>;

interface Tool {
  readonly label: string;
  readonly icon: ToolIcon;
  readonly command: StateCommand;
  readonly shortcut?: string;
}

const GROUPS: readonly (readonly Tool[])[] = [
  [
    { label: 'Bold', icon: Bold, command: toggleWrap('**'), shortcut: 'Mod+B' },
    { label: 'Italic', icon: Italic, command: toggleWrap('*'), shortcut: 'Mod+I' },
    { label: 'Strikethrough', icon: Strikethrough, command: toggleWrap('~~') },
    { label: 'Code', icon: SquareCode, command: toggleWrap('`'), shortcut: 'Mod+E' },
  ],
  [
    { label: 'Large heading', icon: Heading1, command: setHeading(1), shortcut: 'Mod+1' },
    { label: 'Medium heading', icon: Heading2, command: setHeading(2), shortcut: 'Mod+2' },
    { label: 'Small heading', icon: Heading3, command: setHeading(3), shortcut: 'Mod+3' },
  ],
  [
    { label: 'Bulleted list', icon: List, command: toggleList('bullet') },
    { label: 'Numbered list', icon: ListOrdered, command: toggleList('number') },
    { label: 'Task list', icon: ListTodo, command: toggleList('task') },
    { label: 'Quote', icon: Quote, command: toggleQuote },
  ],
  [
    { label: 'Link', icon: LinkIcon, command: insertLink },
    {
      label: 'Link to another note',
      icon: BookLink,
      command: insertWikiLink,
      shortcut: 'Mod+Shift+K',
    },
    { label: 'Table', icon: Table, command: insertTable },
    { label: 'Divider', icon: Minus, command: insertDivider },
  ],
];

/** `[[ ]]`, drawn rather than approximated with an unrelated icon. */
function BookLink({ size = 16, ...props }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 4H6v16h3M15 4h3v16h-3" />
      <path d="M11 9h2M11 15h2M12 9v6" />
    </svg>
  );
}

export function FormatToolbar({
  view,
  onInsertImage,
}: {
  view: EditorView | null;
  /** Uploads a file and returns the path to reference it by. */
  onInsertImage: (file: File) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const run = (command: StateCommand) => {
    if (!view) return;
    command({ state: view.state, dispatch: (t) => view.dispatch(t) });
    // Focus goes straight back to the text: a toolbar is something you press
    // in passing, never somewhere you end up.
    view.focus();
  };

  return (
    /*
     * The strip scrolls sideways on a narrow screen, which means it also clips
     * anything positioned against it. The help card is therefore a sibling of
     * the scrolling row rather than a child of it.
     */
    <div className="format-bar no-print">
      <div className="format-toolbar" role="toolbar" aria-label="Formatting">
        {GROUPS.map((group, index) => (
          <div className="format-group" key={group[0].label}>
            {index > 0 && <span className="format-divider" aria-hidden="true" />}

            {group.map((tool) => (
              <button
                key={tool.label}
                type="button"
                className="format-button"
                // The tooltip carries the shortcut, which is how anyone ever
                // learns there is one.
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                aria-label={tool.label}
                disabled={!view}
                onClick={() => run(tool.command)}
              >
                <tool.icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        ))}

        <div className="format-group">
          <span className="format-divider" aria-hidden="true" />

          <button
            type="button"
            className="format-button"
            title="Insert a picture"
            aria-label="Insert a picture"
            disabled={!view}
            onClick={() => fileInput.current?.click()}
          >
            <ImageIcon size={16} aria-hidden="true" />
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            // Reachable by keyboard and by a screen reader even though the
            // button above is what people click.
            aria-label="Choose a picture to insert"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so that choosing the same file twice fires again.
              event.target.value = '';
              if (file) void onInsertImage(file);
            }}
          />

          <button
            type="button"
            className="format-button"
            title="What can I type?"
            aria-label="What can I type?"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          >
            <CircleHelp size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {helpOpen && <SyntaxHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

const HELP: readonly (readonly [string, string])[] = [
  ['/', 'Opens this list inside the note'],
  ['# Title', 'A heading — more hashes, smaller heading'],
  ['**bold**', 'Bold'],
  ['*italic*', 'Italic'],
  ['- item', 'A bulleted list'],
  ['1. item', 'A numbered list'],
  ['- [ ] task', 'Something to tick off'],
  ['> quote', 'A quotation'],
  ['[[Note name]]', 'A link to another note'],
  ['[text](url)', 'A link to a web page'],
  ['`code`', 'Code, kept exactly as typed'],
  ['#tag', 'A tag, anywhere in the text'],
  ['---', 'A divider between sections'],
];

/**
 * The short version of the syntax.
 *
 * Deliberately not a link to a manual: someone who does not know Markdown will
 * not read a manual, and everything they actually need fits in one card.
 */
function SyntaxHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="format-help" role="dialog" aria-label="What can I type?">
      <p className="text-ink-muted mb-3 text-sm italic">
        You never have to type any of this — the toolbar and the <code>/</code> menu do it for
        you. It is here for when it is quicker.
      </p>

      <dl className="format-help-list">
        {HELP.map(([syntax, meaning]) => (
          <div key={syntax}>
            <dt>
              <code>{syntax}</code>
            </dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>

      <button type="button" className="text-ink-faint mt-4 text-sm underline" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
