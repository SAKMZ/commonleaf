import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

/**
 * Live Markdown.
 *
 * Syntax marks are hidden while you are not on the line that contains them, so
 * a note reads as prose and reveals its punctuation the moment you go to edit
 * it. The rule is deliberately *per line* rather than per element: a cursor
 * three words away should not make asterisks reappear, and "the line I am on"
 * is something a person can predict without thinking about it.
 *
 * Everything here is driven by the syntax tree rather than by regular
 * expressions, so a `**` inside a code span stays a `**`.
 */

/** Node types whose delimiters are hidden when the line is not being edited. */
const MARK_NODES = new Set([
  'EmphasisMark',
  'StrongEmphasis/EmphasisMark',
  'CodeMark',
  'StrikethroughMark',
  'WikiLinkMark',
  'HeaderMark',
  'QuoteMark',
  'LinkMark',
  'URL',
  'LinkTitle',
]);

const HEADING_NODES: Readonly<Record<string, number>> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
};

class HorizontalRuleWidget extends WidgetType {
  override eq(): boolean {
    // All rules look the same, so React-style reconciliation can skip them.
    return true;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-md-hr';
    wrapper.setAttribute('aria-hidden', 'true');
    return wrapper;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
  ) {
    super();
  }

  override eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-md-task';
    // Without a label a screen reader announces only "checkbox, checked",
    // which says nothing about what it belongs to.
    box.setAttribute('aria-label', 'Task complete');
    // The document is the source of truth; the box only proposes an edit.
    box.addEventListener('mousedown', (event) => event.preventDefault());
    box.addEventListener('click', (event) => {
      event.preventDefault();
      view.dispatch({
        changes: {
          from: this.from,
          to: this.from + 3,
          insert: this.checked ? '[ ]' : '[x]',
        },
      });
    });
    return box;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

const hidden = Decoration.replace({});

function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();

  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) lines.add(line);
  }

  return lines;
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLines(state);
  const decorations: Range<Decoration>[] = [];
  const decoratedLines = new Set<number>();

  const isBeingEdited = (from: number, to: number): boolean => {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;
    for (let line = first; line <= last; line += 1) {
      if (active.has(line)) return true;
    }
    return false;
  };

  /** Adds a line decoration once, even if several nodes ask for it. */
  const decorateLine = (position: number, className: string) => {
    const line = state.doc.lineAt(position);
    const key = line.number;
    if (decoratedLines.has(key)) return;
    decoratedLines.add(key);
    decorations.push(Decoration.line({ class: className }).range(line.from));
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        const level = HEADING_NODES[node.name];
        if (level) {
          decorateLine(node.from, `cm-md-heading cm-md-h${level}`);
          return;
        }

        switch (node.name) {
          case 'Blockquote': {
            /*
             * A callout opens `> [!note] Title`. The Markdown grammar has no
             * idea what `[!note]` is, so without this it sits in the middle of
             * the sentence looking like a mistake — which is exactly how it
             * read in the editor until someone put it in a screenshot.
             */
            const first = state.doc.lineAt(node.from);
            const callout = /^(\s*>\s*)(\[!\w+\])( ?)/.exec(first.text);
            const showMarker = !callout || isBeingEdited(first.from, first.to);

            decorateLine(node.from, showMarker ? 'cm-md-quote' : 'cm-md-quote cm-md-callout');

            if (callout && !showMarker) {
              const start = first.from + callout[1].length;
              decorations.push(
                hidden.range(start, start + callout[2].length + callout[3].length),
              );
            }
            return;
          }

          case 'FencedCode':
          case 'CodeBlock':
            // Marked per line so the background covers the whole block.
            for (
              let line = state.doc.lineAt(node.from).number;
              line <= state.doc.lineAt(node.to).number;
              line += 1
            ) {
              decorateLine(state.doc.line(line).from, 'cm-md-codeblock');
            }
            return;

          case 'HorizontalRule':
            if (!isBeingEdited(node.from, node.to)) {
              decorations.push(
                Decoration.replace({ widget: new HorizontalRuleWidget() }).range(
                  node.from,
                  node.to,
                ),
              );
            }
            return;

          case 'TaskMarker':
            if (!isBeingEdited(node.from, node.to)) {
              const checked = state.doc.sliceString(node.from, node.to).toLowerCase() !== '[ ]';
              decorations.push(
                Decoration.replace({
                  widget: new TaskCheckboxWidget(checked, node.from),
                }).range(node.from, node.to),
              );
            }
            return;

          default:
            break;
        }

        if (!MARK_NODES.has(node.name)) return;
        if (isBeingEdited(node.from, node.to)) return;

        // A heading or quote mark is followed by a space that should go with
        // it, otherwise the text starts one column in from the margin.
        const takesSpace = node.name === 'HeaderMark' || node.name === 'QuoteMark';
        const end =
          takesSpace && state.doc.sliceString(node.to, node.to + 1) === ' '
            ? node.to + 1
            : node.to;

        if (node.from < end) decorations.push(hidden.range(node.from, end));
      },
    });
  }

  // `true` sorts the ranges; line and inline decorations are collected in tree
  // order, which is not the same as document order.
  return Decoration.set(decorations, true);
}

export const liveMarkdown = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // The selection matters as much as the text: moving the caret onto a
      // line is what reveals that line's syntax.
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    /**
     * Treat the decorated ranges as single units for cursor movement. Without
     * this, arrowing along a line would step through hidden asterisks one
     * invisible character at a time, and the caret could land inside a task
     * checkbox.
     */
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);
