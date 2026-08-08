import { describe, expect, it } from 'vitest';

import { buildBootstrapScript } from '@/lib/settings/bootstrap';
import { DEFAULT_SETTINGS, normaliseSettings } from '@/lib/settings/types';
import { buildThemeStylesheet } from '@/lib/theme/css';
import { displayFonts, editorFonts, readingFonts } from '@/lib/theme/fonts';
import { findTheme, themes } from '@/lib/theme/themes';

describe('themes', () => {
  it('gives every theme a unique id', () => {
    const ids = themes.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines every colour for every theme', () => {
    const keys = Object.keys(themes[0].colors).sort();

    for (const theme of themes) {
      expect(Object.keys(theme.colors).sort(), `${theme.id} palette`).toEqual(keys);
    }
  });

  it('falls back to the first theme for an unknown id', () => {
    expect(findTheme('no-such-theme')).toBe(themes[0]);
  });

  it('ships both light and dark papers', () => {
    expect(themes.some((theme) => theme.mode === 'light')).toBe(true);
    expect(themes.some((theme) => theme.mode === 'dark')).toBe(true);
  });
});

describe('buildThemeStylesheet', () => {
  const css = buildThemeStylesheet();

  it('emits a rule per theme with kebab-case custom properties', () => {
    expect(css).toContain('[data-theme="classic-ivory"]');
    expect(css).toContain('--paper-edge:#E4DBC6');
    expect(css).toContain('--surface-sunken:');
  });

  it('emits a rule for every selectable font', () => {
    for (const font of [...readingFonts, ...editorFonts, ...displayFonts]) {
      expect(css).toContain(`="${font.id}"]`);
    }
  });

  it('maps the matching-heading option back to the reading face', () => {
    expect(css).toContain(
      '[data-display-font="same-as-reading"]{--font-display:var(--font-reading)}',
    );
  });

  it('includes a fallback stack for every real face', () => {
    expect(css).toContain('--font-reading:var(--font-lora), Georgia');
  });
});

describe('normaliseSettings', () => {
  it('returns the defaults for anything unusable', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const settings = normaliseSettings({ theme: 'sepia', fontSize: 21, animations: false });

    expect(settings.theme).toBe('sepia');
    expect(settings.fontSize).toBe(21);
    expect(settings.animations).toBe(false);
  });

  it('clamps values that would break the layout', () => {
    expect(normaliseSettings({ readingWidth: 20000 }).readingWidth).toBe(960);
    expect(normaliseSettings({ fontSize: 2 }).fontSize).toBe(15);
    expect(normaliseSettings({ texture: -50 }).texture).toBe(0);
  });

  it('replaces values of the wrong type with the default', () => {
    expect(normaliseSettings({ lineHeight: 'tall' }).lineHeight).toBe(
      DEFAULT_SETTINGS.lineHeight,
    );
    expect(normaliseSettings({ animations: 'yes' }).animations).toBe(
      DEFAULT_SETTINGS.animations,
    );
  });

  it('drops keys it does not know about', () => {
    expect(normaliseSettings({ somethingRemoved: true })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('buildBootstrapScript', () => {
  const script = buildBootstrapScript(null);

  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it('carries the data the inlined functions need', () => {
    expect(script).toContain('commonleaf.settings');
    expect(script).toContain('prefers-color-scheme: dark');
    expect(script).toContain('data-theme');
  });

  it('contains no closing script tag that could break out of the tag', () => {
    expect(script.toLowerCase()).not.toContain('</script');
  });

  it('cannot be broken out of by a setting edited by hand in the notebook', () => {
    // `dateFormat` is free text, and the notebook's copy is inlined here.
    const hostile = buildBootstrapScript({
      settings: { ...DEFAULT_SETTINGS, dateFormat: '</script><script>alert(1)</script>' },
      updatedAt: 1,
    });

    expect(hostile.toLowerCase()).not.toContain('</script');
    expect(() => new Function(hostile)).not.toThrow();
  });

  it('carries the notebook’s copy so a new browser starts from it', () => {
    const withRemote = buildBootstrapScript({
      settings: { ...DEFAULT_SETTINGS, fontSize: 23 },
      updatedAt: 1,
    });

    expect(withRemote).toContain('"fontSize":23');
  });
});
