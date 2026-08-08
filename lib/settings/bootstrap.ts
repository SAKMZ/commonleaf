import { SYSTEM_THEME_PAIR, themes } from '../theme/themes';
import { applySettings } from './apply';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type Settings } from './types';

interface BootstrapData {
  storageKey: string;
  defaults: Settings;
  /** Theme id to light/dark mode, so the script can set `color-scheme`. */
  modes: Record<string, 'light' | 'dark'>;
  systemPair: { light: string; dark: string };
}

/**
 * Runs before first paint to restore the reader's theme.
 *
 * Like {@link applySettings} this is stringified into an inline script, so it
 * may not reference imports. It receives its data as an argument and the
 * shared apply function as a parameter, which is what keeps the two code paths
 * — this one and the React provider — from drifting apart.
 */
function bootstrap(data: BootstrapData, apply: typeof applySettings): void {
  try {
    const stored = window.localStorage.getItem(data.storageKey);
    // `Object.assign` rather than object spread: this function is stringified,
    // so it must not depend on a compiler helper that lives outside its body.
    const settings: Settings = stored
      ? Object.assign({}, data.defaults, JSON.parse(stored) as Partial<Settings>)
      : data.defaults;

    let id = settings.theme;
    if (id === 'system' || !data.modes[id]) {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      id = dark ? data.systemPair.dark : data.systemPair.light;
    }

    apply(document.documentElement, settings, { id, mode: data.modes[id] ?? 'light' });
  } catch {
    // Private browsing, disabled storage, corrupt JSON: the stylesheet's own
    // defaults are perfectly usable, so failing silently is the right call.
  }
}

/**
 * The inline script tag contents. Rendered by the root layout with
 * `dangerouslySetInnerHTML`; it contains no user input.
 */
export function buildBootstrapScript(): string {
  const data: BootstrapData = {
    storageKey: SETTINGS_STORAGE_KEY,
    defaults: DEFAULT_SETTINGS,
    modes: Object.fromEntries(themes.map((theme) => [theme.id, theme.mode])),
    systemPair: { ...SYSTEM_THEME_PAIR },
  };

  return `(${bootstrap.toString()})(${JSON.stringify(data)},${applySettings.toString()})`;
}
