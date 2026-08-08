import { Page } from '@/components/Page';
import { branding } from '@/lib/branding';
import { ConfigurationError } from '@/lib/config';

/**
 * Shown when the notebook cannot be read.
 *
 * Almost always a first run with no environment file, so it explains what to
 * do rather than reporting a failure.
 */
export function SetupNeeded({ error }: { error: unknown }) {
  const message =
    error instanceof ConfigurationError || error instanceof Error
      ? error.message
      : 'Something went wrong reading the notebook.';

  return (
    <Page>
      <h1 className="font-display text-4xl">Not configured yet</h1>

      <div className="reading mt-6">
        <p>{message}</p>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill it in.{' '}
          {branding.name} needs either a GitHub repository to store notes in, or a directory on
          disk.
        </p>
      </div>
    </Page>
  );
}
