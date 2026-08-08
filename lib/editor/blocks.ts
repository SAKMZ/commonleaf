import type { StateCommand } from '@codemirror/state';

import { insertBlock } from './commands';

/**
 * The multi-line things a note can contain.
 *
 * They live here rather than beside the toolbar or the slash menu because both
 * offer them, and a table that gained a column in one place and not the other
 * would be a silly way to lose an afternoon.
 */

const TABLE = ['| Column | Column |', '| --- | --- |', '|  |  |'].join('\n');

/** The caret lands in the first body cell, not after the whole table. */
export const insertTable: StateCommand = insertBlock(TABLE, TABLE.length - 5);

/** The caret lands after the opening fence, where the language goes. */
export const insertCodeBlock: StateCommand = insertBlock('```\n\n```', 3);

export const insertDivider: StateCommand = insertBlock('---\n');

/** The caret lands on the second line, ready for the body of the aside. */
export const insertCallout: StateCommand = insertBlock('> [!note]\n> ', 12);
