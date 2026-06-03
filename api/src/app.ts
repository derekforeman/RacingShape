import express, { type Express, type NextFunction, type Request, type Response } from 'express';
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

  // 404
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
