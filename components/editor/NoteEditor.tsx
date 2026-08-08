'use client';

import { Columns2, Eye, Maximize2, Minimize2, Target } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NoteMarkdown } from '@/components/markdown/NoteMarkdown';
import type { EditorView } from '@codemirror/view';

import { RequestError, api } from '@/lib/api/client';
import type { LinkTarget } from '@/lib/editor/completions';
import { routes } from '@/lib/notes/links';
import { slugifyPath } from '@/lib/notes/paths';
import type { WikiLink } from '@/lib/notes/wikilinks';
import { useAutosave } from '@/hooks/useAutosave';
import { useSettings } from '@/hooks/useSettings';

import { CodeMirrorEditor } from './CodeMirrorEditor';
import { FormatToolbar } from './FormatToolbar';
import { SaveIndicator } from './SaveIndicator';

/**
 * Writing a note.
 *
 * The document lives in CodeMirror, not in React state — see
 * `CodeMirrorEditor` for why. What React holds is everything *around* the
 * text: the title, the save status, and which panes are showing.
 *
 * The preview is derived from a copy of the document that updates on a short
 * delay. Re-rendering the whole Markdown tree on every keystroke would make
 * typing feel heavy for no benefit; a fifth of a second is below the threshold
 * where a preview feels stale.
 */

const PREVIEW_DELAY = 200;

type Layout = 'write' | 'split' | 'read';

export interface NoteEditorProps {
  slug: string;
  initialTitle: string;
  initialBody: string;
  /** Blob SHA the document was loaded at, for conflict detection. */
  initialSha: string;
  folder: string;
  /**
   * The notes that already exist.
   *
   * Used twice: to render wiki links correctly in the preview, and to offer
   * them for completion when the writer types `[[`.
   */
  existingNotes: readonly LinkTarget[];
}

export function NoteEditor({
  slug,
  initialTitle,
  initialBody,
  initialSha,
  folder,
  existingNotes,
}: NoteEditorProps) {
  const router = useRouter();
  const { settings } = useSettings();

  const [title, setTitle] = useState(initialTitle);
  const [layout, setLayout] = useState<Layout>('write');
  const [zen, setZen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [previewText, setPreviewText] = useState(initialBody);
  const [notice, setNotice] = useState<string | null>(null);
  // Held in state, not a ref: the toolbar has to re-render when the view
  // appears, so that its buttons stop being disabled.
  const [view, setView] = useState<EditorView | null>(null);

  const documentRef = useRef(initialBody);
  const titleRef = useRef(initialTitle);
  const shaRef = useRef<string | null>(initialSha);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The save callback reads the title from a ref so that typing in the title
  // field does not rebuild it and restart the autosave timer.
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const save = useCallback(
    async (body: string) => {
      const result = await api.saveNote(slug, {
        body,
        title: titleRef.current,
        expectedSha: shaRef.current ?? undefined,
      });
      // The new SHA becomes the base for the next save. Without this, the
      // second save of a session would always look like a conflict.
      shaRef.current = result.sha;
      router.refresh();
    },
    [router, slug],
  );

  const autosave = useAutosave({
    delay: settings.autosaveDelay,
    save,
    isFatal: (error) => error instanceof RequestError && error.isConflict,
  });

  const { change, saveNow } = autosave;

  const handleChange = useCallback(
    (document: string) => {
      documentRef.current = document;
      change(document);

      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => setPreviewText(document), PREVIEW_DELAY);
    },
    [change],
  );

  // Renaming the note is a separate action; changing the title only rewrites
  // the frontmatter, which is what most people mean by "rename" anyway.
  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      change(documentRef.current);
    },
    [change],
  );

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Escape leaves zen mode. Nothing else should trap a reader in a view.
  useEffect(() => {
    if (!zen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zen]);

  const known = useMemo(() => new Set(existingNotes.map((note) => note.slug)), [existingNotes]);

  const resolveWikiLink = useCallback(
    (link: WikiLink) => {
      const target = slugifyPath(link.target);
      return { href: routes.note(target), missing: !known.has(target) };
    },
    [known],
  );

  const togglePreview = useCallback(() => {
    setLayout((current) => (current === 'write' ? 'split' : 'write'));
    return true;
  }, []);

  const onSave = useCallback(() => {
    void saveNow();
    return true;
  }, [saveNow]);

  /**
   * Uploads a picture and writes the reference at the cursor.
   *
   * The same work the paste handler does, reached from a button — because
   * choosing a file is how most people expect to add an image, and dragging
   * one in is how the rest do.
   */
  const insertImage = useCallback(
    async (file: File) => {
      if (!view) return;

      try {
        const { markdownPath } = await api.uploadImage(file);
        const at = view.state.selection.main;
        const markdown = `![${file.name.replace(/\.[^.]+$/, '')}](${markdownPath})`;

        view.dispatch({
          changes: { from: at.from, to: at.to, insert: markdown },
          selection: { anchor: at.from + markdown.length },
          userEvent: 'input',
        });
        view.focus();
      } catch (error) {
        setNotice(
          error instanceof RequestError ? error.message : 'The picture could not be added.',
        );
      }
    },
    [view],
  );

  const showEditor = layout !== 'read';
  const showPreview = layout !== 'write';

  return (
    <div
      data-zen={zen ? 'on' : 'off'}
      data-focus={focusMode ? 'on' : 'off'}
      className="editor-shell"
    >
      <header className="editor-bar no-print">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={routes.note(slug)}
            className="text-ink-faint hover:text-ink shrink-0 text-xs"
          >
            ← Done
          </Link>
          <span className="text-ink-faint truncate text-xs">{slug}</span>
        </div>

        <div className="flex items-center gap-1">
          <SaveIndicator state={autosave.state} />

          <ToolbarButton
            label="Focus mode"
            pressed={focusMode}
            onClick={() => setFocusMode((on) => !on)}
          >
            <Target size={15} aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label={showPreview ? 'Hide preview' : 'Show preview'}
            pressed={layout === 'split'}
            onClick={togglePreview}
          >
            {layout === 'read' ? (
              <Eye size={15} aria-hidden="true" />
            ) : (
              <Columns2 size={15} aria-hidden="true" />
            )}
          </ToolbarButton>

          <ToolbarButton label="Zen mode" pressed={zen} onClick={() => setZen((on) => !on)}>
            {zen ? (
              <Minimize2 size={15} aria-hidden="true" />
            ) : (
              <Maximize2 size={15} aria-hidden="true" />
            )}
          </ToolbarButton>
        </div>
      </header>

      {autosave.state.status === 'error' && (
        <ConflictBar
          message={autosave.state.message}
          conflict={autosave.state.conflict}
          onReload={() => window.location.reload()}
          onRetry={() => void saveNow()}
        />
      )}

      {notice && (
        <p className="editor-notice" role="status">
          {notice}
        </p>
      )}

      <div className="editor-panes" data-split={showPreview && showEditor ? 'on' : 'off'}>
        {showEditor && (
          <div className="editor-pane">
            {/*
             * The visible title is an input, which cannot serve as the page's
             * heading — a heading naming a form control has no accessible text.
             * This gives the page a real `h1` to navigate to, matching the
             * document title.
             */}
            <h1 className="sr-only">Editing {title || 'Untitled'}</h1>

            <label className="sr-only" htmlFor="note-title">
              Title
            </label>
            <input
              id="note-title"
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className="editor-title font-display"
              placeholder="Untitled"
              autoComplete="off"
              spellCheck
            />

            {/*
             * Hidden in zen mode, where the point is that nothing is on screen
             * but the words.
             */}
            {settings.editorToolbar && !zen && (
              <FormatToolbar view={view} onInsertImage={insertImage} />
            )}

            <CodeMirrorEditor
              initialDocument={initialBody}
              autoFocus
              className="editor-surface"
              onChange={handleChange}
              onSave={onSave}
              onTogglePreview={togglePreview}
              onViewChange={setView}
              linkTargets={existingNotes}
              paste={{
                uploadImage: async (file) => (await api.uploadImage(file)).markdownPath,
                onError: setNotice,
              }}
            />
          </div>
        )}

        {showPreview && (
          <div className="editor-pane editor-pane-preview">
            <h1 className="font-display mb-6 text-4xl leading-tight">{title || 'Untitled'}</h1>
            <NoteMarkdown
              content={previewText}
              folder={folder}
              resolveWikiLink={resolveWikiLink}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className="text-ink-faint hover:text-ink aria-pressed:text-accent rounded-xs p-1.5"
    >
      {children}
    </button>
  );
}

function ConflictBar({
  message,
  conflict,
  onReload,
  onRetry,
}: {
  message: string;
  conflict: boolean;
  onReload: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="editor-conflict no-print" role="alert">
      <p>{message}</p>
      <div className="flex gap-3">
        {conflict ? (
          <button type="button" onClick={onReload} className="underline">
            Reload the newer version
          </button>
        ) : (
          <button type="button" onClick={onRetry} className="underline">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
