'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { CommandPalette } from '@/components/palette/CommandPalette';
import { Topbar } from '@/components/shell/Topbar';

/**
 * The frame every page sits in.
 *
 * It holds one piece of state — whether the drawer is open on a narrow screen
 * — and nothing else. The index itself arrives as a prop so that it stays a
 * Server Component: the whole folder and tag tree is rendered on the server and
 * shipped as HTML, and this file never sees a note.
 *
 * Whether the index is open on a *wide* screen is a saved preference rather
 * than state, applied by CSS from an attribute on `<html>`. See `styles/shell.css`.
 */
export function Shell({ index, children }: { index: ReactNode; children: ReactNode }) {
  const pathname = usePathname();

  /**
   * The drawer remembers which page it was opened on, so that navigating
   * closes it without an effect that sets state after every render.
   */
  const [drawer, setDrawer] = useState({ open: false, at: pathname });
  const open = drawer.open && drawer.at === pathname;

  const close = () => setDrawer({ open: false, at: pathname });
  const toggle = () => setDrawer({ open: !open, at: pathname });

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer({ open: false, at: pathname });
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, pathname]);

  return (
    <div className="shell" data-drawer={open ? 'open' : 'closed'}>
      <aside id="notebook-index" className="shell-index no-print" aria-label="Notebook index">
        {index}
      </aside>

      {open && (
        <button
          type="button"
          className="shell-scrim lg:hidden"
          aria-label="Close the index"
          onClick={close}
        />
      )}

      <div className="shell-page">
        <Topbar drawerOpen={open} onToggleDrawer={toggle} />
        {children}
      </div>

      <CommandPalette />
    </div>
  );
}
