// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isTypingTarget, matchesShortcut, SHORTCUTS } from '@/lib/keyboard';

function onPlatform(platform: string) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
}

afterEach(() => {
  vi.restoreAllMocks();
});

function press(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('matchesShortcut', () => {
  it('wants Ctrl on Windows and Linux', () => {
    onPlatform('Win32');

    expect(matchesShortcut(press({ key: 'k', ctrlKey: true }), SHORTCUTS.search)).toBe(true);
    expect(matchesShortcut(press({ key: 'k', metaKey: true }), SHORTCUTS.search)).toBe(false);
  });

  it('wants Command on a Mac', () => {
    onPlatform('MacIntel');

    expect(matchesShortcut(press({ key: 'k', metaKey: true }), SHORTCUTS.search)).toBe(true);
    expect(matchesShortcut(press({ key: 'k', ctrlKey: true }), SHORTCUTS.search)).toBe(false);
  });

  it('ignores the case of the key', () => {
    onPlatform('Win32');

    expect(matchesShortcut(press({ key: 'K', ctrlKey: true }), SHORTCUTS.search)).toBe(true);
  });

  it('distinguishes the two palettes by Shift', () => {
    onPlatform('Win32');

    const withShift = press({ key: 'p', ctrlKey: true, shiftKey: true });
    const without = press({ key: 'p', ctrlKey: true });

    expect(matchesShortcut(withShift, SHORTCUTS.commands)).toBe(true);
    expect(matchesShortcut(without, SHORTCUTS.commands)).toBe(false);
  });

  it('stands aside when the other modifier is held', () => {
    onPlatform('Win32');

    expect(
      matchesShortcut(press({ key: 'k', ctrlKey: true, metaKey: true }), SHORTCUTS.search),
    ).toBe(false);
  });

  it('does not fire on the bare key', () => {
    onPlatform('Win32');

    expect(matchesShortcut(press({ key: 'k' }), SHORTCUTS.search)).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('recognises the places text goes', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
  });

  it('recognises an editable region, and anything inside one', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inside = document.createElement('span');
    editable.append(inside);
    document.body.append(editable);

    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(inside)).toBe(true);
  });

  it('is not fooled by contenteditable="false"', () => {
    const locked = document.createElement('div');
    locked.setAttribute('contenteditable', 'false');
    document.body.append(locked);

    expect(isTypingTarget(locked)).toBe(false);
  });

  it('leaves everything else alone', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
