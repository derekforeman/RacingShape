import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SseHub } from '../../src/spectators/sse.js';
import { SpectatorRegistry } from '../../src/spectators/registry.js';
import { spectatorsRouter } from '../../src/routes/spectators.js';

function buildApp() {
  const peaks = new Map<string, { count: number; at: string }>();
  const registry = new SpectatorRegistry({
    now: () => Date.now(),
    isoNow: () => new Date().toISOString(),
    raceDate: () => '2026-06-10',
    peaks: {
      getPeak: (d) => peaks.get(d) ?? null,
      setPeak: (d, count, at) => { peaks.set(d, { count, at }); },
    },
  });
  const hub = new SseHub();
  const app = express();
  app.use(express.json());
  app.use('/api/spectators', spectatorsRouter({
    registry,
    hub,
    geo: async () => null,        // geo disabled for this phase
    insertCheer: () => {},        // unused this phase
    raceDate: () => '2026-06-10',
    isoNow: () => new Date().toISOString(),
    cooldownMs: 5000,
  }));
  return { app, registry, hub };
}

describe('spectator routes (phase 1)', () => {
  it('heartbeat registers a session and returns a flag field', async () => {
    const { app, registry } = buildApp();
    const res = await request(app)
      .post('/api/spectators/heartbeat')
      .send({ sessionId: 's1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('flag');
    expect(registry.count()).toBe(1);
  });

  it('rejects a heartbeat without a sessionId', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/spectators/heartbeat').send({});
    expect(res.status).toBe(400);
  });
});
