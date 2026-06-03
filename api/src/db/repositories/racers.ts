import type { Racer } from '@racingshape/shared';
import type { Db } from '../connection.js';

interface RacerRow {
  github_login: string;
  display_name: string;
  avatar_url: string;
  first_seen: string;
}

function toRacer(row: RacerRow): Racer {
  return {
    login: row.github_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    firstSeen: row.first_seen,
  };
}

/**
 * Insert a racer or update mutable fields (display_name, avatar_url) on conflict.
 * first_seen is preserved from the original insert.
 */
export function upsertRacer(db: Db, racer: Racer): void {
  db.prepare(
    `INSERT INTO racers (github_login, display_name, avatar_url, first_seen)
     VALUES (@login, @displayName, @avatarUrl, @firstSeen)
     ON CONFLICT(github_login) DO UPDATE SET
       display_name = excluded.display_name,
       avatar_url   = excluded.avatar_url`,
  ).run(racer);
}

export function getRacer(db: Db, login: string): Racer | undefined {
  const row = db
    .prepare('SELECT * FROM racers WHERE github_login = ?')
    .get(login) as RacerRow | undefined;
  return row ? toRacer(row) : undefined;
}

export function listRacers(db: Db): Racer[] {
  const rows = db.prepare('SELECT * FROM racers ORDER BY github_login ASC').all() as RacerRow[];
  return rows.map(toRacer);
}
