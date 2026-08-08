import { Home, Shuffle, Star, Tags, Unlink } from 'lucide-react';
import Link from 'next/link';

import { IndexLink } from '@/components/shell/IndexLink';
import { branding } from '@/lib/branding';
import type { FolderNode, NoteCollection } from '@/lib/notes/collection';
import { routes } from '@/lib/notes/links';
import type { TagNode } from '@/lib/notes/tags';

/**
 * The index of the notebook.
 *
 * A Server Component: the whole folder and tag tree is HTML by the time it
 * reaches the browser, so opening the index costs no JavaScript and no request.
 * It re-renders when the notebook does, because the layout that mounts it is
 * dynamic — there is nothing to keep in sync by hand.
 */
export function Sidebar({ collection }: { collection: NoteCollection }) {
  const unwritten = collection.unresolvedTargets.length;
  const favorites = collection.favorites.length;

  return (
    <nav className="flex min-h-full flex-col gap-7 px-4 py-5 text-[0.9375rem]">
      <Link href={routes.home} className="px-1">
        <span className="font-display text-2xl leading-none">{branding.name}</span>
      </Link>

      <ul>
        <li>
          <IndexLink href={routes.home} exact>
            <Row icon={<Home size={15} />} label="The library" />
            <span className="index-count">{collection.size}</span>
          </IndexLink>
        </li>
        <li>
          <IndexLink href={routes.favorites}>
            <Row icon={<Star size={15} />} label="Favourites" />
            {favorites > 0 && <span className="index-count">{favorites}</span>}
          </IndexLink>
        </li>
        <li>
          <IndexLink href={routes.tags}>
            <Row icon={<Tags size={15} />} label="Tags" />
          </IndexLink>
        </li>
        <li>
          <IndexLink href={routes.unwritten}>
            <Row icon={<Unlink size={15} />} label="Unwritten" />
            {unwritten > 0 && <span className="index-count">{unwritten}</span>}
          </IndexLink>
        </li>
        <li>
          {/*
           * A plain link, not an `IndexLink`: `/random` redirects, so the
           * reader is never standing on it and it can never be current.
           */}
          <Link href={routes.random} className="index-link" prefetch={false}>
            <Row icon={<Shuffle size={15} />} label="Random note" />
          </Link>
        </li>
      </ul>

      {collection.folders.length > 0 && (
        <Section title="Folders">
          <FolderTree nodes={collection.folders} />
        </Section>
      )}

      {collection.tags.length > 0 && (
        <Section title="Tags">
          <TagTree nodes={collection.tags} />
        </Section>
      )}
    </nav>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-ink-faint flex-none" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * A labelled cluster of links.
 *
 * `role="group"` rather than a heading: the index sits before the page in the
 * document, so headings here would open the outline at `h2` and push the note's
 * own title below two navigation labels. A named group is announced when
 * entered and leaves the heading structure to the page itself.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `index-${title.toLowerCase()}`;

  return (
    <div className="index-tree" role="group" aria-labelledby={id}>
      <p id={id} className="index-heading mb-2 px-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function FolderTree({ nodes }: { nodes: readonly FolderNode[] }) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          <IndexLink href={routes.folder(node.path)} alsoUnder={routes.note(node.path)}>
            <span className="truncate">{node.name}</span>
            <span className="index-count">{node.count}</span>
          </IndexLink>
          {node.children.length > 0 && <FolderTree nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

function TagTree({ nodes }: { nodes: readonly TagNode[] }) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          <IndexLink href={routes.tag(node.path)}>
            <span className="truncate">{node.name}</span>
            {/*
             * The total, including nested tags: `books` showing 3 when it holds
             * `books/fiction` twice and nothing directly is the honest count of
             * what clicking it will show.
             */}
            <span className="index-count">{node.totalCount}</span>
          </IndexLink>
          {node.children.length > 0 && <TagTree nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}
