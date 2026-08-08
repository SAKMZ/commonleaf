import { EditorView } from '@codemirror/view';

import { linkSelection } from './commands';

/**
 * What happens when text, a URL or an image arrives from outside the editor.
 *
 * The guiding rule is that pasting should never introduce characters the
 * writer cannot see. Word processors and web pages carry non-breaking spaces,
 * soft hyphens and stray carriage returns, and a plain-text vault is exactly
 * the wrong place for them to accumulate.
 */

const URL_ONLY = /^https?:\/\/\S+$/i;

/**
 * Invisible characters, written as escapes rather than as themselves.
 *
 * A character class of things you cannot see is impossible to review and easy
 * to corrupt in an editor; spelling them out is the difference between a rule
 * someone can check and a rule they have to trust.
 */
const EXOTIC_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g;
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff]/g;
const SOFT_HYPHEN = /\u00ad/g;

/**
 * Removes invisible characters that survive a copy from a web page.
 *
 * Deliberately conservative: it does not touch punctuation, casing or
 * Markdown. Rewriting someone's prose on paste would be worse than the problem
 * it solved.
 */
export function cleanPastedText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      .replace(EXOTIC_SPACES, ' ')
      .replace(ZERO_WIDTH, '')
      .replace(SOFT_HYPHEN, '')
      // Trailing spaces mean a hard line break in Markdown; a stray pair
      // arriving from elsewhere is almost never meant.
      .replace(/[ \t]+$/gm, '')
  );
}

export interface PasteHandlers {
  /** Uploads a file and returns the path to write into the note. */
  uploadImage: (file: File) => Promise<string>;
  onError: (message: string) => void;
}

function imageFilesFrom(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  return [...transfer.files].filter((file) => file.type.startsWith('image/'));
}

/**
 * Writes a placeholder while an image uploads, then swaps in the real path.
 *
 * Uploading commits to a Git repository over the network, which can take a
 * second or two. Leaving the note unchanged for that long makes it look like
 * the paste was ignored.
 */
async function uploadAndInsert(
  view: EditorView,
  files: readonly File[],
  at: number,
  handlers: PasteHandlers,
): Promise<void> {
  const placeholder =
    files.length === 1 ? '![Uploading…]()' : `![Uploading ${files.length}…]()`;

  view.dispatch({ changes: { from: at, insert: placeholder }, userEvent: 'input.paste' });

  try {
    const paths = await Promise.all(files.map((file) => handlers.uploadImage(file)));
    const markdown = paths.map((path) => `![](${path})`).join('\n');

    view.dispatch({
      changes: { from: at, to: at + placeholder.length, insert: markdown },
      selection: { anchor: at + markdown.length },
    });
  } catch (error) {
    // Take the placeholder back out; a note should not be left holding a lie.
    view.dispatch({ changes: { from: at, to: at + placeholder.length, insert: '' } });
    handlers.onError(error instanceof Error ? error.message : 'The image could not be saved.');
  }
}

export function pasteAndDrop(handlers: PasteHandlers) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const images = imageFilesFrom(event.clipboardData);
      if (images.length > 0) {
        event.preventDefault();
        void uploadAndInsert(view, images, view.state.selection.main.from, handlers);
        return true;
      }

      const text = event.clipboardData?.getData('text/plain');
      if (!text) return false;

      // A URL pasted over selected words becomes a link around them.
      if (URL_ONLY.test(text.trim()) && !view.state.selection.main.empty) {
        event.preventDefault();
        return linkSelection(text.trim())(view);
      }

      const cleaned = cleanPastedText(text);
      // Nothing to fix: let the default paste happen, undo history and all.
      if (cleaned === text) return false;

      event.preventDefault();
      view.dispatch(view.state.replaceSelection(cleaned), {
        scrollIntoView: true,
        userEvent: 'input.paste',
      });
      return true;
    },

    drop(event, view) {
      const images = imageFilesFrom(event.dataTransfer);
      if (images.length === 0) return false;

      event.preventDefault();
      const at =
        view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length;
      void uploadAndInsert(view, images, at, handlers);
      return true;
    },

    dragover(event) {
      // Without this the browser navigates away to the dropped file.
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
      return false;
    },
  });
}
