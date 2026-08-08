import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import type { StateCommand } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

import { insertCallout, insertCodeBlock, insertDivider, insertTable } from './blocks';
import {
  insertLink,
  insertWikiLink,
  setHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from './commands';

/**
 * What you get when you type `/` or `[[`.
 *
 * Both are built on CodeMirror's own autocompletion rather than a hand-rolled
 * popup. That brings the filtering, the keyboard handling and the positioning
 * with it — and, more importantly, means there is one menu in the editor
 * instead of two that behave almost the same.
 *
 * This is the main answer to "I do not know Markdown": every block a note can
 * contain is reachable by typing a slash and reading a list of plain English.
 */

/** The text a note is made of. */
export interface BlockOption {
  readonly label: string;
  readonly detail: string;
  readonly command: StateCommand;
}

export const BLOCKS: readonly BlockOption[] = [
  { label: 'Heading 1', detail: 'Big section title', command: setHeading(1) },
  { label: 'Heading 2', detail: 'Section title', command: setHeading(2) },
  { label: 'Heading 3', detail: 'Smaller title', command: setHeading(3) },
  { label: 'Bulleted list', detail: 'A list of points', command: toggleList('bullet') },
  { label: 'Numbered list', detail: 'A list in order', command: toggleList('number') },
  { label: 'Task list', detail: 'Things to tick off', command: toggleList('task') },
  { label: 'Quote', detail: 'Someone else’s words', command: toggleQuote },
  { label: 'Bold', detail: 'Heavier text', command: toggleWrap('**') },
  { label: 'Italic', detail: 'Slanted text', command: toggleWrap('*') },
  { label: 'Link', detail: 'A link to a web page', command: insertLink },
  { label: 'Note link', detail: 'A link to another note', command: insertWikiLink },
  { label: 'Code block', detail: 'Code, kept as typed', command: insertCodeBlock },
  { label: 'Divider', detail: 'A line between sections', command: insertDivider },
  { label: 'Table', detail: 'Rows and columns', command: insertTable },
  { label: 'Callout', detail: 'A highlighted aside', command: insertCallout },
];

/**
 * Runs a command in place of inserting text.
 *
 * The typed `/query` is removed first, in its own transaction, so the command
 * afterwards sees a line exactly as if it had been invoked from the toolbar.
 */
function replaceWith(command: StateCommand) {
  return (view: EditorView, _completion: Completion, from: number, to: number): void => {
    view.dispatch({ changes: { from, to, insert: '' } });
    command({ state: view.state, dispatch: (transaction) => view.dispatch(transaction) });
    view.focus();
  };
}

/** The text before the cursor on its own line. */
function lineBefore(context: CompletionContext): { text: string; from: number } {
  const line = context.state.doc.lineAt(context.pos);
  return { text: line.text.slice(0, context.pos - line.from), from: line.from };
}

/**
 * `/` at the start of a line offers every kind of block.
 *
 * Only at the start: a slash inside a sentence is a slash, and interrupting
 * someone writing `and/or` with a menu would be worse than having no menu.
 */
export const slashCommands: CompletionSource = (context) => {
  const { text, from } = lineBefore(context);
  const match = /^(\s*)\/(\w*)$/.exec(text);
  if (!match) return null;

  return {
    from: from + match[1].length,
    options: BLOCKS.map((block): Completion => ({
      label: `/${block.label}`,
      displayLabel: block.label,
      detail: block.detail,
      type: 'keyword',
      apply: replaceWith(block.command),
    })),
    validFor: /^\/\w*$/,
  };
};

export interface LinkTarget {
  readonly slug: string;
  readonly title: string;
}

/**
 * `[[` offers the notes that already exist.
 *
 * Both the title and the slug are matched, because a writer remembers a note
 * by one or the other and rarely knows which one they are about to type.
 */
export function wikiLinkCompletions(targets: readonly LinkTarget[]): CompletionSource {
  const options = targets.map((target): Completion => ({
    label: target.title,
    detail: target.slug,
    type: 'text',
    // The closing brackets are already there — `closeBrackets` inserted them
    // — so completing must not add a second pair.
    apply: target.title,
  }));

  return (context: CompletionContext): CompletionResult | null => {
    const { text, from } = lineBefore(context);
    // Stop at `|` and `#`: past either one the writer is typing a label or a
    // heading, not choosing a note.
    const match = /\[\[([^\]|#]*)$/.exec(text);
    if (!match) return null;

    return {
      from: from + match.index + 2,
      options,
      validFor: /^[^\]|#]*$/,
    };
  };
}
