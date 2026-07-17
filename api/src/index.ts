import 'dotenv/config'; // load api/.env into process.env before loadConfig reads it
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { createApp, type SpectatorRuntime } from './app.js';
import { createIpApiGeo } from './spectators/geo.js';
import { makeOctokit } from './github/client.js';
import { makeFetchBatch } from './github/fetchActivity.js';
import { Poller } from './github/poller.js';
import { ResetScheduler } from './scheduler/resetScheduler.js';
import { raceDateFor, msUntilNextNyMidnight } from './time/raceDate.js';

function main(): void {
  const config = loadConfig(process.env);
  // Ensure the SQLite directory exists before opening (no-op for ':memory:').
  if (config.dbPath !== ':memory:') {
    mkdirSync(dirname(config.dbPath), { recursive: true });
  }
  const db = openDb(config.dbPath);
  migrate(db);

  const octokit = makeOctokit(config);
  const request = octokit.request as unknown as Parameters<typeof makeFetchBatch>[1];
  const fetchBatch = makeFetchBatch(db, request, config);

  const poller = new Poller({
    db,
    clock: () => new Date(),
    pollIntervalMs: config.pollIntervalMs,
    snapshotIntervalMs: config.snapshotIntervalMs,
    fetchBatch,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h),
    onError: (err, info) => {
      const status = (err as { status?: number }).status ?? '?';
      const label = info.rateLimited ? 'rate limited' : 'transient error';
      const backoffS = Math.round(info.backoffMs / 1000);
      // Report the message only — never the error object, which carries the auth header.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poller] ${label} (status ${status}); backing off ${backoffS}s: ${msg}`);
    },
  });

  const scheduler = new ResetScheduler({
    clock: () => new Date(),
    msUntilNextNyMidnight,
    raceDateFor,
    snapshot: (raceDate, at) => poller.snapshotNow(raceDate, at),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h),
  });

  const geo = createIpApiGeo({ enabled: config.geoEnabled });

  let spectators: SpectatorRuntime | undefined;
  const app = createApp({
    db,
    config,
    clock: () => new Date(),
    geo,
    onSpectators: (rt) => { spectators = rt; },
  });

  // Reaper: drop stale spectators every 15s and re-broadcast if the set changed.
  setInterval(() => {
    if (spectators && spectators.registry.reap()) {
      spectators.hub.broadcast('presence', spectators.registry.snapshot());
    }
  }, 15_000).unref(); // don't keep the process alive on the reaper alone (app.listen does)

  poller.start();
  scheduler.start();

  app.listen(config.port, () => {
    console.log(`RacingShape API listening on :${config.port}`);
  });
}

main();
