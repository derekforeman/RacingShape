import { Router, type Request, type Response } from 'express';
import type {
  HeartbeatBody, HeartbeatResponse, CheerBody, CheerResponse,
} from '@racingshape/shared';
import type { SseHub, SseClient } from '../spectators/sse.js';
import type { SpectatorRegistry } from '../spectators/registry.js';

export interface SpectatorDeps {
  registry: SpectatorRegistry;
  hub: SseHub;
  geo: (ip: string) => Promise<string | null>;     // IP -> flag emoji or null
  insertCheer: (row: {
    targetLogin: string; label: string; raceDate: string; createdAt: string;
  }) => void;
  raceDate: () => string;
  isoNow: () => string;
  cooldownMs: number;
}

// Bound string lengths so oversized payloads can't bloat the registry or cooldown map.
const MAX_SESSION_ID = 128;
const MAX_LOGIN = 100;

function validHeartbeat(b: unknown): b is HeartbeatBody {
  if (typeof b !== 'object' || b === null) return false;
  const id = (b as Record<string, unknown>).sessionId;
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_SESSION_ID;
}

function validCheer(b: unknown): b is CheerBody {
  if (typeof b !== 'object' || b === null) return false;
  const x = b as Record<string, unknown>;
  return typeof x.sessionId === 'string' && x.sessionId.length > 0 && x.sessionId.length <= MAX_SESSION_ID
    && typeof x.targetLogin === 'string' && x.targetLogin.length > 0 && x.targetLogin.length <= MAX_LOGIN;
}

export function spectatorsRouter(deps: SpectatorDeps): Router {
  const { registry, hub, geo, insertCheer, raceDate, isoNow, cooldownMs } = deps;
  const router = Router();
  const lastCheerAt = new Map<string, number>(); // sessionId -> epoch ms

  const broadcastPresence = (): void => {
    hub.broadcast('presence', registry.snapshot());
  };

  // GET /api/spectators/stream — Server-Sent Events
  router.get('/stream', (req: Request, res: Response) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering
    });
    res.flushHeaders?.();

    const client: SseClient = {
      write: (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      close: () => res.end(),
    };
    const remove = hub.add(client);
    client.write('presence', registry.snapshot()); // initial snapshot

    const keepalive = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(keepalive);
      remove();
      broadcastPresence();
    });
  });

  // POST /api/spectators/heartbeat
  router.post('/heartbeat', async (req: Request, res: Response) => {
    if (!validHeartbeat(req.body)) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const body = req.body as HeartbeatBody;

    // Resolve auto flag from IP unless the client supplied an override.
    let autoFlag: string | null = null;
    if (!body.flag) {
      const ip = req.ip ?? '';
      autoFlag = await geo(ip).catch(() => null);
    }

    registry.upsert({
      sessionId: body.sessionId,
      name: body.name ?? null,
      flag: body.flag ?? autoFlag,
      cheerForLogin: body.cheerForLogin ?? null,
    });
    // Broadcasts are shared by all clients, so they never carry a per-recipient
    // isSelf flag — each client computes "you" locally by matching its own sessionId.
    broadcastPresence();

    const out: HeartbeatResponse = { flag: body.flag ?? autoFlag };
    res.status(200).json(out);
  });

  // POST /api/spectators/cheer
  router.post('/cheer', (req: Request, res: Response) => {
    if (!validCheer(req.body)) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const body = req.body as CheerBody;
    const now = Date.now();
    const last = lastCheerAt.get(body.sessionId) ?? 0;
    if (now - last < cooldownMs) {
      const out: CheerResponse = { ok: false, reason: 'cooldown' };
      res.status(200).json(out);
      return;
    }
    // Sweep entries whose cooldown has already elapsed, then record this cheer. Keeps the
    // map bounded to sessions that cheered within the last cooldownMs (not every session ever).
    for (const [sid, t] of lastCheerAt) {
      if (now - t >= cooldownMs) lastCheerAt.delete(sid);
    }
    lastCheerAt.set(body.sessionId, now);

    // Label = the cheering fan's self-set name (from registry), else "a fan".
    const label = registry.snapshot().fans.find((f) => f.id === body.sessionId)?.name ?? 'a fan';

    insertCheer({
      targetLogin: body.targetLogin,
      label,
      raceDate: raceDate(),
      createdAt: isoNow(),
    });
    hub.broadcast('cheer', { type: 'cheer', targetLogin: body.targetLogin, label });

    const out: CheerResponse = { ok: true };
    res.status(200).json(out);
  });

  return router;
}
