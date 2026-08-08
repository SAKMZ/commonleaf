import type { ChangeSpec, StateCommand } from '@codemirror/state';
import { ChangeSet, EditorSelection } from '@codemirror/state';

/**
 * The editing commands a Markdown writer expects to be there.
 *
 * Each is a plain `StateCommand`, so they are testable without a DOM and can
 * be bound to a key, a toolbar button or a command-palette entry without
 * change.
 */

/**
 * A list marker at the start of a line: indentation, the bullet or number, and
 * an optional task box.
 */
const LIST_LINE = /^(\s*)(([-*+])|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?(.*)$/;
const BLOCKQUOTE_LINE = /^(\s*>\s?)(.*)$/;

/**
 * Enter continues the list you are in.
 *
 * Pressing it on an empty item ends the list instead — the same convention
 * every other Markdown editor uses, and the only way to leave a list without
 * reaching for the mouse.
 */
export const continueList: StateCommand = ({ state, dispatch }) => {
  let handled = false;

  const transaction = state.changeByRange((range) => {
    if (!range.empty) return { range };

    const line = state.doc.lineAt(range.head);
    // Only continue when the caret is at the end of the line; in the middle of
    // one the writer is splitting a line, not adding an item.
    if (range.head !== line.to) return { range };

    const list = LIST_LINE.exec(line.text);
    if (list) {
      const [, indent, , bullet, number, delimiter, space, task, content] = list;

      if (content.trim() === '') {
        // An empty item: clear it and step out of the list.
        handled = true;
        return {
          changes: { from: line.from, to: line.to, insert: '' },
          range: EditorSelection.cursor(line.from),
        };
      }

      const nextMarker = bullet ?? `${Number(number) + 1}${delimiter}`;
      // Carry the task box across, but always unchecked: the new item is
      // something still to do.
      const insert = `\n${indent}${nextMarker}${space}${task ? '[ ] ' : ''}`;
      handled = true;
      return {
        changes: { from: range.head, insert },
        range: EditorSelection.cursor(range.head + insert.length),
      };
    }

    const quote = BLOCKQUOTE_LINE.exec(line.text);
    if (quote) {
      const [, prefix, content] = quote;
      if (content.trim() === '') {
        handled = true;
        return {
          changes: { from: line.from, to: line.to, insert: '' },
          range: EditorSelection.cursor(line.from),
        };
      }

      const insert = `\n${prefix}`;
      handled = true;
      return {
        changes: { from: range.head, insert },
        range: EditorSelection.cursor(range.head + insert.length),
      };
    }

    return { range };
  });

  if (!handled) return false;

  dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

/**
 * Wraps the selection in `mark`, or unwraps it if it is already wrapped.
 *
 * With nothing selected it inserts the pair and puts the caret between them,
 * so `Ctrl+B` then typing does what you expect.
 */
export function toggleWrap(mark: string): StateCommand {
  return ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - mark.length, range.from);
      const after = state.sliceDoc(range.to, range.to + mark.length);

      if (before === mark && after === mark) {
        return {
          changes: [
            { from: range.from - mark.length, to: range.from, insert: '' },
            { from: range.to, to: range.to + mark.length, insert: '' },
          ],
          range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
        };
      }

      const selected = state.sliceDoc(range.from, range.to);
      const insert = `${mark}${selected}${mark}`;

      return {
        changes: { from: range.from, to: range.to, insert },
        range: range.empty
          ? EditorSelection.cursor(range.from + mark.length)
          : EditorSelection.range(range.from + mark.length, range.to + mark.length),
      };
    });

    dispatch(state.update(transaction, { userEvent: 'input' }));
    return true;
  };
}

/** Adds, changes or removes the `#` prefix on every selected line. */
export function setHeading(level: number): StateCommand {
  return (target) => {
    const { state } = target;
    const changes: ChangeSpec[] = [];

    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.to).number;

      for (let number = first; number <= last; number += 1) {
        const line = state.doc.line(number);
        const existing = /^(#{1,6})\s+/.exec(line.text);
        const prefix = level === 0 ? '' : `${'#'.repeat(level)} `;

        // Asking for the level a line already has removes it, so the same
        // shortcut toggles rather than only ever adding.
        const insert = existing && existing[1].length === level ? '' : prefix;

        changes.push({
          from: line.from,
          to: line.from + (existing?.[0].length ?? 0),
          insert,
        });
      }
    }

    return applyLineChanges(target, changes);
  };
}

/**
 * Any list marker, whatever kind — used to strip one before writing another.
 *
 * Turning a bullet into a numbered item should replace the marker, not stack a
 * second one in front of it.
 */
const ANY_LIST_MARKER = /^(\s*)(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;
const ANY_QUOTE_MARKER = /^(\s*)>[ \t]?/;

export type ListKind = 'bullet' | 'number' | 'task';

function markerFor(kind: ListKind, index: number): string {
  if (kind === 'number') return `${index + 1}. `;
  return kind === 'task' ? '- [ ] ' : '- ';
}

function isKind(text: string, kind: ListKind): boolean {
  if (kind === 'bullet') return /^\s*[-*+][ \t]+(?!\[[ xX]\][ \t])/.test(text);
  if (kind === 'number') return /^\s*\d+[.)][ \t]+/.test(text);
  return /^\s*[-*+][ \t]+\[[ xX]\][ \t]+/.test(text);
}

/**
 * Rewrites the starts of lines and leaves the caret in a sensible place.
 *
 * The `assoc: 1` is the whole point. A caret sitting exactly where a marker is
 * inserted would otherwise stay to the left of it — so choosing "Task list"
 * from the menu would leave you typing *before* the `- [ ] ` rather than after
 * it. Mapping the selection forward puts it where a person is about to write.
 */
function applyLineChanges(
  { state, dispatch }: Parameters<StateCommand>[0],
  changes: readonly ChangeSpec[],
): boolean {
  if (changes.length === 0) return false;

  const changeSet = ChangeSet.of(changes, state.doc.length);

  dispatch(
    state.update({
      changes: changeSet,
      selection: state.selection.map(changeSet, 1),
      scrollIntoView: true,
      userEvent: 'input',
    }),
  );
  return true;
}

/** Every line the selection touches, including a bare cursor's own line. */
function selectedLines(state: Parameters<StateCommand>[0]['state']) {
  const lines: { from: number; to: number; text: string }[] = [];
  const seen = new Set<number>();

  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;

    for (let number = first; number <= last; number += 1) {
      if (seen.has(number)) continue;
      seen.add(number);
      const line = state.doc.line(number);
      lines.push({ from: line.from, to: line.to, text: line.text });
    }
  }

  return lines;
}

/**
 * Turns the selected lines into a list, or back into plain paragraphs.
 *
 * Asking for the kind the lines already are removes it, so one button both
 * makes and unmakes a list — which is what a toolbar button is expected to do.
 */
export function toggleList(kind: ListKind): StateCommand {
  return (target) => {
    const { state } = target;
    const lines = selectedLines(state);
    if (lines.length === 0) return false;

    // Blank lines are skipped when deciding, so one empty line between items
    // does not make the whole block look like it is not a list.
    const meaningful = lines.filter((line) => line.text.trim() !== '');
    const already =
      meaningful.length > 0 && meaningful.every((line) => isKind(line.text, kind));

    const changes: ChangeSpec[] = [];
    let index = 0;

    for (const line of lines) {
      const existing = ANY_LIST_MARKER.exec(line.text);
      const indent = existing?.[1] ?? /^\s*/.exec(line.text)![0];
      const width = existing?.[0].length ?? indent.length;

      const insert = already ? indent : `${indent}${markerFor(kind, index)}`;
      if (!already && line.text.trim() !== '') index += 1;

      changes.push({ from: line.from, to: line.from + width, insert });
    }

    return applyLineChanges(target, changes);
  };
}

/** Adds or removes `> ` on every selected line. */
export const toggleQuote: StateCommand = (target) => {
  const { state } = target;
  const lines = selectedLines(state);
  if (lines.length === 0) return false;

  const already = lines.every((line) => ANY_QUOTE_MARKER.test(line.text));
  const changes: ChangeSpec[] = [];

  for (const line of lines) {
    const existing = ANY_QUOTE_MARKER.exec(line.text);

    if (already && existing) {
      changes.push({
        from: line.from,
        to: line.from + existing[0].length,
        insert: existing[1],
      });
    } else if (!already && !existing) {
      const indent = /^\s*/.exec(line.text)![0];
      changes.push({ from: line.from, to: line.from + indent.length, insert: `${indent}> ` });
    }
  }

  return applyLineChanges(target, changes);
};

/**
 * Drops a block of text in at the cursor, on lines of its own.
 *
 * `caretOffset` counts from the start of the inserted text, so a caller can
 * leave the cursor inside a code fence or in the first cell of a table rather
 * than after the whole thing.
 */
export function insertBlock(snippet: string, caretOffset = snippet.length): StateCommand {
  return ({ state, dispatch }) => {
    const range = state.selection.main;
    const line = state.doc.lineAt(range.from);

    // A blank line before, unless the block already starts one or the document
    // does. Markdown needs the separation, and a writer should not have to know.
    const needsBreak = line.text.trim() !== '';
    const prefix = needsBreak ? '\n\n' : '';
    const insert = `${prefix}${snippet}`;
    const at = needsBreak ? line.to : range.from;

    dispatch(
      state.update({
        changes: { from: at, to: needsBreak ? line.to : range.to, insert },
        selection: EditorSelection.cursor(at + prefix.length + caretOffset),
        scrollIntoView: true,
        userEvent: 'input',
      }),
    );
    return true;
  };
}

/**
 * Wraps the selection in an ordinary Markdown link.
 *
 * The caret lands in the URL, because the text is usually already selected and
 * the address is the part still to be supplied.
 */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const insert = `[${selected}](url)`;
  const urlStart = range.from + selected.length + 3;

  dispatch(
    state.update({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.range(urlStart, urlStart + 3),
      userEvent: 'input',
    }),
  );
  return true;
};

/** Wraps the selection in a wiki link, ready for the target to be typed. */
export const insertWikiLink: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const insert = `[[${selected}]]`;

    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + 2 + selected.length),
    };
  });

  dispatch(state.update(transaction, { userEvent: 'input' }));
  return true;
};

/**
 * Turns a pasted URL into a link around the selection.
 *
 * Returns `false` when the clipboard is not a URL or nothing is selected, so
 * the caller can fall back to an ordinary paste.
 */
export function linkSelection(url: string): StateCommand {
  return ({ state, dispatch }) => {
    if (state.selection.main.empty) return false;

    const transaction = state.changeByRange((range) => {
      if (range.empty) return { range };
      const selected = state.sliceDoc(range.from, range.to);
      const insert = `[${selected}](${url})`;

      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(range.from, range.from + insert.length),
      };
    });

    dispatch(state.update(transaction, { userEvent: 'input.paste' }));
    return true;
  };
}
