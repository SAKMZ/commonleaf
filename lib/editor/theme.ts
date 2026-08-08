import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/**
 * How the editor looks.
 *
 * Every colour and size is a CSS variable that the paper themes already
 * define, so switching from Classic Ivory to Dark Library restyles the editor
 * without it knowing that themes exist. Nothing here is hard-coded except
 * relative proportions.
 *
 * The editor deliberately uses the *reading* font rather than the monospace
 * one. This is a live-preview editor for prose: you are looking at the note,
 * not at its source. The monospace face is reserved for code, where it earns
 * its keep.
 */

export const paperEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'transparent',
    fontFamily: 'var(--font-reading)',
    fontSize: 'var(--reading-size)',
  },

  '.cm-content': {
    padding: '0',
    lineHeight: 'var(--reading-leading)',
    caretColor: 'var(--accent)',
    // Matches the rendered view so switching between them does not reflow.
    maxWidth: '100%',
  },

  '.cm-line': {
    padding: '0',
  },

  // Paragraph rhythm, matching `styles/typography.css`.
  '.cm-line:not(:first-child)': {
    marginBlockStart: 'calc(var(--paragraph-space) * 0.5)',
  },

  '&.cm-focused': {
    outline: 'none',
  },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },

  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection)',
  },

  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    overflow: 'visible',
  },

  '.cm-placeholder': {
    color: 'var(--ink-faint)',
    fontStyle: 'italic',
  },

  // Search panel, when it is opened.
  '.cm-panels': {
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    border: '1px solid var(--rule)',
  },
  '.cm-textfield': {
    backgroundColor: 'var(--paper)',
    border: '1px solid var(--rule)',
    color: 'var(--ink)',
  },
  '.cm-button': {
    backgroundColor: 'var(--surface-sunken)',
    backgroundImage: 'none',
    border: '1px solid var(--rule)',
    color: 'var(--ink)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    outline: '1px solid var(--accent)',
  },

  /*
   * The `/` and `[[` menus.
   *
   * These live here rather than in `styles/editor.css` because CodeMirror
   * injects its own rules for them unlayered, and unlayered CSS beats anything
   * in `@layer components` no matter how specific. Styling CodeMirror's DOM
   * through CodeMirror's own theme is the only way to win that cascade — and
   * is where it belongs anyway.
   */
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--paper)',
    border: '1px solid var(--paper-edge)',
    boxShadow: 'var(--shadow-raised)',
    borderRadius: '2px',
  },

  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-reading)',
    fontSize: '0.95rem',
    maxHeight: '17rem',
  },

  '.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.6rem',
    padding: '0.34rem 0.7rem',
    color: 'var(--ink-muted)',
    lineHeight: '1.4',
  },

  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--surface-sunken)',
    color: 'var(--ink)',
  },

  '.cm-completionLabel': {
    flex: 'none',
  },

  '.cm-completionDetail': {
    marginInlineStart: 'auto',
    color: 'var(--ink-faint)',
    fontSize: '0.82em',
    fontStyle: 'italic',
  },

  '.cm-completionMatchedText': {
    textDecoration: 'none',
    color: 'var(--accent)',
    fontWeight: '600',
  },
});

/**
 * Syntax colours.
 *
 * Restrained on purpose: a commonplace book is not a code editor, and a page
 * that lights up in six colours stops being readable. Emphasis is carried by
 * weight and shape wherever possible, and colour is reserved for the two
 * things that genuinely are different — links and code.
 */
export const paperHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-tok-heading' },
  { tag: tags.heading2, class: 'cm-tok-heading' },
  { tag: tags.heading3, class: 'cm-tok-heading' },
  { tag: tags.heading4, class: 'cm-tok-heading' },
  { tag: tags.heading5, class: 'cm-tok-heading' },
  { tag: tags.heading6, class: 'cm-tok-heading' },

  { tag: tags.strong, fontWeight: '650' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--ink-faint)' },

  { tag: tags.link, class: 'cm-tok-link' },
  { tag: tags.url, color: 'var(--ink-faint)' },
  { tag: tags.tagName, class: 'cm-tok-tag' },

  { tag: tags.monospace, class: 'cm-tok-code' },
  { tag: tags.quote, color: 'var(--ink-muted)', fontStyle: 'italic' },

  // The delimiters themselves, on the line being edited.
  { tag: tags.processingInstruction, color: 'var(--ink-faint)' },
  { tag: tags.list, color: 'var(--ink-faint)' },

  // Inside fenced code blocks.
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.comment, color: 'var(--ink-faint)', fontStyle: 'italic' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--accent)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--ink-muted)' },
  { tag: tags.function(tags.variableName), color: 'var(--ink)' },
]);

export const paperEditorAppearance = [
  paperEditorTheme,
  syntaxHighlighting(paperHighlightStyle),
];
