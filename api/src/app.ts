import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { AppConfig } from './config.js';
import { raceRouter } from './routes/race.js';
import { racesRouter } from './routes/races.js';
import { statsRouter } from './routes/stats.js';

export interface AppDeps {
  db: Database.Database;
  config: AppConfig;
  clock: () => Date;
}

/** Build the Express app. No `listen` — callers (index.ts / tests) own the server. */
export function createApp(deps: AppDeps): Express {
  const { db, config, clock } = deps;
  const app = express();
  app.use(express.json());

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
