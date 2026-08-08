import Link from 'next/link';

import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { routes } from '@/lib/notes/links';
import { loadNotes } from '@/lib/notes/load';
import type { TagNode } from '@/lib/notes/tags';

/** Every tag in the notebook, nested the way they were written. */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tags' };

export default async function TagsPage() {
  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const { tags } = notebook.collection;

  return (
    <Page wide>
      <PageHeader
        title="Tags"
        subtitle={
          tags.length === 0
            ? undefined
            : 'A tag written as books/philosophy files itself under books.'
        }
      />

      {tags.length === 0 ? (
        <p className="text-ink-muted italic">
          No tags yet. Add <code>tags:</code> to a note&rsquo;s frontmatter, or write{' '}
          <code>#like-this</code> anywhere in it.
        </p>
      ) : (
        <TagBranch nodes={tags} />
      )}
    </Page>
  );
}

function TagBranch({ nodes, depth = 0 }: { nodes: readonly TagNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'border-rule ms-3 border-s ps-3'}>
      {nodes.map((node) => (
        <li key={node.path}>
          <Link href={routes.tag(node.path)} className="group inline-flex items-baseline gap-2">
            <span className="text-accent group-hover:underline">#{node.name}</span>
            <span className="text-ink-faint text-sm">
              {node.totalCount}
              {/*
               * When a parent has notes of its own as well as beneath it, both
               * numbers matter: "12 (3 directly)" answers "is `books` a real
               * tag or only a prefix?".
               */}
              {node.count > 0 && node.count !== node.totalCount && ` (${node.count} directly)`}
            </span>
          </Link>

          {node.children.length > 0 && <TagBranch nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
