import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { insertCodeBlock, insertDivider, insertTable } from '@/lib/editor/blocks';
import {
  continueList,
  insertLink,
  insertWikiLink,
  setHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from '@/lib/editor/commands';
import { cleanPastedText } from '@/lib/editor/paste';

/**
 * Commands are exercised against a bare `EditorState`, with no view and no
 * DOM. That is the whole reason they are written as `StateCommand`s: the
 * behaviour that matters is a document transformation, and it can be checked
 * without rendering anything.
 */

/** `|` marks the cursor; `<…>` marks a selection. */
function stateFrom(text: string): EditorState {
  const selectionMatch = /<([^>]*)>/.exec(text);
  if (selectionMatch) {
    const doc = text.replace(/[<>]/g, '');
    const from = selectionMatch.index;
    return EditorState.create({
      doc,
      selection: EditorSelection.single(from, from + selectionMatch[1].length),
    });
  }

  const cursor = text.indexOf('|');
  return EditorState.create({
    doc: text.replace('|', ''),
    selection: EditorSelection.cursor(cursor === -1 ? 0 : cursor),
  });
}

/** Runs a command and returns the document with `|` back at the cursor. */
function run(command: StateCommand, input: string): { doc: string; handled: boolean } {
  let state = stateFrom(input);

  const handled = command({
    state,
    dispatch: (transaction) => {
      state = transaction.state;
    },
  });

  const { head } = state.selection.main;
  const doc = state.doc.toString();
  return { doc: `${doc.slice(0, head)}|${doc.slice(head)}`, handled };
}

describe('continueList', () => {
  it('continues a bullet list', () => {
    expect(run(continueList, '- first|').doc).toBe('- first\n- |');
  });

  it('keeps the bullet character that was used', () => {
    expect(run(continueList, '* first|').doc).toBe('* first\n* |');
    expect(run(continueList, '+ first|').doc).toBe('+ first\n+ |');
  });

  it('increments a numbered list', () => {
    expect(run(continueList, '3. third|').doc).toBe('3. third\n4. |');
    expect(run(continueList, '3) third|').doc).toBe('3) third\n4) |');
  });

  it('preserves indentation', () => {
    expect(run(continueList, '  - nested|').doc).toBe('  - nested\n  - |');
  });

  it('carries a task box across, unchecked', () => {
    expect(run(continueList, '- [x] done|').doc).toBe('- [x] done\n- [ ] |');
  });

  it('ends the list when the item is empty', () => {
    expect(run(continueList, '- first\n- |').doc).toBe('- first\n|');
  });

  it('continues a blockquote', () => {
    expect(run(continueList, '> quoted|').doc).toBe('> quoted\n> |');
  });

  it('ends a blockquote when the line is empty', () => {
    expect(run(continueList, '> quoted\n> |').doc).toBe('> quoted\n|');
  });

  it('declines on an ordinary paragraph, so Enter behaves normally', () => {
    expect(run(continueList, 'just prose|').handled).toBe(false);
  });

  it('declines mid-line, where the writer is splitting a line', () => {
    expect(run(continueList, '- fir|st').handled).toBe(false);
  });
});

describe('toggleWrap', () => {
  it('wraps a selection', () => {
    expect(run(toggleWrap('**'), 'make <this> bold').doc).toBe('make **this|** bold');
  });

  it('unwraps a selection that is already wrapped', () => {
    expect(run(toggleWrap('**'), 'make **<this>** bold').doc).toBe('make this| bold');
  });

  it('inserts an empty pair with the cursor between', () => {
    expect(run(toggleWrap('**'), 'type |here').doc).toBe('type **|**here');
  });

  it('works for italics and code', () => {
    expect(run(toggleWrap('*'), '<word>').doc).toBe('*word|*');
    expect(run(toggleWrap('`'), '<code>').doc).toBe('`code|`');
  });
});

describe('setHeading', () => {
  it('adds a heading prefix', () => {
    expect(run(setHeading(2), 'Title|').doc).toBe('## Title|');
  });

  it('replaces a different level', () => {
    expect(run(setHeading(3), '# Title|').doc).toBe('### Title|');
  });

  it('removes the level that is already applied', () => {
    expect(run(setHeading(2), '## Title|').doc).toBe('Title|');
  });

  it('level zero clears any heading', () => {
    expect(run(setHeading(0), '#### Title|').doc).toBe('Title|');
  });
});

describe('insertWikiLink', () => {
  it('wraps the selection and leaves the cursor after the target', () => {
    expect(run(insertWikiLink, 'see <Stoicism> now').doc).toBe('see [[Stoicism|]] now');
  });

  it('inserts an empty link ready to type into', () => {
    expect(run(insertWikiLink, 'see |').doc).toBe('see [[|]]');
  });
});

describe('cleanPastedText', () => {
  it('normalises line endings', () => {
    expect(cleanPastedText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('replaces exotic spaces with ordinary ones', () => {
    expect(cleanPastedText('a b c　d')).toBe('a b c d');
  });

  it('removes zero-width characters', () => {
    expect(cleanPastedText('a​b‍c﻿')).toBe('abc');
  });

  it('removes soft hyphens', () => {
    expect(cleanPastedText('encyclo­pedia')).toBe('encyclopedia');
  });

  it('strips trailing spaces, which mean a hard break in Markdown', () => {
    expect(cleanPastedText('line one   \nline two')).toBe('line one\nline two');
  });

  it('leaves ordinary prose exactly as it was', () => {
    const text = 'A sentence — with punctuation, "quotes" and *emphasis*.';
    expect(cleanPastedText(text)).toBe(text);
  });

  it('does not touch indentation, which is meaningful in Markdown', () => {
    expect(cleanPastedText('- item\n  - nested')).toBe('- item\n  - nested');
  });
});

describe('toggleList', () => {
  it('turns a paragraph into a bulleted list', () => {
    expect(run(toggleList('bullet'), 'Buy milk|').doc).toBe('- Buy milk|');
  });

  it('leaves the caret ready to type, not stranded before the marker', () => {
    // The bug this guards: choosing "Task list" from the slash menu on an
    // empty line used to put the caret to the left of `- [ ] `.
    expect(run(toggleList('task'), '|').doc).toBe('- [ ] |');
    expect(run(toggleList('bullet'), '|').doc).toBe('- |');
  });

  it('numbers the items in order', () => {
    expect(run(toggleList('number'), '<one\ntwo\nthree>').doc).toContain(
      '1. one\n2. two\n3. three',
    );
  });

  it('replaces one kind of marker rather than stacking a second', () => {
    expect(run(toggleList('number'), '<- one\n- two>').doc).toContain('1. one\n2. two');
    expect(run(toggleList('task'), '- one|').doc).toBe('- [ ] one|');
  });

  it('removes the list when the lines are already that kind', () => {
    expect(run(toggleList('bullet'), '- one|').doc).toBe('one|');
    expect(run(toggleList('task'), '- [ ] one|').doc).toBe('one|');
  });

  it('does not mistake a task for a plain bullet', () => {
    // Both start `- `, so asking for bullets on a task list must convert it
    // rather than read as "already bulleted" and strip the whole thing.
    expect(run(toggleList('bullet'), '- [ ] one|').doc).toBe('- one|');
  });

  it('keeps indentation', () => {
    expect(run(toggleList('bullet'), '  nested|').doc).toBe('  - nested|');
  });

  it('ignores blank lines when deciding, but does not mark them', () => {
    const { doc } = run(toggleList('bullet'), '<- one\n\n- two>');
    expect(doc).toContain('one\n\ntwo');
  });
});

describe('toggleQuote', () => {
  it('adds and removes the marker', () => {
    expect(run(toggleQuote, 'Words|').doc).toBe('> Words|');
    expect(run(toggleQuote, '> Words|').doc).toBe('Words|');
  });

  it('quotes every line of a selection', () => {
    expect(run(toggleQuote, '<one\ntwo>').doc).toContain('> one\n> two');
  });

  it('quotes the whole block when only some of it is quoted', () => {
    // Built by hand: the `<…>` marker cannot express a selection that itself
    // contains a `>`.
    let state = EditorState.create({
      doc: '> one\ntwo',
      selection: EditorSelection.single(0, 9),
    });

    toggleQuote({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    });

    expect(state.doc.toString()).toBe('> one\n> two');
  });
});

describe('insertBlock', () => {
  it('starts a new line when the caret is in prose', () => {
    expect(run(insertDivider, 'Some words|').doc).toBe('Some words\n\n---\n|');
  });

  it('does not add a break on a line that is already empty', () => {
    expect(run(insertDivider, '|').doc).toBe('---\n|');
  });

  it('leaves the caret where the language goes in a code block', () => {
    expect(run(insertCodeBlock, '|').doc).toBe('```|\n\n```');
  });

  it('leaves the caret in the first cell of a table', () => {
    const { doc } = run(insertTable, '|');

    // The body row is `|  |  |`; the extra `|` is the caret marker, sitting
    // inside the first cell rather than after the whole table.
    expect(doc.split('\n').at(-1)).toBe('| | |  |');
  });
});

describe('insertLink', () => {
  it('wraps the selection and selects the placeholder URL', () => {
    let state = stateFrom('<Marginalia>');
    insertLink({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    });

    const { from, to } = state.selection.main;
    expect(state.doc.toString()).toBe('[Marginalia](url)');
    expect(state.doc.sliceString(from, to)).toBe('url');
  });
});
