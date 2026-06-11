import type { Db } from './connection.js';
import { SCHEMA_SQL } from './schema.sql.js';

/** Apply the canonical schema. Idempotent — safe to call on every boot. */
export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);

  // Add columns introduced after the first release (idempotent).
  const cols = db.prepare("PRAGMA table_info(reactions)").all() as { name: string }[];
  if (!cols.some((c) => c.name === 'source')) {
    db.exec("ALTER TABLE reactions ADD COLUMN source TEXT NOT NULL DEFAULT 'boost'");
  }
}
