import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from '../src/db/migrate.js';
import { createApp, type AppDeps } from '../src/app.js';
import type { AppConfig } from '../src/config.js';

const config: AppConfig = {
  port: 8787, githubToken: 't', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:',
};

const INDEX_HTML = '<!doctype html><html><title>RacingShape</title><body><div id="root"></div></body></html>';

describe('static web bundle serving (WEB_DIST, hosting.md §4)', () => {
  let dir: string;
  let prev: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs-web-'));
    writeFileSync(join(dir, 'index.html'), INDEX_HTML);
    prev = process.env.WEB_DIST;
    process.env.WEB_DIST = dir;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WEB_DIST;
    else process.env.WEB_DIST = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  function makeApp() {
    const db = new Database(':memory:');
    migrate(db);
    const deps: AppDeps = { db, config, clock: () => new Date('2026-06-02T15:00:00.000Z') };
    return createApp(deps);
  }

  it('serves index.html at the root', async () => {
    const res = await request(makeApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
  });

  it('serves index.html for a deep client-side route (SPA fallback)', async () => {
    const res = await request(makeApp()).get('/race/2026-06-01');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
  });

  it('still serves /api routes (API wins over the SPA fallback)', async () => {
    const res = await request(makeApp()).get('/api/race/today');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
  });

  it('unknown /api routes still 404 JSON, not index.html', async () => {
    const res = await request(makeApp()).get('/api/race/1999-01-01');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
