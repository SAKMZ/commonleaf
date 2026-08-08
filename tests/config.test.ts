import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigurationError, getConfig, resetConfigForTests } from '@/lib/config';

beforeEach(() => {
  resetConfigForTests();
  for (const key of [
    'STORAGE_DRIVER',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPOSITORY',
    'GITHUB_BRANCH',
    'GITHUB_API_BASE_URL',
    'CONTENT_ROOT',
    'CONTENT_DIRECTORY',
  ]) {
    vi.stubEnv(key, '');
  }
});

describe('getConfig', () => {
  it('names the variable that is missing', () => {
    expect(() => getConfig()).toThrow(ConfigurationError);
    expect(() => getConfig()).toThrow(/GITHUB_TOKEN/);
  });

  it('reads the GitHub driver from the environment', () => {
    vi.stubEnv('GITHUB_TOKEN', 'token');
    vi.stubEnv('GITHUB_OWNER', 'owner');
    vi.stubEnv('GITHUB_REPOSITORY', 'repo');

    const config = getConfig();

    expect(config.driver).toBe('github');
    expect(config.github).toMatchObject({
      token: 'token',
      owner: 'owner',
      repository: 'repo',
      branch: 'main',
      apiBaseUrl: 'https://api.github.com',
    });
  });

  it('selects the filesystem driver when a content root is given', () => {
    vi.stubEnv('CONTENT_ROOT', '/data/vault');

    expect(getConfig()).toMatchObject({
      driver: 'filesystem',
      filesystem: { root: '/data/vault' },
    });
  });

  it('lets STORAGE_DRIVER win over the inferred driver', () => {
    vi.stubEnv('STORAGE_DRIVER', 'github');
    vi.stubEnv('CONTENT_ROOT', '/data/vault');
    vi.stubEnv('GITHUB_TOKEN', 'token');
    vi.stubEnv('GITHUB_OWNER', 'owner');
    vi.stubEnv('GITHUB_REPOSITORY', 'repo');

    expect(getConfig().driver).toBe('github');
  });

  it('normalises a content directory written with slashes', () => {
    vi.stubEnv('CONTENT_ROOT', '/data/vault');
    vi.stubEnv('CONTENT_DIRECTORY', '/notes/');

    expect(getConfig().contentDirectory).toBe('notes');
  });

  it('treats whitespace as absent', () => {
    vi.stubEnv('GITHUB_TOKEN', '   ');
    vi.stubEnv('GITHUB_OWNER', 'owner');
    vi.stubEnv('GITHUB_REPOSITORY', 'repo');

    expect(() => getConfig()).toThrow(/GITHUB_TOKEN/);
  });
});
