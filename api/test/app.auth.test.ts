import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate.js';
import { createApp, type AppDeps } from '../src/app.js';
import type { AppConfig } from '../src/config.js';

const config: AppConfig = {
  port: 8787, githubToken: 't', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:', geoEnabled: false,
};

const PASSWORD = 'pit-lane-42';
const creds = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

function makeApp() {
  const db = new Database(':memory:');
  migrate(db);
  const deps: AppDeps = { db, config, clock: () => new Date('2026-06-02T15:00:00.000Z') };
  return createApp(deps);
}

describe('SITE_PASSWORD basic-auth gate', () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.SITE_PASSWORD;
    process.env.SITE_PASSWORD = PASSWORD;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = prev;
  });

  it('401s an unauthenticated request and sends a WWW-Authenticate challenge', async () => {
    const res = await request(makeApp()).get('/api/race/today');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/^Basic realm="RacingShape"/);
  });

  it('allows the request with the correct password (any username)', async () => {
    const res = await request(makeApp())
      .get('/api/race/today')
      .set('Authorization', creds('anyone', PASSWORD));
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
  });

  it('401s on a wrong password', async () => {
    const res = await request(makeApp())
      .get('/api/race/today')
      .set('Authorization', creds('anyone', 'wrong'));
    expect(res.status).toBe(401);
  });

  it('leaves /api/health open for platform health checks', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('is inert when SITE_PASSWORD is unset (no auth required)', async () => {
    delete process.env.SITE_PASSWORD;
    const res = await request(makeApp()).get('/api/race/today');
    expect(res.status).toBe(200);
  });
});
