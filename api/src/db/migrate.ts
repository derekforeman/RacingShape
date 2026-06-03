import type { Db } from './connection.js';
import { SCHEMA_SQL } from './schema.sql.js';

/** Apply the canonical schema. Idempotent — safe to call on every boot. */
export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);
}
