import { displayFonts, editorFonts, readingFonts, type FontChoice } from './fonts';
import { themes } from './themes';

/**
 * Generates the stylesheet that binds themes and fonts to CSS custom
 * properties.
 *
 * Writing this by hand would mean maintaining the same palette in two places —
 * once for the settings screen and once for the stylesheet — and the two would
 * eventually disagree. Generating it costs a couple of kilobytes of inline CSS
 * and removes the possibility entirely.
 */

function toCustomProperty(key: string): string {
  return `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function themeRules(): string {
  return themes
    .map((theme) => {
      const declarations = Object.entries(theme.colors)
        .map(([key, value]) => `${toCustomProperty(key)}:${value}`)
        .join(';');
      return `[data-theme="${theme.id}"]{${declarations}}`;
    })
    .join('\n');
}

function fontRules(attribute: string, role: string, choices: readonly FontChoice[]): string {
  return choices
    .map((choice) => {
      const value =
        choice.variable === '--font-reading-selected'
          ? 'var(--font-reading)'
          : `var(${choice.variable}), ${choice.fallback}`;
      return `[data-${attribute}="${choice.id}"]{--font-${role}:${value}}`;
    })
    .join('\n');
}

export function buildThemeStylesheet(): string {
  return [
    themeRules(),
    fontRules('reading-font', 'reading', readingFonts),
    fontRules('editor-font', 'editor', editorFonts),
    // Display rules come last so `Match body text` resolves against the
    // reading face that was just selected.
    fontRules('display-font', 'display', displayFonts),
  ].join('\n');
}
