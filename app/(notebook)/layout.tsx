import { Shell } from '@/components/shell/Shell';
import { Sidebar } from '@/components/shell/Sidebar';
import { loadNotes } from '@/lib/notes/load';

/**
 * Every page that is part of the notebook.
 *
 * The index is built here, once, and passed into the shell as a rendered tree
 * — so it costs one traversal per navigation rather than one per page, and no
 * JavaScript at all. The route group keeps the API handlers outside the shell
 * without changing a single URL.
 */
export const dynamic = 'force-dynamic';

export default async function NotebookLayout({ children }: { children: React.ReactNode }) {
  const notebook = await loadNotes();

  return (
    <Shell index={notebook.ok ? <Sidebar collection={notebook.collection} /> : null}>
      {children}
    </Shell>
  );
}
