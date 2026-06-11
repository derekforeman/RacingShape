import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { listForDate } from '../src/db/repositories/reactions.js';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', NODE_ENV: 'test' });
  const app = createApp({ db, config, clock: () => new Date('2026-06-10T12:00:00Z') });
  return { app, db };
}

describe('cheer route', () => {
  it('persists a cheer and enforces the cooldown', async () => {
    const { app, db } = setup();

    const first = await request(app)
      .post('/api/spectators/cheer')
      .send({ sessionId: 's1', targetLogin: 'devon-r' });
    expect(first.body).toEqual({ ok: true });

    const list = listForDate(db, '2026-06-10');
    expect(list.filter((r) => r.source === 'cheer')).toHaveLength(1);
    expect(list[0]).toMatchObject({ targetLogin: 'devon-r', reactor: 'a fan' });

    const second = await request(app)
      .post('/api/spectators/cheer')
      .send({ sessionId: 's1', targetLogin: 'devon-r' });
    expect(second.body).toEqual({ ok: false, reason: 'cooldown' });
  });
});
