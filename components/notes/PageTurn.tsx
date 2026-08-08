import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { routes } from '@/lib/notes/links';

interface Neighbour {
  readonly slug: string;
  readonly title: string;
}

/**
 * The notes either side of this one, at the foot of the page.
 *
 * A folder read in file order is the closest thing a commonplace book has to a
 * sequence, and this is what makes it feel like one: reaching the end of a
 * note and finding the next rather than a dead stop. Nothing is stored to make
 * it work, so it is right for every notebook without anyone opting in.
 *
 * A Server Component, like the note it sits under.
 */
export function PageTurn({ previous, next }: { previous?: Neighbour; next?: Neighbour }) {
  if (!previous && !next) return null;

  return (
    <nav className="page-turn no-print" aria-label="Nearby notes">
      {previous ? (
        <Link href={routes.note(previous.slug)} className="page-turn-link">
          <ChevronLeft size={15} className="page-turn-arrow" aria-hidden="true" />
          <span className="page-turn-text">
            <span className="page-turn-label">Previous</span>
            <span className="page-turn-title">{previous.title}</span>
          </span>
        </Link>
      ) : (
        // Holds the column so a lone "next" stays on the right, where the next
        // page is.
        <span />
      )}

      {next && (
        <Link href={routes.note(next.slug)} className="page-turn-link page-turn-next">
          <span className="page-turn-text">
            <span className="page-turn-label">Next</span>
            <span className="page-turn-title">{next.title}</span>
          </span>
          <ChevronRight size={15} className="page-turn-arrow" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
