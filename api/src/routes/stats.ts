import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config.js';
import { getStats } from '../services/statsService.js';

export function statsRouter(db: Database.Database, config: AppConfig, clock: () => Date): Router {
  const router = Router();
  router.get('/', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '14d';
    res.json(getStats(db, range, clock(), config));
  });
  return router;
}
