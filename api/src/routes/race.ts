import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { ViewersSummary } from '@racingshape/shared';
import { getToday, getArchive } from '../services/raceService.js';
import { reactionsRouter } from './reactions.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function raceRouter(
  db: Database.Database,
  clock: () => Date,
  getViewers?: () => ViewersSummary,
): Router {
  const router = Router();

  router.get('/today', (_req, res) => {
    const today = getToday(db, clock());
    if (getViewers) today.viewers = getViewers();
    res.json(today);
  });

  // mount POST /today/reactions before the :date catch-all
  router.use('/today/reactions', reactionsRouter(db, clock));

  router.get('/:date', (req, res) => {
    const date = req.params.date;
    if (!DATE_RE.test(date)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const hasData =
      (db.prepare('SELECT 1 FROM events WHERE race_date = ? LIMIT 1').get(date) as unknown) != null ||
      (db.prepare('SELECT 1 FROM race_snapshots WHERE race_date = ? LIMIT 1').get(date) as unknown) != null;
    if (!hasData) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(getArchive(db, date));
  });

  return router;
}
