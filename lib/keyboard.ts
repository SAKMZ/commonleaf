/**
 * Keyboard shortcuts, and the one platform difference that matters.
 *
 * Written once here because "Ctrl on Windows, Command on a Mac" otherwise
 * appears in every handler and every hint, and gets it subtly wrong in one of
 * them. Nothing in this file touches React.
 */

export interface Shortcut {
  /** Compared case-insensitively against `KeyboardEvent.key`. */
  readonly key: string;
  /** Ctrl on Windows and Linux, Command on a Mac. */
  readonly mod?: boolean;
  readonly shift?: boolean;
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;

  // `userAgentData` where it exists, `platform` where it does not. `platform`
  // is deprecated but is still the only thing Safari and Firefox offer.
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';

  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** `⌘` or `Ctrl`, for showing in a hint. */
export function modifierLabel(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;

  const modifier = isMac() ? event.metaKey : event.ctrlKey;
  if (Boolean(shortcut.mod) !== modifier) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;

  // The other modifier is never part of a shortcut here, and holding it should
  // mean the reader is doing something else — a browser or OS binding.
  return isMac() ? !event.ctrlKey : !event.metaKey;
}

/**
 * True while the reader is typing into something.
 *
 * Global shortcuts have to stand aside for text entry, or `n` becomes
 * impossible to type in the editor.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    // `isContentEditable` is the right question but is not implemented
    // everywhere; the ancestor lookup answers it directly, and also catches a
    // keystroke landing on a child of an editable region — which is what the
    // Markdown editor actually produces.
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

export const SHORTCUTS = {
  search: { key: 'k', mod: true },
  commands: { key: 'p', mod: true, shift: true },
} as const satisfies Record<string, Shortcut>;
