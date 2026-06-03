import type Database from 'better-sqlite3';
import type { EventType } from '@racingshape/shared';
import { pointsFor } from '@racingshape/shared';
import { upsertRacer } from '../db/repositories/racers.js';
import { insertEventsIgnore, type EventRow } from '../db/repositories/events.js';
import { raceDateFor } from '../time/raceDate.js';
import type { RawActivity, RawActivityBatch } from './types.js';

const ID_PREFIX: Record<EventType, string> = {
  commit: 'commit',
  pr_opened: 'pr_opened',
  pr_merged: 'pr_merged',
  issue_closed: 'issue_closed',
};

function eventId(a: RawActivity): string {
  return `${ID_PREFIX[a.type]}:${a.nativeId}`;
}

/**
 * Normalize a batch of raw GitHub activity into scored, dated, deduped event rows,
 * upserting each author as a racer (auto-discovery — no roster). Idempotent via
 * INSERT OR IGNORE on the stable event id. Returns the number of rows newly inserted.
 */
export function ingestEvents(db: Database.Database, batch: RawActivityBatch): number {
  const rows: EventRow[] = [];
  for (const a of batch.activities) {
    upsertRacer(db, {
      login: a.author.login,
      displayName: a.author.displayName,
      avatarUrl: a.author.avatarUrl,
      firstSeen: a.occurredAt,
    });
    rows.push({
      id: eventId(a),
      racerLogin: a.author.login,
      type: a.type,
      points: pointsFor(a.type),
      occurredAt: a.occurredAt,
      raceDate: raceDateFor(new Date(a.occurredAt)),
    });
  }
  return insertEventsIgnore(db, rows);
}
