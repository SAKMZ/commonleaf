import type { Settings } from './types';

/**
 * Writes settings onto the document element.
 *
 * This function is deliberately self-contained: it is stringified into the
 * inline bootstrap script that runs before first paint, so it must not
 * reference any import at runtime. Type-only imports are erased and are fine.
 *
 * Everything else in the application reads these attributes and custom
 * properties from CSS. No component needs to know a theme exists.
 */
export function applySettings(
  root: HTMLElement,
  settings: Settings,
  theme: { id: string; mode: 'light' | 'dark' },
): void {
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);
  root.setAttribute('data-reading-font', settings.readingFont);
  root.setAttribute('data-editor-font', settings.editorFont);
  root.setAttribute('data-display-font', settings.displayFont);
  root.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
  root.setAttribute('data-motion', settings.animations ? 'full' : 'reduced');
  root.setAttribute('data-edges', settings.deckledEdges ? 'deckled' : 'cut');
  root.setAttribute('data-binding', settings.binding ? 'on' : 'off');
  root.setAttribute('data-ribbon', settings.ribbon ? 'on' : 'off');
  root.setAttribute('data-sidebar', settings.sidebar ? 'open' : 'closed');

  // Lets the browser pick matching scrollbars, form controls and caret colour.
  root.style.colorScheme = theme.mode;

  const style = root.style;
  style.setProperty('--texture-strength', String(settings.texture / 100));
  style.setProperty('--reading-size', `${settings.fontSize}px`);
  style.setProperty('--reading-leading', String(settings.lineHeight));
  style.setProperty('--paragraph-space', `${settings.paragraphSpacing}em`);
  style.setProperty('--measure', `${settings.readingWidth}px`);
}
