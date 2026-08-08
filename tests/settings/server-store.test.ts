import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SETTINGS_PATH, serialiseStoredSettings } from '@/lib/settings/document';
import { readStoredSettings, writeStoredSettings } from '@/lib/settings/server-store';
import { DEFAULT_SETTINGS } from '@/lib/settings/types';
import { setStorageForTests } from '@/lib/storage';
import type { Change, CommitResult, Storage, TextFile } from '@/lib/storage/types';

let instances = 0;

/**
 * A storage driver that remembers what it was asked to do.
 *
 * The point of these tests is what reaches the port, not what a repository
 * does with it: a write that changes nothing must not arrive as a commit.
 */
class RecordingStorage implements Partial<Storage> {
  commits: { message: string; changes: readonly Change[] }[] = [];
  private files = new Map<string, string>();
  private counter = 0;
  /**
   * Distinct per instance, because the read is cached against the revision on
   * `globalThis` and that outlives a test. Two drivers reporting `r1` would
   * let one test read another's settings.
   */
  private readonly id = (instances += 1);

  seed(path: string, content: string): void {
    this.files.set(path, content);
    this.counter += 1;
  }

  revision(): Promise<string> {
    return Promise.resolve(`${this.id}:${this.counter}`);
  }

  read(path: string): Promise<TextFile | null> {
    const content = this.files.get(path);
    return Promise.resolve(
      content === undefined ? null : { path, content, sha: `sha${this.counter}`, size: 0 },
    );
  }

  commit(message: string, changes: readonly Change[]): Promise<CommitResult> {
    this.commits.push({ message, changes });
    for (const change of changes) {
      if (change.kind === 'write') this.files.set(change.path, change.content);
    }
    this.counter += 1;
    return Promise.resolve({ sha: `${this.id}:${this.counter}`, blobs: {} });
  }
}

let storage: RecordingStorage;

beforeEach(() => {
  storage = new RecordingStorage();
  setStorageForTests(storage as unknown as Storage);
});

afterEach(() => {
  setStorageForTests(null);
});

describe('writeStoredSettings', () => {
  it('writes the file when there is nothing there yet', async () => {
    const stored = await writeStoredSettings({ ...DEFAULT_SETTINGS, fontSize: 22 });

    expect(storage.commits).toHaveLength(1);
    expect(storage.commits[0].changes[0]).toMatchObject({ path: SETTINGS_PATH });
    expect(stored.settings.fontSize).toBe(22);
  });

  it('does not commit when nothing changed', async () => {
    // The timestamp moves on every request, so without an explicit comparison
    // an unchanged write is still a real diff and a real commit.
    storage.seed(
      SETTINGS_PATH,
      serialiseStoredSettings({ settings: DEFAULT_SETTINGS, updatedAt: 5_000 }),
    );

    const stored = await writeStoredSettings({ ...DEFAULT_SETTINGS });

    expect(storage.commits).toEqual([]);
    expect(stored.updatedAt).toBe(5_000);
  });

  it('commits when something did change', async () => {
    storage.seed(
      SETTINGS_PATH,
      serialiseStoredSettings({ settings: DEFAULT_SETTINGS, updatedAt: 5_000 }),
    );

    const stored = await writeStoredSettings({ ...DEFAULT_SETTINGS, binding: true });

    expect(storage.commits).toHaveLength(1);
    expect(stored.updatedAt).toBeGreaterThan(5_000);
  });

  it('is readable again straight away, without waiting for the revision to catch up', async () => {
    await writeStoredSettings({ ...DEFAULT_SETTINGS, ribbon: false });

    expect((await readStoredSettings())?.settings.ribbon).toBe(false);
  });
});

describe('readStoredSettings', () => {
  it('is nothing when the notebook has no settings file', async () => {
    expect(await readStoredSettings()).toBeNull();
  });

  it('is nothing when storage cannot be reached, rather than an error', async () => {
    // It is called from the root layout, which renders on every route
    // including the error pages. An unreachable repository must degrade to the
    // built-in defaults, not take the application down.
    setStorageForTests({
      revision: () => Promise.reject(new Error('unreachable')),
    } as unknown as Storage);

    expect(await readStoredSettings()).toBeNull();
  });
});
