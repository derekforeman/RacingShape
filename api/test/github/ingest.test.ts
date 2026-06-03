import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { ingestEvents } from '../../src/github/ingest.js';
import type { RawActivityBatch } from '../../src/github/types.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const author = { login: 'devon-r', displayName: 'Devon R', avatarUrl: 'https://a/d.png' };

function batch(activities: RawActivityBatch['activities']): RawActivityBatch {
  return { raceDate: '2026-06-02', activities };
}

describe('ingestEvents', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('maps a commit to id commit:<sha>, type commit, 1 point', () => {
    const inserted = ingestEvents(
      db,
      batch([{ type: 'commit', nativeId: 'sha123', author, occurredAt: '2026-06-02T15:00:00.000Z' }]),
    );
    expect(inserted).toBe(1);
    const row = db.prepare('SELECT * FROM events').get() as any;
    expect(row.id).toBe('commit:sha123');
    expect(row.type).toBe('commit');
    expect(row.points).toBe(1);
    expect(row.racer_login).toBe('devon-r');
    expect(row.occurred_at).toBe('2026-06-02T15:00:00.000Z');
  });

  it('maps each type to its dedupe id and weighted points', () => {
    ingestEvents(
      db,
      batch([
        { type: 'pr_opened', nativeId: '12', author, occurredAt: '2026-06-02T16:00:00.000Z' },
        { type: 'pr_merged', nativeId: '12', author, occurredAt: '2026-06-02T17:00:00.000Z' },
        { type: 'issue_closed', nativeId: '34', author, occurredAt: '2026-06-02T18:00:00.000Z' },
      ]),
    );
    const rows = db.prepare('SELECT id, type, points FROM events ORDER BY id').all() as any[];
    expect(rows).toEqual([
      { id: 'issue_closed:34', type: 'issue_closed', points: 3 },
      { id: 'pr_merged:12', type: 'pr_merged', points: 8 },
      { id: 'pr_opened:12', type: 'pr_opened', points: 5 },
    ]);
  });

  it('derives race_date from the NY local date of occurredAt', () => {
    // 2026-06-02T03:30:00Z is 11:30pm EDT on 2026-06-01 (UTC-4).
    ingestEvents(
      db,
      batch([{ type: 'commit', nativeId: 'late', author, occurredAt: '2026-06-02T03:30:00.000Z' }]),
    );
    const row = db.prepare('SELECT race_date FROM events').get() as any;
    expect(row.race_date).toBe('2026-06-01');
  });

  it('upserts the author as a racer with first_seen', () => {
    ingestEvents(
      db,
      batch([{ type: 'commit', nativeId: 's1', author, occurredAt: '2026-06-02T15:00:00.000Z' }]),
    );
    const racer = db.prepare('SELECT * FROM racers WHERE github_login = ?').get('devon-r') as any;
    expect(racer.display_name).toBe('Devon R');
    expect(racer.avatar_url).toBe('https://a/d.png');
    expect(typeof racer.first_seen).toBe('string');
  });

  it('is idempotent: re-ingesting the same activity inserts nothing new', () => {
    const b = batch([{ type: 'commit', nativeId: 's1', author, occurredAt: '2026-06-02T15:00:00.000Z' }]);
    expect(ingestEvents(db, b)).toBe(1);
    expect(ingestEvents(db, b)).toBe(0);
    const count = db.prepare('SELECT COUNT(*) AS n FROM events').get() as any;
    expect(count.n).toBe(1);
  });
});
