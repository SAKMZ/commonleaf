'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Saving, without the writer having to think about it.
 *
 * The contract is narrow on purpose: this hook owns *when* to save and what
 * the save status is. It does not own the document, and it does not know what
 * saving means — the caller supplies that. Keeping it that small is what makes
 * it testable and reusable for anything else that needs debounced persistence.
 */

export type SaveState =
  | { status: 'saved'; at: Date | null }
  | { status: 'dirty' }
  | { status: 'saving' }
  | { status: 'error'; message: string; conflict: boolean };

export interface AutosaveOptions {
  /** Milliseconds of quiet before an automatic save. */
  delay: number;
  /** Performs the save. Rejecting puts the hook into the error state. */
  save: (document: string) => Promise<void>;
  /** Errors that must not be retried automatically, such as a conflict. */
  isFatal?: (error: unknown) => boolean;
}

export interface Autosave {
  state: SaveState;
  /** Records a change and schedules a save. */
  change: (document: string) => void;
  /** Saves immediately, cancelling any pending timer. */
  saveNow: () => Promise<void>;
  /** True when there is unsaved work. */
  isDirty: boolean;
}

export function useAutosave({ delay, save, isFatal }: AutosaveOptions): Autosave {
  const [state, setState] = useState<SaveState>({ status: 'saved', at: null });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  /**
   * The callbacks are kept in refs so that changing them — which happens on
   * every render of the parent — never restarts a pending timer. Without this
   * a fast typist could postpone the save indefinitely.
   *
   * Synced in an effect rather than during render: a render can be discarded,
   * and a ref written by a discarded render would outlive it.
   */
  const saveRef = useRef(save);
  const fatalRef = useRef(isFatal);

  useEffect(() => {
    saveRef.current = save;
    fatalRef.current = isFatal;
  }, [save, isFatal]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    clearTimer();

    const document = pending.current;
    if (document === null || inFlight.current) return;

    pending.current = null;
    inFlight.current = true;
    setState({ status: 'saving' });

    try {
      await saveRef.current(document);
      // Something typed while the request was in flight leaves the note dirty,
      // and the next change or flush will pick it up.
      setState(
        pending.current === null ? { status: 'saved', at: new Date() } : { status: 'dirty' },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The note could not be saved.';
      const conflict = fatalRef.current?.(error) ?? false;

      // A failed save must not lose the text: put it back so a retry has
      // something to send.
      if (pending.current === null) pending.current = document;
      setState({ status: 'error', message, conflict });
    } finally {
      inFlight.current = false;
    }
  }, [clearTimer]);

  const change = useCallback(
    (document: string) => {
      pending.current = document;
      setState((current) =>
        // A conflict needs a decision from the reader; carrying on saving over
        // the top of it would be exactly the wrong thing to do.
        current.status === 'error' && current.conflict ? current : { status: 'dirty' },
      );

      clearTimer();
      timer.current = setTimeout(() => void flush(), delay);
    },
    [clearTimer, delay, flush],
  );

  const saveNow = useCallback(async () => {
    clearTimer();
    await flush();
  }, [clearTimer, flush]);

  useEffect(() => clearTimer, [clearTimer]);

  /**
   * A last chance to save when the tab is being closed. `beforeunload` cannot
   * await anything, so the warning prompt is the honest option: it hands the
   * decision to the reader instead of silently losing the text.
   */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current === null) return;
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return {
    state,
    change,
    saveNow,
    isDirty: state.status === 'dirty' || state.status === 'error',
  };
}
