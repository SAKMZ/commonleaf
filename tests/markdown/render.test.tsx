// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoteMarkdown } from '@/components/markdown/NoteMarkdown';
import { assetUrl, resolveAssetPath } from '@/lib/markdown/assets';
import type { WikiLink } from '@/lib/notes/wikilinks';

/** Treats anything named "Missing" as a note that has not been written yet. */
function resolveWikiLink(link: WikiLink) {
  const missing = link.target === 'Missing';
  return { href: `/notes/${link.target.toLowerCase().replace(/\s+/g, '-')}`, missing };
}

function renderNote(content: string, folder = '') {
  return render(
    <NoteMarkdown content={content} folder={folder} resolveWikiLink={resolveWikiLink} />,
  );
}

describe('NoteMarkdown', () => {
  it('renders headings, emphasis and lists', () => {
    const { container } = renderNote('# Title\n\nSome **bold** text.\n\n- one\n- two');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders GitHub tables inside a scrolling container', () => {
    const { container } = renderNote('| a | b |\n| - | - |\n| 1 | 2 |');

    expect(container.querySelector('.table-scroll table')).not.toBeNull();
  });

  it('renders task lists', () => {
    const { container } = renderNote('- [x] done\n- [ ] todo');
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    expect(boxes).toHaveLength(2);
    expect(boxes[0].checked).toBe(true);
  });

  it('renders footnotes', () => {
    const { container } = renderNote('Text with a note[^1]\n\n[^1]: The footnote.');

    expect(container.querySelector('.footnotes')).not.toBeNull();
  });

  it('turns a wiki link into a link', () => {
    renderNote('See [[Atomic Habits]] tonight.');
    const link = screen.getByRole('link', { name: 'Atomic Habits' });

    expect(link).toHaveAttribute('href', '/notes/atomic-habits');
    expect(link).toHaveClass('wikilink');
    expect(link).toHaveAttribute('data-missing', 'false');
  });

  it('marks a wiki link whose note does not exist yet', () => {
    renderNote('See [[Missing]].');

    expect(screen.getByRole('link', { name: 'Missing' })).toHaveAttribute(
      'data-missing',
      'true',
    );
  });

  it('uses the label of a wiki link as its text', () => {
    renderNote('See [[Atomic Habits|the book]].');

    expect(screen.getByRole('link', { name: 'the book' })).toHaveAttribute(
      'href',
      '/notes/atomic-habits',
    );
  });

  it('leaves wiki links inside code alone', () => {
    const { container } = renderNote('Write `[[Target]]` to link.');

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('code')).toHaveTextContent('[[Target]]');
  });

  it('opens external links safely and leaves internal ones to the router', () => {
    renderNote('[out](https://example.com) and [in](/notes/other)');

    expect(screen.getByRole('link', { name: 'out' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByRole('link', { name: 'in' })).not.toHaveAttribute('target');
  });

  it('points images at the media route, relative to the note', () => {
    const { container } = renderNote('![a photo](photo.png)', 'books');

    expect(container.querySelector('img')).toHaveAttribute('src', '/api/media/books/photo.png');
  });

  it('treats a leading slash as the top of the content directory', () => {
    const { container } = renderNote('![a photo](/images/photo.png)', 'books/philosophy');

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/media/images/photo.png',
    );
  });

  it('lazily loads images', () => {
    const { container } = renderNote('![a](a.png)');

    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy');
  });

  it('renders a callout with its title', () => {
    const { container } = renderNote('> [!warning] Take care\n> Something to watch for.');
    const callout = container.querySelector('.callout');

    expect(callout).not.toBeNull();
    expect(callout).toHaveAttribute('data-callout', 'warning');
    expect(container.querySelector('.callout-title')).toHaveTextContent('Take care');
    expect(callout).toHaveTextContent('Something to watch for.');
  });

  it('renders a callout with no title', () => {
    const { container } = renderNote('> [!note]\n> Just the body.');

    expect(container.querySelector('.callout-title')).toBeNull();
    expect(container.querySelector('.callout')).toHaveTextContent('Just the body.');
  });

  it('leaves an ordinary blockquote as a blockquote', () => {
    const { container } = renderNote('> Not a callout.');

    expect(container.querySelector('.callout')).toBeNull();
    expect(container.querySelector('blockquote')).toHaveTextContent('Not a callout.');
  });

  it('does not render raw HTML', () => {
    const { container } = renderNote('<script>window.hacked = true</script>\n\nAfter.');

    expect(container.querySelector('script')).toBeNull();
  });

  it('applies typographic quotes and dashes', () => {
    const { container } = renderNote('"Quoted" -- dashed');

    expect(container.textContent).toContain('“Quoted”');
    expect(container.textContent).toContain('–');
  });

  it('gives headings ids so they can be linked to', () => {
    const { container } = renderNote('## A Section Heading');

    expect(container.querySelector('h2')).toHaveAttribute('id', 'a-section-heading');
  });
});

describe('resolveAssetPath', () => {
  it('resolves against the note folder', () => {
    expect(resolveAssetPath('photo.png', 'books')).toBe('books/photo.png');
    expect(resolveAssetPath('../images/photo.png', 'books/philosophy')).toBe(
      'books/images/photo.png',
    );
  });

  it('refuses to climb above the content directory', () => {
    expect(resolveAssetPath('../../../etc/passwd', 'books')).toBeNull();
  });

  it('leaves external URLs alone', () => {
    expect(assetUrl('https://example.com/a.png', 'books')).toBe('https://example.com/a.png');
    expect(assetUrl('data:image/png;base64,AAAA', '')).toBe('data:image/png;base64,AAAA');
  });

  it('encodes each segment', () => {
    expect(assetUrl('a photo.png', 'my books')).toBe('/api/media/my%20books/a%20photo.png');
  });
});
