import { Page, PageHeader } from '@/components/Page';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { branding } from '@/lib/branding';

/**
 * Reader preferences.
 *
 * There is no Save button: a change applies as it is made, and is written to
 * the notebook a couple of seconds later, in one small JSON file that is not a
 * note and never appears in the index.
 */
export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle={`How ${branding.name} looks and reads. Kept in your notebook, so a new browser starts where you left off.`}
      />

      <SettingsForm />
    </Page>
  );
}
