import { Page, PageHeader } from '@/components/Page';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { branding } from '@/lib/branding';

/**
 * Reader preferences.
 *
 * Nothing on this page touches the repository — every setting describes how one
 * person, on one device, likes to read. That is why there is no Save button and
 * no commit.
 */
export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle={`How ${branding.name} looks and behaves on this device. Kept in your browser, never in your notes.`}
      />

      <SettingsForm />
    </Page>
  );
}
