// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from '@/hooks/useAutosave';

/**
 * Autosave is the part of the editor most likely to lose someone's work, so
 * the tests are about the awkward cases rather than the happy path: typing
 * while a save is in flight, a save that fails, and a conflict that must not
 * be retried over the top of someone else's edit.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advances timers inside `act`, so React processes the resulting updates. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useAutosave', () => {
  it('starts clean', () => {
    const { result } = renderHook(() => useAutosave({ delay: 100, save: vi.fn() }));

    expect(result.current.state.status).toBe('saved');
    expect(result.current.isDirty).toBe(false);
  });

  it('marks the note dirty as soon as it changes', () => {
    const { result } = renderHook(() => useAutosave({ delay: 100, save: vi.fn() }));

    act(() => result.current.change('one'));

    expect(result.current.state.status).toBe('dirty');
    expect(result.current.isDirty).toBe(true);
  });

  it('saves after the delay, and not before', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ delay: 100, save }));

    act(() => result.current.change('one'));
    await advance(99);
    expect(save).not.toHaveBeenCalled();

    await advance(1);
    expect(save).toHaveBeenCalledWith('one');
    expect(result.current.state.status).toBe('saved');
  });

  it('saves once for a burst of typing, with the latest text', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ delay: 100, save }));

    act(() => result.current.change('a'));
    await advance(50);
    act(() => result.current.change('ab'));
    await advance(50);
    act(() => result.current.change('abc'));
    await advance(100);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
  });

  it('saveNow does not wait for the timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ delay: 5000, save }));

    act(() => result.current.change('now'));
    await act(async () => {
      await result.current.saveNow();
    });

    expect(save).toHaveBeenCalledWith('now');
  });

  it('does nothing when there is nothing to save', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ delay: 100, save }));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('stays dirty when text arrives while a save is in flight', async () => {
    let release: (() => void) | undefined;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const { result } = renderHook(() => useAutosave({ delay: 100, save }));

    act(() => result.current.change('first'));
    await advance(100);
    expect(result.current.state.status).toBe('saving');

    // Typed while the request was still out.
    act(() => result.current.change('second'));
    await act(async () => {
      release?.();
    });

    expect(result.current.state.status).toBe('dirty');
  });

  it('reports a failure and keeps the text for a retry', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Network unreachable'));
    const { result } = renderHook(() => useAutosave({ delay: 100, save }));

    act(() => result.current.change('valuable'));
    await advance(100);

    expect(result.current.state).toMatchObject({
      status: 'error',
      message: 'Network unreachable',
      conflict: false,
    });
    expect(result.current.isDirty).toBe(true);

    // The text survived, so trying again sends it rather than nothing.
    save.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.saveNow();
    });
    expect(save).toHaveBeenLastCalledWith('valuable');
  });

  it('flags a conflict and refuses to overwrite it on the next keystroke', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Changed elsewhere'));
    const { result } = renderHook(() => useAutosave({ delay: 100, save, isFatal: () => true }));

    act(() => result.current.change('mine'));
    await advance(100);
    expect(result.current.state).toMatchObject({ status: 'error', conflict: true });

    // Carrying on typing must not quietly clear the warning.
    act(() => result.current.change('mine, edited'));
    expect(result.current.state).toMatchObject({ status: 'error', conflict: true });
  });

  it('does not restart the timer when the save callback changes identity', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ callback }) => useAutosave({ delay: 100, save: callback }),
      { initialProps: { callback: save } },
    );

    act(() => result.current.change('typing'));
    await advance(60);

    // A parent re-render hands over a brand new function. The pending save
    // must still land on time — and use the newer callback, which is the whole
    // point of holding it in a ref.
    const replacement = vi.fn().mockResolvedValue(undefined);
    rerender({ callback: replacement });
    await advance(40);

    expect(save).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledWith('typing');
    expect(result.current.state.status).toBe('saved');
  });
});
