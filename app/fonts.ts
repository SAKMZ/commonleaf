import {
  Caveat,
  Cormorant_Garamond,
  Crimson_Text,
  EB_Garamond,
  Fira_Code,
  IBM_Plex_Mono,
  JetBrains_Mono,
  Kalam,
  Libre_Baskerville,
  Lora,
  Patrick_Hand,
} from 'next/font/google';

/**
 * Every face the reader can choose, self-hosted by `next/font`.
 *
 * Only the three defaults are preloaded. The others still ship as `@font-face`
 * rules but are fetched lazily, when a reader actually picks them — which is
 * why offering eleven families costs nothing on a first visit.
 *
 * `next/font` requires literal arguments at each call site, so the options are
 * written out rather than shared. `lib/theme/fonts.ts` remains the source of
 * truth for ids and labels; the only thing repeated here is the variable name.
 */

// ── Reading faces ───────────────────────────────────────────────────────────

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-eb-garamond',
  style: ['normal', 'italic'],
  preload: true,
});

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-crimson-text',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  preload: false,
});

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-libre-baskerville',
  weight: ['400', '700'],
  preload: false,
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant-garamond',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  preload: false,
});

const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lora',
  style: ['normal', 'italic'],
  preload: false,
});

// ── Editor faces ────────────────────────────────────────────────────────────

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  preload: true,
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500'],
  preload: false,
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-code',
  preload: false,
});

// ── Display faces ───────────────────────────────────────────────────────────

const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
  preload: true,
});

const patrickHand = Patrick_Hand({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-patrick-hand',
  weight: '400',
  preload: false,
});

const kalam = Kalam({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-kalam',
  weight: ['300', '400'],
  preload: false,
});

/** Applied to `<html>` so every face is available as a CSS variable. */
export const fontVariables = [
  ebGaramond,
  crimsonText,
  libreBaskerville,
  cormorantGaramond,
  lora,
  jetBrainsMono,
  ibmPlexMono,
  firaCode,
  caveat,
  patrickHand,
  kalam,
]
  .map((font) => font.variable)
  .join(' ');
