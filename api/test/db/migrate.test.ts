import { describe, it, expect } from 'vitest';
import { openDb } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';

const EXPECTED_TABLES = [
  'racers',
  'events',
  'race_snapshots',
  'daily_stats',
  'reactions',
  'http_cache',
  'poll_meta',
  'viewer_peaks',
];

function tableNames(db: ReturnType<typeof openDb>): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name)
    .filter((n) => !n.startsWith('sqlite_'));
}

describe('migrate', () => {
  it('creates every canonical table', () => {
    const db = openDb(':memory:');
    migrate(db);
    const names = tableNames(db);
    for (const t of EXPECTED_TABLES) {
      expect(names).toContain(t);
    }
  });

  it('is idempotent — running twice does not throw and keeps tables intact', () => {
    const db = openDb(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    const names = tableNames(db);
    for (const t of EXPECTED_TABLES) {
      expect(names).toContain(t);
    }
  });

  it('enables foreign_keys pragma', () => {
    const db = openDb(':memory:');
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });
});
