import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseTestEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
});

describe('loadConfig', () => {
  it('applies defaults when only required vars are present (test mode)', () => {
    const cfg = loadConfig(baseTestEnv());
    expect(cfg.port).toBe(8787);
    expect(cfg.repoOwner).toBe('S2AI');
    expect(cfg.repoName).toBe('s2shape');
    expect(cfg.pollIntervalMs).toBe(60_000);
    expect(cfg.snapshotIntervalMs).toBe(300_000);
    expect(cfg.dbPath).toBe('./data/racingshape.db');
  });

  it('reads an empty token in test mode without throwing', () => {
    const cfg = loadConfig(baseTestEnv());
    expect(cfg.githubToken).toBe('');
  });

  it('honors overrides for every var', () => {
    const cfg = loadConfig({
      NODE_ENV: 'test',
      PORT: '9000',
      GITHUB_TOKEN: 'tok_123',
      REPO_OWNER: 'acme',
      REPO_NAME: 'widgets',
      POLL_INTERVAL_MS: '30000',
      SNAPSHOT_INTERVAL_MS: '120000',
      DB_PATH: '/tmp/rs.db',
    });
    expect(cfg.port).toBe(9000);
    expect(cfg.githubToken).toBe('tok_123');
    expect(cfg.repoOwner).toBe('acme');
    expect(cfg.repoName).toBe('widgets');
    expect(cfg.pollIntervalMs).toBe(30_000);
    expect(cfg.snapshotIntervalMs).toBe(120_000);
    expect(cfg.dbPath).toBe('/tmp/rs.db');
  });

  it('throws when GITHUB_TOKEN is missing outside test mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/GITHUB_TOKEN/);
  });

  it('does not throw outside test mode when GITHUB_TOKEN is present', () => {
    const cfg = loadConfig({ NODE_ENV: 'production', GITHUB_TOKEN: 'tok' });
    expect(cfg.githubToken).toBe('tok');
  });

  it('throws on a non-numeric PORT', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', PORT: 'abc' })).toThrow(/PORT/);
  });

  it('throws on a zero or negative interval', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', POLL_INTERVAL_MS: '0' })).toThrow(
      /POLL_INTERVAL_MS/,
    );
    expect(() => loadConfig({ NODE_ENV: 'test', SNAPSHOT_INTERVAL_MS: '-5' })).toThrow(
      /SNAPSHOT_INTERVAL_MS/,
    );
  });

  it('throws on a fractional numeric var', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', PORT: '80.5' })).toThrow(/PORT/);
  });
});
