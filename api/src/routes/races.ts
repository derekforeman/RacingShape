import { Router } from 'express';
import type Database from 'better-sqlite3';
import { listRaces } from '../services/raceService.js';

export function racesRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(listRaces(db));
  });
  return router;
}
