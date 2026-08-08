#!/usr/bin/env node
/**
 * Takes the screenshots in the README.
 *
 *   npm run screenshots
 *
 * Starts a dev server if one is not already listening, drives a headless
 * Chromium through four views, and writes them to `docs/images/`.
 *
 * Every shot is made deterministic before the page paints: the reader settings
 * are written into `localStorage` so the theme, the typeface and the index are
 * always the same, and the run waits for webfonts to finish loading. Without
 * that, two runs produce two different pictures and every regeneration is a
 * noisy diff.
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'docs', 'images');

const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:3000';
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Rendered at 1.5× rather than 2×.
 *
 * The paper grain is per-pixel noise, which is exactly the thing PNG cannot
 * compress — at 2× the four screenshots came to 3.2 MB, most of it texture
 * nobody can see at README size. 1.5× stays crisp on a high-density display
 * and costs less than half as much to clone.
 */
const SCALE = 1.5;

/**
 * The settings every screenshot is taken with.
 *
 * Written straight into `localStorage` under the key the settings store reads,
 * so the pre-paint bootstrap applies them before the first frame.
 */
const SETTINGS = {
  theme: 'classic-ivory',
  texture: 25,
  sidebar: true,
  editorToolbar: true,
  animations: false,
};

const SHOTS = [
  {
    name: 'reading',
    path: '/notes/philosophy/stoicism',
    description: 'A note being read',
  },
  {
    name: 'editor',
    path: '/edit/philosophy/stoicism',
    description: 'The editor and its formatting toolbar',
    async prepare(page) {
      await page.waitForSelector('.cm-content');

      // Live preview shows the raw syntax on whichever line the caret is on,
      // which is right in the editor and wrong in a picture of it. Parking the
      // caret at the end of the note leaves every visible line rendered.
      await page.keyboard.press('Control+End');

      /*
       * CodeMirror scrolls the caret into view on its next measure cycle, not
       * synchronously — so the scroll has to be undone *after* letting that
       * happen, or it simply runs again over the top of the reset. Every
       * scrollable ancestor is reset rather than guessing which one moved.
       */
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
        for (const element of document.querySelectorAll(
          '.cm-scroller, .editor-panes, .shell-page',
        )) {
          element.scrollTop = 0;
        }
      });

      // Away from the toolbar, so no button is caught mid-hover.
      await page.mouse.move(VIEWPORT.width - 10, VIEWPORT.height - 10);
    },
  },
  {
    name: 'palette',
    path: '/',
    description: 'The command palette',
    async prepare(page) {
      await page.keyboard.press('Control+k');
      await page.waitForSelector('.palette');
      await page.keyboard.type('stoic', { delay: 40 });
      await page.waitForSelector('.palette-option');
    },
  },
  {
    name: 'themes',
    path: '/settings',
    description: 'The paper themes',
  },
];

async function isUp(url) {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Starts `npm run dev` and resolves once it answers, or throws. */
async function startServer() {
  console.log('No server on', BASE_URL, '— starting one.');

  const server = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isUp(BASE_URL)) return server;
  }

  server.kill();
  throw new Error('The dev server did not come up within a minute.');
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  const started = (await isUp(BASE_URL)) ? null : await startServer();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'light',
    // Screenshots should not be dated by a "3 days ago" that changes each run,
    // but the notes are what they are; this at least fixes the timezone.
    timezoneId: 'UTC',
    locale: 'en-GB',
  });

  // Applied before any script on the page runs, so there is no flash of the
  // default theme and no second paint.
  await context.addInitScript((settings) => {
    window.localStorage.setItem('commonleaf.settings', JSON.stringify(settings));
  }, SETTINGS);

  const page = await context.newPage();

  try {
    for (const shot of SHOTS) {
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });

      // The dev server floats its own toolbar over the corner of the page.
      // Running against `npm start` would not show it at all, but a screenshot
      // script should not require a production build first.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important }' });

      await page.evaluate(() => document.fonts.ready);
      await shot.prepare?.(page);

      // One more frame, so anything that animates in has settled.
      await page.waitForTimeout(250);

      const file = path.join(OUTPUT, `${shot.name}.png`);
      await page.screenshot({ path: file });
      console.log(`✓ ${shot.name}.png — ${shot.description}`);
    }
  } finally {
    await browser.close();
    started?.kill();
  }

  console.log(`\nWritten to ${path.relative(ROOT, OUTPUT)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
