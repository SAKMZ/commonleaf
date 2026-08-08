import type { Metadata, Viewport } from 'next';

import { branding } from '@/lib/branding';
import { buildBootstrapScript } from '@/lib/settings/bootstrap';
import { DEFAULT_SETTINGS } from '@/lib/settings/types';
import { buildThemeStylesheet } from '@/lib/theme/css';
import { findTheme } from '@/lib/theme/themes';

import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: branding.name, template: `%s · ${branding.name}` },
  description: branding.description,
  applicationName: branding.name,
  // A private notebook has no business in a search index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches the default theme's desk colour so the browser chrome blends in.
  themeColor: findTheme(DEFAULT_SETTINGS.theme).colors.surface,
};

const themeStylesheet = buildThemeStylesheet();
const bootstrapScript = buildBootstrapScript();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = findTheme(DEFAULT_SETTINGS.theme);

  return (
    <html
      lang="en"
      className={fontVariables}
      // Server-rendered defaults. The bootstrap script below replaces them
      // with the reader's own settings before the first paint, so there is no
      // flash of the wrong paper.
      data-theme={theme.id}
      data-mode={theme.mode}
      data-reading-font={DEFAULT_SETTINGS.readingFont}
      data-editor-font={DEFAULT_SETTINGS.editorFont}
      data-display-font={DEFAULT_SETTINGS.displayFont}
      data-motion="full"
      data-contrast="normal"
      data-edges="cut"
      data-binding="off"
      data-ribbon="on"
      data-sidebar="open"
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStylesheet }} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />

        <a
          href="#main"
          className="bg-paper text-ink sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-100 focus:border focus:px-4 focus:py-2"
        >
          Skip to content
        </a>

        {children}

        <div className="paper-grain" aria-hidden="true" />
      </body>
    </html>
  );
}
