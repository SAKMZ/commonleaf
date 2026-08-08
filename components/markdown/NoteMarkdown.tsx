import Link from 'next/link';
import Markdown, { type Components } from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';

import { assetUrl, isExternalUrl } from '@/lib/markdown/assets';
import { remarkCallouts } from '@/lib/markdown/remark-callouts';
import { remarkWikiLinks, type WikiLinkResolution } from '@/lib/markdown/remark-wikilinks';
import type { WikiLink } from '@/lib/notes/wikilinks';

/**
 * Renders a note's Markdown.
 *
 * `react-markdown`'s default export is synchronous and hook-free, so this
 * works as a Server Component: reading a note ships no Markdown parser to the
 * browser at all. The editor's preview pane uses the same component on the
 * client, which is the point of keeping it free of server-only imports.
 *
 * Raw HTML is not enabled. These are the reader's own files, but a Markdown
 * renderer that executes whatever is pasted into it is a poor default, and
 * nothing in a commonplace book needs it.
 */

export interface NoteMarkdownProps {
  content: string;
  /** Folder of the note, so relative image paths resolve correctly. */
  folder: string;
  /** Decides where a wiki link points and whether its target exists. */
  resolveWikiLink: (link: WikiLink) => WikiLinkResolution;
  /** Applies the drop cap to the opening paragraph. */
  dropCap?: boolean;
  className?: string;
}

export function NoteMarkdown({
  content,
  folder,
  resolveWikiLink,
  dropCap = false,
  className,
}: NoteMarkdownProps) {
  const components: Components = {
    a({ node: _node, href, children, ...props }) {
      if (href && isExternalUrl(href)) {
        return (
          // `noreferrer` keeps the notebook's URL out of other people's logs.
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      }

      return (
        <Link href={href ?? '#'} {...props}>
          {children}
        </Link>
      );
    },

    img({ node: _node, src, alt, ...props }) {
      const resolved = typeof src === 'string' ? assetUrl(src, folder) : null;
      if (!resolved) return null;

      return (
        // Deliberately not `next/image`: these files come from the reader's own
        // repository at unknown dimensions, and running them through the
        // optimiser would add latency and a cache for no visible gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={alt ?? ''} loading="lazy" decoding="async" {...props} />
      );
    },

    // Wide tables scroll inside their own container rather than pushing the
    // page sideways.
    table({ node: _node, children, ...props }) {
      return (
        <div className="table-scroll">
          <table {...props}>{children}</table>
        </div>
      );
    },

    hr({ node: _node, ...props }) {
      return <hr className="rule-ornament" {...props} />;
    },
  };

  return (
    <div
      className={['reading', dropCap ? 'has-dropcap' : '', className].filter(Boolean).join(' ')}
    >
      <Markdown
        remarkPlugins={[
          remarkGfm,
          remarkCallouts,
          [remarkWikiLinks, { resolve: resolveWikiLink }],
          // Typographic quotes and dashes run last so it only sees prose, not
          // syntax that earlier plugins have already consumed.
          [remarkSmartypants, { dashes: 'oldschool' }],
        ]}
        rehypePlugins={[rehypeSlug]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
