import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AppConfig } from './config.js';
import { raceRouter } from './routes/race.js';
import { racesRouter } from './routes/races.js';
import { statsRouter } from './routes/stats.js';
import { spectatorsRouter } from './routes/spectators.js';
import { SseHub } from './spectators/sse.js';
import { SpectatorRegistry } from './spectators/registry.js';
import { raceDateFor } from './time/raceDate.js';
import { getViewerPeak, upsertViewerPeak } from './db/repositories/viewerPeaks.js';
import { insertCheer } from './db/repositories/reactions.js';

export interface SpectatorRuntime {
  registry: SpectatorRegistry;
  hub: SseHub;
}

export interface AppDeps {
  db: Database.Database;
  config: AppConfig;
  clock: () => Date;
  geo?: (ip: string) => Promise<string | null>; // default: always null
  onSpectators?: (rt: SpectatorRuntime) => void; // index.ts hooks the reaper here
}

/**
 * Optional site-wide HTTP Basic Auth gate. Enabled only when SITE_PASSWORD is set
 * (inert in local dev). Protects the whole single-origin app — static bundle and
 * /api/* alike — behind one shared password (any username). `/api/health` is exempt
 * so platform health checks keep working. Constant-time comparison avoids leaking
 * the password length via timing.
 */
function passwordGate(password: string) {
  const expected = Buffer.from(password, 'utf8');
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/api/health') {
      next();
      return;
    }
    const encoded = /^Basic (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const supplied = Buffer.from(decoded.slice(decoded.indexOf(':') + 1), 'utf8');
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
        next();
        return;
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="RacingShape", charset="UTF-8"');
    res.status(401).json({ error: 'unauthorized' });
  };
}

/** Build the Express app. No `listen` — callers (index.ts / tests) own the server. */
export function createApp(deps: AppDeps): Express {
  const { db, config, clock } = deps;
  const app = express();

  // Optional shared-password gate (set SITE_PASSWORD to enable). First middleware, so it
  // covers the web bundle and every /api route; /api/health stays open for health checks.
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    app.use(passwordGate(sitePassword));
  }

  app.use(express.json());

  app.set('trust proxy', true);

  const hub = new SseHub();
  const registry = new SpectatorRegistry({
    now: () => clock().getTime(),
    isoNow: () => clock().toISOString(),
    raceDate: () => raceDateFor(clock()),
    peaks: {
      getPeak: (d) => {
        const p = getViewerPeak(db, d);
        return p ? { count: p.peakCount, at: p.peakAt } : null;
      },
      setPeak: (d, count, at) => upsertViewerPeak(db, d, count, at),
    },
  });
  app.use('/api/spectators', spectatorsRouter({
    registry,
    hub,
    geo: deps.geo ?? (async () => null),
    insertCheer: ({ targetLogin, label, raceDate, createdAt }) =>
      insertCheer(db, { id: randomUUID(), raceDate, targetLogin, label, createdAt }),
    raceDate: () => raceDateFor(clock()),
    isoNow: () => clock().toISOString(),
    cooldownMs: 5000,
  }));
  deps.onSpectators?.({ registry, hub });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/race', raceRouter(db, clock));
  app.use('/api/races', racesRouter(db));
  app.use('/api/stats', statsRouter(db, config, clock));

  // Serve the built web bundle (production single-origin deploy). Registered AFTER the
  // /api routes (so API always wins) and BEFORE the 404 handler. Inert in dev where
  // WEB_DIST is unset — Vite serves the frontend and proxies /api (hosting.md §4).
  const webDist = process.env.WEB_DIST;
  if (webDist) {
    app.use(express.static(webDist));
    // SPA fallback: any non-/api path returns index.html for client-side routing.
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  // 404 (API routes only once WEB_DIST is set; everything otherwise)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  // error handler (must keep 4 args for Express to treat it as such)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', message });
  });

  return app;
}
