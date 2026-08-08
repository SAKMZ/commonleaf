/**
 * The sheet every page is written on.
 *
 * One component rather than the same four class names in a dozen files, so
 * that changing the margins — or the paper itself — is a single edit.
 */
export function Page({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** For listings, which read better a little wider than prose does. */
  wide?: boolean;
}) {
  return (
    <main id="main" className="flex flex-1 justify-center px-4 py-8 sm:py-14">
      <div
        className="sheet w-full px-7 py-10 sm:px-14 sm:py-14"
        // The measure is a reader preference, so the width is computed from it
        // at runtime rather than picked from a fixed scale.
        style={{ maxWidth: wide ? 'calc(var(--measure) + 8rem)' : 'var(--measure)' }}
      >
        <div className="ribbon" aria-hidden="true" />
        {children}
      </div>
    </main>
  );
}

/**
 * The heading block at the top of a listing page.
 *
 * Kept beside {@link Page} because the two are always used together and the
 * spacing between them is the thing being defined.
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Actions, shown at the end of the title row. */
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{title}</h1>
        {children}
      </div>
      {subtitle && <p className="text-ink-muted mt-2 text-base italic">{subtitle}</p>}
    </header>
  );
}
