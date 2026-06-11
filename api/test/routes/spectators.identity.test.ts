import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SseHub, type SseClient } from '../../src/spectators/sse.js';
import { SpectatorRegistry } from '../../src/spectators/registry.js';
import { spectatorsRouter } from '../../src/routes/spectators.js';

function buildApp(geo: (ip: string) => Promise<string | null>) {
  const peaks = new Map<string, { count: number; at: string }>();
  const registry = new SpectatorRegistry({
    now: () => Date.now(), isoNow: () => new Date().toISOString(),
    raceDate: () => '2026-06-10',
    peaks: { getPeak: (d) => peaks.get(d) ?? null, setPeak: (d, c, a) => { peaks.set(d, { count: c, at: a }); } },
  });
  const hub = new SseHub();
  const received: { event: string; data: unknown }[] = [];
  const client: SseClient = { write: (event, data) => received.push({ event, data }), close: () => {} };
  hub.add(client);
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/spectators', spectatorsRouter({
    registry, hub, geo, insertCheer: () => {},
    raceDate: () => '2026-06-10', isoNow: () => new Date().toISOString(), cooldownMs: 5000,
  }));
  return { app, registry, received };
}

describe('spectator identity + geo', () => {
  it('stores name and auto-resolves a flag, broadcasting a presence snapshot', async () => {
    const { app, registry, received } = buildApp(async () => '🇨🇦');
    const res = await request(app).post('/api/spectators/heartbeat').send({ sessionId: 's1', name: 'maya' });
    expect(res.body.flag).toBe('🇨🇦');
    const snap = registry.snapshot('s1');
    expect(snap.fans[0]).toMatchObject({ name: 'maya', flag: '🇨🇦' });
    const presence = received.find((m) => m.event === 'presence');
    expect(presence).toBeTruthy();
  });

  it('honors a client flag override instead of geo', async () => {
    const { app } = buildApp(async () => '🇨🇦');
    const res = await request(app).post('/api/spectators/heartbeat').send({ sessionId: 's2', flag: '🏎️' });
    expect(res.body.flag).toBe('🏎️');
  });
});
