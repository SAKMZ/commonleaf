'use client';

import { useSyncExternalStore } from 'react';

import { modifierLabel } from '@/lib/keyboard';

/** Never changes, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * `⌘` or `Ctrl`, safe to render.
 *
 * The platform is unknowable on the server, so the server snapshot is `Ctrl`
 * and React swaps it after hydration. Reading it through
 * `useSyncExternalStore` — rather than an effect that sets state — is what
 * keeps that swap out of a second render pass.
 */
export function useModifierLabel(): string {
  return useSyncExternalStore(noSubscription, modifierLabel, () => 'Ctrl');
}
