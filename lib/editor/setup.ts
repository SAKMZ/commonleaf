import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  keymap,
  placeholder,
  rectangularSelection,
} from '@codemirror/view';

import {
  continueList,
  insertWikiLink,
  setHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from './commands';
import { slashCommands, wikiLinkCompletions, type LinkTarget } from './completions';
import { liveMarkdown } from './live-preview';
import { markdownSyntaxExtensions } from './markdown-syntax';
import { pasteAndDrop, type PasteHandlers } from './paste';
import { paperEditorAppearance } from './theme';

/**
 * The editor, assembled.
 *
 * CodeMirror's `basicSetup` is not used. It brings line numbers, a fold
 * gutter, bracket matching and an active-line highlight — every one of which
 * belongs in a code editor and none of which belongs on a page of prose. The
 * pieces are listed individually instead, so that what the editor does is
 * visible here rather than inherited.
 */

export interface EditorSetupOptions {
  /** Called after every document change, for autosave. */
  onChange: (document: string) => void;
  /** `Ctrl+S`. Returns true when it handled the key. */
  onSave: () => boolean;
  /** `Ctrl+/`. Toggles the preview pane. */
  onTogglePreview: () => boolean;
  paste: PasteHandlers;
  placeholderText?: string;
  /** Notes that `[[` can complete to. */
  linkTargets?: readonly LinkTarget[];
}

export function editorExtensions(options: EditorSetupOptions): Extension[] {
  return [
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    highlightSpecialChars(),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,

    markdown({
      base: markdownLanguage,
      // Fenced blocks are highlighted in whatever language they declare. The
      // grammars load on demand, so this costs nothing until a note has code.
      codeLanguages: languages,
      extensions: markdownSyntaxExtensions,
    }),

    liveMarkdown,
    paperEditorAppearance,
    closeBrackets(),

    /*
     * Both sources answer `null` unless the cursor is somewhere they apply —
     * after `/` at the start of a line, or inside `[[` — so typing prose never
     * raises a menu. That is what makes activating on typing safe here.
     */
    autocompletion({
      activateOnTyping: true,
      icons: false,
      override: [slashCommands, wikiLinkCompletions(options.linkTargets ?? [])],
    }),

    pasteAndDrop(options.paste),
    placeholder(options.placeholderText ?? 'Begin writing…'),

    keymap.of([
      // Ours first: these must win over the defaults they shadow.
      { key: 'Mod-s', run: options.onSave, preventDefault: true },
      { key: 'Mod-/', run: options.onTogglePreview, preventDefault: true },
      { key: 'Enter', run: continueList },
      { key: 'Mod-b', run: toggleWrap('**'), preventDefault: true },
      { key: 'Mod-i', run: toggleWrap('*'), preventDefault: true },
      { key: 'Mod-e', run: toggleWrap('`'), preventDefault: true },
      { key: 'Mod-Shift-k', run: insertWikiLink, preventDefault: true },
      { key: 'Mod-Shift-8', run: toggleList('bullet'), preventDefault: true },
      { key: 'Mod-Shift-7', run: toggleList('number'), preventDefault: true },
      { key: 'Mod-Shift-9', run: toggleQuote, preventDefault: true },
      { key: 'Mod-1', run: setHeading(1), preventDefault: true },
      { key: 'Mod-2', run: setHeading(2), preventDefault: true },
      { key: 'Mod-3', run: setHeading(3), preventDefault: true },
      { key: 'Mod-0', run: setHeading(0), preventDefault: true },

      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),

    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
    }),

    EditorView.contentAttributes.of({
      // The editor is the page; announce it as such rather than as a widget.
      'aria-label': 'Note content',
      spellcheck: 'true',
      autocorrect: 'on',
    }),
  ];
}
