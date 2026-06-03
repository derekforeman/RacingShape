import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { CreateReactionBody, CreateReactionResponse, ReactionKind, ReactionSummary } from '@racingshape/shared';
import { insertReaction, summariesForDate } from '../db/repositories/reactions.js';
import { raceDateFor } from '../time/raceDate.js';

const KINDS: ReactionKind[] = ['🔥', '⚡', '🏎️'];

function validate(body: unknown): body is CreateReactionBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.targetLogin === 'string' && b.targetLogin.length > 0 &&
    typeof b.reactor === 'string' && b.reactor.length > 0 &&
    typeof b.kind === 'string' && KINDS.includes(b.kind as ReactionKind)
  );
}

const EMPTY_SUMMARY: ReactionSummary = { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } };

/** POST /api/race/today/reactions — cosmetic boost, today only, never affects score. */
export function reactionsRouter(db: Database.Database, clock: () => Date): Router {
  const router = Router();

  router.post('/', (req, res) => {
    if (!validate(req.body)) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const body = req.body as CreateReactionBody;
    const raceDate = raceDateFor(clock());
    insertReaction(db, {
      id: randomUUID(),
      raceDate,
      targetLogin: body.targetLogin,
      kind: body.kind,
      reactor: body.reactor,
      createdAt: clock().toISOString(),
    });
    const summary = summariesForDate(db, raceDate).get(body.targetLogin) ?? EMPTY_SUMMARY;
    const out: CreateReactionResponse = { ok: true, reactions: summary };
    res.status(201).json(out);
  });

  return router;
}
