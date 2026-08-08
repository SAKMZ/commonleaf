'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * A link in the index that knows whether you are standing on it.
 *
 * The only part of the index that has to be a Client Component: everything
 * else — the folder tree, the tag tree, the counts — is rendered on the server
 * and arrives as HTML. Marking the current page needs the URL, and the URL is
 * the one thing the server render cannot know before navigation.
 */
export function IndexLink({
  href,
  children,
  exact = false,
  alsoUnder,
}: {
  href: string;
  children: ReactNode;
  /** Match the whole path rather than treating it as a prefix. */
  exact?: boolean;
  /**
   * A second prefix that counts as being here.
   *
   * Reading `/notes/philosophy/stoicism` should light up the `philosophy`
   * folder, even though the folder's own page is at a different URL — the
   * index is there to say where you are.
   */
  alsoUnder?: string;
}) {
  const pathname = usePathname();
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const current = exact
    ? pathname === href
    : under(href) || (alsoUnder !== undefined && under(alsoUnder));

  return (
    <Link href={href} className="index-link" aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}
