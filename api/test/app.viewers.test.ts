import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

function app() {
  const db = openDb(':memory:');
  migrate(db);
  const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', NODE_ENV: 'test' });
  return createApp({ db, config, clock: () => new Date('2026-06-10T12:00:00Z') });
}

describe('GET /api/race/today includes viewers', () => {
  it('exposes a viewers summary reflecting live spectators', async () => {
    const a = app();
    await request(a).post('/api/spectators/heartbeat').send({ sessionId: 's1' });
    const res = await request(a).get('/api/race/today');
    expect(res.status).toBe(200);
    expect(res.body.viewers).toMatchObject({ count: 1 });
    expect(res.body.viewers).toHaveProperty('peak');
    expect(res.body.viewers).toHaveProperty('peakAt');
  });
});
