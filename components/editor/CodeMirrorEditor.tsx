'use client';

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import { editorExtensions, type EditorSetupOptions } from '@/lib/editor/setup';

/**
 * The React shell around CodeMirror.
 *
 * CodeMirror owns its own DOM and its own state. Fighting that — mirroring the
 * document into React state and writing it back on every keystroke — is the
 * usual way this integration goes wrong, and it costs a re-render per
 * character. So the view is created once, and React's only job afterwards is
 * to hand over the callbacks.
 *
 * The callbacks live in a ref for the same reason: rebuilding the extension
 * list on every render would destroy the undo history.
 */

export interface CodeMirrorEditorProps extends EditorSetupOptions {
  initialDocument: string;
  /** Focuses the editor when it mounts. */
  autoFocus?: boolean;
  className?: string;
  /**
   * Handed the view once, on mount, and `null` on unmount.
   *
   * This is how the formatting toolbar reaches the document. It is a callback
   * rather than a forwarded ref because the parent needs to know *when* the
   * view appears, and a ref gives no such signal.
   */
  onViewChange?: (view: EditorView | null) => void;
}

export function CodeMirrorEditor({
  initialDocument,
  autoFocus = false,
  className,
  onViewChange,
  ...options
}: CodeMirrorEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(options);
  const onViewChangeRef = useRef(onViewChange);

  // Kept current in an effect rather than during render, so a render that
  // React discards cannot leave a stale callback behind.
  useEffect(() => {
    latest.current = options;
    onViewChangeRef.current = onViewChange;
  }, [options, onViewChange]);

  useEffect(() => {
    if (!host.current) return;

    const editor = new EditorView({
      state: EditorState.create({
        doc: initialDocument,
        // Every option is read through the ref, so the extensions are built
        // once and stay stable for the lifetime of the view.
        extensions: editorExtensions({
          onChange: (document) => latest.current.onChange(document),
          onSave: () => latest.current.onSave(),
          onTogglePreview: () => latest.current.onTogglePreview(),
          paste: {
            uploadImage: (file) => latest.current.paste.uploadImage(file),
            onError: (message) => latest.current.paste.onError(message),
          },
          placeholderText: latest.current.placeholderText,
          linkTargets: latest.current.linkTargets,
        }),
      }),
      parent: host.current,
    });

    view.current = editor;
    onViewChangeRef.current?.(editor);
    if (autoFocus) editor.focus();

    return () => {
      onViewChangeRef.current?.(null);
      editor.destroy();
      view.current = null;
    };
    // Recreating the view would lose the cursor and the undo history, so this
    // runs once. A different note means a different `key` on this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className={className} />;
}
