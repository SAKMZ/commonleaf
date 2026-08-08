import { SYSTEM_THEME_PAIR, themes } from '../theme/themes';
import { applySettings } from './apply';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type Settings } from './types';

interface StoredShape {
  settings?: Settings;
  updatedAt?: string;
}

interface BootstrapData {
  storageKey: string;
  defaults: Settings;
  /** What the notebook holds, already read on the server. `null` if nothing. */
  remote: { settings: Settings; updatedAt: number } | null;
  /** Theme id to light/dark mode, so the script can set `color-scheme`. */
  modes: Record<string, 'light' | 'dark'>;
  systemPair: { light: string; dark: string };
}

/**
 * Runs before first paint to restore the reader's settings.
 *
 * There are two copies: the one in the notebook, which the server has already
 * read and inlined here, and the one in `localStorage`, which is this device's
 * and is written the instant anything changes. The newer wins — so a browser
 * that has never seen this notebook gets the setup from the repository, and a
 * device whose last change has not been committed yet keeps it.
 *
 * When the notebook wins, its copy is written to `localStorage` immediately.
 * That is what lets the rest of the application go on reading one place.
 *
 * Like {@link applySettings} this is stringified into an inline script, so it
 * may not reference imports. It receives its data as an argument and the
 * shared apply function as a parameter, which is what keeps the two code paths
 * — this one and the React store — from drifting apart.
 */
function bootstrap(data: BootstrapData, apply: typeof applySettings): void {
  try {
    let settings = data.defaults;
    let localTime = -1;

    const raw = window.localStorage.getItem(data.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredShape & Settings;
      // A bare settings object is what this key held before the notebook did:
      // read it, but let anything in the notebook take precedence once.
      const local: Settings | undefined = parsed.settings ?? (parsed as Settings);
      // `Object.assign` rather than object spread: this function is
      // stringified, so it must not depend on a compiler helper outside it.
      settings = Object.assign({}, data.defaults, local);
      localTime = parsed.settings ? Date.parse(String(parsed.updatedAt)) || 0 : 0;
    }

    if (data.remote && data.remote.updatedAt > localTime) {
      settings = Object.assign({}, data.defaults, data.remote.settings);
      window.localStorage.setItem(
        data.storageKey,
        JSON.stringify({
          settings: settings,
          updatedAt: new Date(data.remote.updatedAt).toISOString(),
        }),
      );
    }

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
 * `dangerouslySetInnerHTML`.
 *
 * The only thing here that is not a constant is `remote`, read from a file in
 * the reader's own repository. `normaliseSettings` has already reduced it to
 * bounded numbers, booleans and strings, but strings are still free text — so
 * `<` is escaped, because a `dateFormat` containing `</script>` would
 * otherwise end this tag early. Hand-editing a file in your own notebook can
 * only hurt you, and it should not even do that.
 */
export function buildBootstrapScript(
  remote: { settings: Settings; updatedAt: number } | null,
): string {
  const data: BootstrapData = {
    storageKey: SETTINGS_STORAGE_KEY,
    defaults: DEFAULT_SETTINGS,
    remote,
    modes: Object.fromEntries(themes.map((theme) => [theme.id, theme.mode])),
    systemPair: { ...SYSTEM_THEME_PAIR },
  };

  const payload = JSON.stringify(data).replace(/</g, '\\u003c');

  return `(${bootstrap.toString()})(${payload},${applySettings.toString()})`;
}
