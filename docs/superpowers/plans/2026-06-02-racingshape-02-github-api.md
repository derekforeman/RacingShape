# RacingShape — GitHub Integration & API (Plan 02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a running, tested `@racingshape/api` that polls `S2AI/s2shape` for GitHub activity, ingests it into SQLite as scored events, snapshots scores for replay, derives stats / recap / cosmetics, and serves every REST endpoint the frontend needs — all without ever leaking the GitHub token.

**Architecture:** Express 5 app built by a `createApp(deps)` factory (no `listen`, so it is testable with `supertest`). A `Poller` class runs an interval inside the API process (no separate worker): it fetches the current NY race day's commits/PRs/issues via an `@octokit/rest` client wrapped with an ETag-aware `conditionalGet`, ingests them idempotently (`INSERT OR IGNORE` on a stable dedupe id), recomputes `daily_stats`, and writes per-racer `race_snapshots` on a slower cadence. A `resetScheduler` fires at NY midnight to capture a final snapshot and roll the date key over (events already carry their own `race_date`, so reset is a rollover + final snapshot, never a destructive wipe). Services read the DB and assemble the canonical response shapes; routes are thin. Time and the GitHub client are injected everywhere so tests use a fake clock and a mocked client — no real timers, no real network.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, @octokit/rest, Vitest, supertest. Imports the already-built, already-tested `@racingshape/shared` (types + scoring) and the plan-01 `api` core (config, db connection/migrate, repositories, `time/raceDate`, `scoring/standings`).

---

**Roadmap / contract:** [`2026-06-02-racingshape-roadmap.md`](2026-06-02-racingshape-roadmap.md) is the canonical source for type names (§6), scoring (§5), config (§7), DB DDL (§8), file paths (§3), conventions (§4), API shapes, and the track auto-scale rule (§10). If anything here disagrees with the roadmap, the roadmap wins.

**Depends on Plan 01** (`...-01-backend-core.md`): the monorepo, `@racingshape/shared`, `api/src/config.ts`, `api/src/db/*` (connection, migrate, `SCHEMA_SQL`, all repositories), `api/src/time/raceDate.ts`, and `api/src/scoring/standings.ts` already exist and are green. **Do not recreate them — import and use them.**

### Plan-01 surface this plan imports (exact signatures, defined by plan 01)

These are the symbols this plan calls. Use these exact names. (Repository functions take the open `Database` as first arg.)

```ts
// @racingshape/shared  (re-exported from its index)
import {
  EventType, ReactionKind, Cosmetic, ScoreBreakdown, RacerStanding,
  RaceToday, RaceArchive, RaceListItem, SnapshotFrame, ArchivedReaction,
  Recap, PodiumStep, Superlative, StatsResponse, ChartDay, TasksStat,
  CompletionStat, StreakStat, CreateReactionBody, CreateReactionResponse,
  ReactionSummary,
  SCORE_WEIGHTS, pointsFor, scoreFromBreakdown, EMPTY_BREAKDOWN,
} from '@racingshape/shared';

// api/src/config.ts
export interface AppConfig { port: number; githubToken: string; repoOwner: string;
  repoName: string; pollIntervalMs: number; snapshotIntervalMs: number; dbPath: string; }
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig;

// api/src/db/connection.ts
import type Database from 'better-sqlite3';
export function openDb(path: string): Database.Database;     // ':memory:' allowed
// api/src/db/migrate.ts
export function migrate(db: Database.Database): void;         // runs SCHEMA_SQL (idempotent)

// api/src/db/repositories/racers.ts
export function upsertRacer(db, r: { login: string; displayName: string; avatarUrl: string; firstSeen: string }): void;
export function getRacer(db, login: string): Racer | undefined;
export function listRacers(db): Racer[];

// api/src/db/repositories/events.ts
export interface EventRow { id: string; racerLogin: string; type: EventType; points: number; occurredAt: string; raceDate: string; }
export function insertEventsIgnore(db, rows: EventRow[]): number;            // returns # actually inserted
export function breakdownByRacer(db, raceDate: string): Map<string, ScoreBreakdown>;  // login -> counts
export function countsForRange(db, fromDate: string, toDate: string): { raceDate: string; type: EventType; count: number }[];
export function eventsForDate(db, raceDate: string): EventRow[];             // all events that day, any order

// api/src/db/repositories/snapshots.ts
export function insertSnapshot(db, row: { raceDate: string; racerLogin: string; score: number; capturedAt: string }): void;
export function framesForDate(db, raceDate: string): SnapshotFrame[];        // ordered by capturedAt asc
export function latestScores(db, raceDate: string): { login: string; score: number }[];  // most recent capture per racer

// api/src/db/repositories/reactions.ts
export function insertReaction(db, row: { id: string; raceDate: string; targetLogin: string; kind: ReactionKind; reactor: string; createdAt: string }): void;
export function summaryForDate(db, raceDate: string): Map<string, ReactionSummary>;       // login -> summary
export function listForDate(db, raceDate: string): ArchivedReaction[];

// api/src/db/repositories/dailyStats.ts
export function upsertDailyStats(db, row: { raceDate: string; commits: number; prsOpened: number; prsMerged: number; issuesClosed: number }): void;
export function getRange(db, fromDate: string, toDate: string): { raceDate: string; commits: number; prsOpened: number; prsMerged: number; issuesClosed: number }[];

// api/src/db/repositories/httpCache.ts
export function getCache(db, url: string): { etag: string | null; lastModified: string | null; body: string | null } | undefined;
export function putCache(db, row: { url: string; etag: string | null; lastModified: string | null; body: string | null; fetchedAt: string }): void;

// api/src/db/repositories/pollMeta.ts
export function getMeta(db, key: string): string | undefined;
export function setMeta(db, key: string, value: string): void;

// api/src/time/raceDate.ts
export function raceDateFor(date: Date): string;             // YYYY-MM-DD America/New_York
export function msUntilNextNyMidnight(now: Date): number;
export function nyParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number };

// api/src/scoring/standings.ts
export function buildStandings(input: {
  racers: Racer[];
  breakdown: Map<string, ScoreBreakdown>;
  reactions: Map<string, ReactionSummary>;
  cosmetics: Map<string, Cosmetic[]>;
  topMoverLogin: string | null;        // racer who gained most on latest poll; null if none
}): RacerStanding[];                    // sorted by position, gapToLeader/isLeader/topMover filled
```

> 💡 **better-sqlite3** is synchronous: queries return rows directly (no `await`). That is why repositories take a `Database` and return values, and why an in-memory DB (`openDb(':memory:')`) is a perfect, fast test fixture.

---

## File structure (this plan)

| File | Responsibility |
|---|---|
| `api/src/github/client.ts` | `makeOctokit(config)` + `conditionalGet` (ETag/304 via `http_cache`); the only place the token is used. |
| `api/src/github/types.ts` | `RawActivity` shape passed from client → ingest (decouples Octokit from ingest). |
| `api/src/github/ingest.ts` | `ingestEvents(db, raw)` — map raw activity → scored, dated, deduped event rows; auto-upsert racers. |
| `api/src/github/poller.ts` | `Poller` class — interval fetch + ingest + daily_stats + snapshot cadence + 403/secondary backoff. Injectable clock + client. |
| `api/src/services/raceService.ts` | `getToday`, `getArchive`, `listRaces`. |
| `api/src/services/statsService.ts` | `getStats` — chart, total tasks, completion, streak. |
| `api/src/services/recapService.ts` | `buildRecap` — podium + 3 superlatives. |
| `api/src/services/cosmeticsService.ts` | `cosmeticsFor` — flame_trail / gold_rims / rookie_decal per racer. |
| `api/src/scheduler/resetScheduler.ts` | `ResetScheduler` — NY-midnight final snapshot + date rollover; injectable timer. |
| `api/src/routes/race.ts` | `GET /api/race/today`, `GET /api/race/:date`. |
| `api/src/routes/races.ts` | `GET /api/races`. |
| `api/src/routes/stats.ts` | `GET /api/stats?range=14d`. |
| `api/src/routes/reactions.ts` | `POST /api/race/today/reactions`. |
| `api/src/app.ts` | `createApp(deps)` → `express.Express`; JSON + routes + 404 + error handler. |
| `api/src/index.ts` | entry: loadConfig, openDb+migrate, createApp, start Poller + ResetScheduler, listen. |

---

## Task 0: Install dependencies

**Files:**
- Modify: `api/package.json` (deps/devDeps)

- [ ] **Step 1: Add runtime + dev dependencies to the api workspace**

Run (from repo root):

```bash
npm install -w @racingshape/api @octokit/rest@21 express@5
npm install -w @racingshape/api -D supertest@7 @types/supertest@6 @types/express@5
```

Expected: `api/package.json` gains `@octokit/rest`, `express` under `dependencies` and `supertest`, `@types/supertest`, `@types/express` under `devDependencies`; root `package-lock.json` updates; no errors.

- [ ] **Step 2: Verify the workspace still builds/tests**

Run: `npm test -w @racingshape/api`
Expected: PASS (plan-01 tests are green; no new tests yet).

- [ ] **Step 3: Commit**

```bash
git add api/package.json package-lock.json
git commit -m "chore: add octokit, express, supertest to api workspace"
```

---

## Task 1: GitHub client — `makeOctokit` + `conditionalGet`

**Files:**
- Create: `api/src/github/types.ts`
- Create: `api/src/github/client.ts`
- Test: `api/test/github/client.test.ts`

The client must (a) build an authenticated Octokit from config, (b) never expose the token, and (c) implement conditional GET: send `If-None-Match` with the stored ETag, and on HTTP 304 return the cached body from `http_cache` instead of re-parsing. Octokit's `request` is injected so tests use a fake (no network).

- [ ] **Step 1: Define the raw activity shape**

Create `api/src/github/types.ts`:

```ts
import type { EventType } from '@racingshape/shared';

/** A normalized author as seen on a GitHub event. */
export interface RawAuthor {
  login: string;
  displayName: string;
  avatarUrl: string;
}

/** One raw activity item the client hands to ingest, pre-typed but un-scored/un-dated. */
export interface RawActivity {
  type: EventType;
  /** Stable natural key: sha for commits, PR number, or issue number (as string). */
  nativeId: string;
  author: RawAuthor;
  /** ISO UTC timestamp the activity occurred (commit date, PR created/merged, issue closed). */
  occurredAt: string;
}

/** Everything the poller fetched for one race day. */
export interface RawActivityBatch {
  raceDate: string;
  activities: RawActivity[];
}
```

- [ ] **Step 2: Write the failing test for `conditionalGet`**

Create `api/test/github/client.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { conditionalGet } from '../../src/github/client';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('conditionalGet', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('stores etag + body on a 200 and returns the parsed data', async () => {
    const fakeRequest = async () => ({
      status: 200,
      headers: { etag: 'W/"abc"' },
      data: [{ x: 1 }],
    });
    const out = await conditionalGet(db, fakeRequest as any, 'GET /repos/o/r/commits', { foo: 'bar' });
    expect(out).toEqual([{ x: 1 }]);
    const row = db
      .prepare('SELECT etag, body FROM http_cache WHERE url = ?')
      .get('GET /repos/o/r/commits') as { etag: string; body: string };
    expect(row.etag).toBe('W/"abc"');
    expect(JSON.parse(row.body)).toEqual([{ x: 1 }]);
  });

  it('sends If-None-Match with the stored etag on a subsequent call', async () => {
    db.prepare(
      'INSERT INTO http_cache(url, etag, last_modified, body, fetched_at) VALUES (?,?,?,?,?)',
    ).run('GET /x', 'W/"e1"', null, JSON.stringify([{ cached: true }]), '2026-06-02T00:00:00.000Z');

    let seenHeaders: Record<string, string> | undefined;
    const fakeRequest = async (_route: string, opts: any) => {
      seenHeaders = opts.headers;
      const err: any = new Error('Not Modified');
      err.status = 304;
      throw err;
    };
    const out = await conditionalGet(db, fakeRequest as any, 'GET /x', {});
    expect(seenHeaders?.['if-none-match']).toBe('W/"e1"');
    expect(out).toEqual([{ cached: true }]);
  });

  it('returns fresh data and updates the cache on a 200 that replaces a cached entry', async () => {
    db.prepare(
      'INSERT INTO http_cache(url, etag, last_modified, body, fetched_at) VALUES (?,?,?,?,?)',
    ).run('GET /y', 'W/"old"', null, JSON.stringify([{ v: 'old' }]), '2026-06-02T00:00:00.000Z');

    const fakeRequest = async () => ({
      status: 200,
      headers: { etag: 'W/"new"' },
      data: [{ v: 'new' }],
    });
    const out = await conditionalGet(db, fakeRequest as any, 'GET /y', {});
    expect(out).toEqual([{ v: 'new' }]);
    const row = db.prepare('SELECT etag FROM http_cache WHERE url = ?').get('GET /y') as { etag: string };
    expect(row.etag).toBe('W/"new"');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/github/client.test.ts`
Expected: FAIL — `Cannot find module '../../src/github/client'`.

- [ ] **Step 4: Implement the client**

Create `api/src/github/client.ts`:

```ts
import { Octokit } from '@octokit/rest';
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config';
import { getCache, putCache } from '../db/repositories/httpCache';

/** The minimal request function shape we depend on (Octokit's `octokit.request`). */
export type RequestFn = (route: string, options?: Record<string, unknown>) => Promise<{
  status: number;
  headers: Record<string, string | undefined>;
  data: unknown;
}>;

/**
 * Build an authenticated Octokit. The token comes only from config and is never
 * returned, logged, or serialized anywhere. Callers use `octokit.request`.
 */
export function makeOctokit(config: AppConfig): Octokit {
  return new Octokit({ auth: config.githubToken });
}

/**
 * Conditional GET against GitHub using stored ETags. On 200, caches etag+body and
 * returns the parsed data. On 304, returns the cached body (no re-fetch cost on the
 * rate limit). `request` is injected so tests can supply a fake.
 */
export async function conditionalGet<T = unknown>(
  db: Database.Database,
  request: RequestFn,
  route: string,
  options: Record<string, unknown>,
  nowIso: string = new Date().toISOString(),
): Promise<T> {
  const cached = getCache(db, route);
  const headers: Record<string, string> = {};
  if (cached?.etag) headers['if-none-match'] = cached.etag;

  try {
    const res = await request(route, { ...options, headers });
    const etag = res.headers.etag ?? null;
    putCache(db, {
      url: route,
      etag,
      lastModified: res.headers['last-modified'] ?? null,
      body: JSON.stringify(res.data),
      fetchedAt: nowIso,
    });
    return res.data as T;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 304 && cached?.body != null) {
      return JSON.parse(cached.body) as T;
    }
    throw err;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/github/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/github/types.ts api/src/github/client.ts api/test/github/client.test.ts
git commit -m "feat(api): add github client with etag conditional GET"
```

---

## Task 2: Event ingest — `ingestEvents`

**Files:**
- Create: `api/src/github/ingest.ts`
- Test: `api/test/github/ingest.test.ts`

`ingestEvents(db, batch)` maps each `RawActivity` to an `EventRow` with the dedupe id scheme from roadmap §8 (`commit:<sha>`, `pr_opened:<num>`, `pr_merged:<num>`, `issue_closed:<num>`), `points` via `pointsFor`, `occurredAt` (ISO UTC, pass-through), and `raceDate` via `raceDateFor(new Date(occurredAt))`. It auto-upserts the author as a racer (no roster) and inserts events with `INSERT OR IGNORE`, so re-ingest is idempotent.

- [ ] **Step 1: Write the failing test**

Create `api/test/github/ingest.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { ingestEvents } from '../../src/github/ingest';
import type { RawActivityBatch } from '../../src/github/types';

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/github/ingest.test.ts`
Expected: FAIL — `Cannot find module '../../src/github/ingest'`.

- [ ] **Step 3: Implement ingest**

Create `api/src/github/ingest.ts`:

```ts
import type Database from 'better-sqlite3';
import type { EventType } from '@racingshape/shared';
import { pointsFor } from '@racingshape/shared';
import { upsertRacer } from '../db/repositories/racers';
import { insertEventsIgnore, type EventRow } from '../db/repositories/events';
import { raceDateFor } from '../time/raceDate';
import type { RawActivity, RawActivityBatch } from './types';

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/github/ingest.test.ts`
Expected: PASS (5 tests).

> Note: `upsertRacer` (plan 01) must keep the **earliest** `first_seen` on conflict (use `MIN` / `COALESCE`). If the ingest idempotency test ever shows `first_seen` drifting, that is a plan-01 bug to fix there, not here.

- [ ] **Step 5: Commit**

```bash
git add api/src/github/ingest.ts api/test/github/ingest.test.ts
git commit -m "feat(api): ingest raw github activity into scored, deduped events"
```

---

## Task 3: Poller — fetch, ingest, daily_stats, snapshot cadence, backoff

**Files:**
- Create: `api/src/github/poller.ts`
- Test: `api/test/github/poller.test.ts`

The `Poller` owns one `pollOnce()` cycle and an interval loop. To stay deterministic, it takes an injected `clock` (`() => Date`), an injected `fetchBatch` (returns `RawActivityBatch` for a race date — this wraps the client + `conditionalGet` in production, but is a fake in tests), and an injected `setTimer`/`clearTimer` pair. `pollOnce()`:

1. resolves the current NY race date from `clock()`,
2. fetches the batch and ingests it,
3. recomputes `daily_stats` for that date from `breakdownByRacer` + repo counts,
4. writes a `race_snapshots` row per racer **only if** `snapshotIntervalMs` has elapsed since the last snapshot (tracked in `poll_meta` key `last_snapshot_at`),
5. records `last_polled_at` in `poll_meta`,
6. on HTTP 403 / secondary-rate-limit, applies exponential backoff (capped) and skips ingest this cycle, resuming next cycle.

> 💡 **Snapshot cadence** is separate from poll cadence: we poll every ~60s but snapshot every ~5min so replay frames are coarse enough to be light but smooth. `poll_meta` persists the last snapshot time across restarts.

- [ ] **Step 1: Write the failing test**

Create `api/test/github/poller.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { Poller, type PollerDeps } from '../../src/github/poller';
import type { RawActivityBatch } from '../../src/github/types';
import { getMeta } from '../../src/db/repositories/pollMeta';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const author = { login: 'devon-r', displayName: 'Devon R', avatarUrl: 'https://a/d.png' };

function deps(over: Partial<PollerDeps> = {}): { db: Database.Database; d: PollerDeps; now: { v: Date } } {
  const db = freshDb();
  const now = { v: new Date('2026-06-02T15:00:00.000Z') };
  const d: PollerDeps = {
    db,
    clock: () => now.v,
    snapshotIntervalMs: 300_000,
    pollIntervalMs: 60_000,
    fetchBatch: async (raceDate) =>
      ({ raceDate, activities: [{ type: 'commit', nativeId: 's1', author, occurredAt: '2026-06-02T15:00:00.000Z' }] } as RawActivityBatch),
    setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimer: () => {},
    ...over,
  };
  return { db, d, now };
}

describe('Poller.pollOnce', () => {
  let ctx: ReturnType<typeof deps>;
  beforeEach(() => {
    ctx = deps();
  });

  it('ingests fetched activity and records last_polled_at', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce();
    const n = ctx.db.prepare('SELECT COUNT(*) AS n FROM events').get() as any;
    expect(n.n).toBe(1);
    expect(getMeta(ctx.db, 'last_polled_at')).toBe('2026-06-02T15:00:00.000Z');
  });

  it('recomputes daily_stats for the race date', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce();
    const ds = ctx.db.prepare('SELECT * FROM daily_stats WHERE race_date = ?').get('2026-06-02') as any;
    expect(ds.commits).toBe(1);
    expect(ds.prs_opened).toBe(0);
  });

  it('writes a snapshot on first poll, then gates by snapshotIntervalMs', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce(); // first poll -> snapshot
    let snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(1);

    // 2 minutes later: under the 5-min cadence -> no new snapshot
    ctx.now.v = new Date('2026-06-02T15:02:00.000Z');
    await p.pollOnce();
    snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(1);

    // 6 minutes after the first: cadence elapsed -> new snapshot
    ctx.now.v = new Date('2026-06-02T15:06:00.000Z');
    await p.pollOnce();
    snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(2);
  });

  it('backs off on a 403 and does not crash; backoff doubles capped', async () => {
    const fail = deps({
      fetchBatch: async () => {
        const e: any = new Error('rate limited');
        e.status = 403;
        throw e;
      },
    });
    const p = new Poller(fail.d);
    expect(p.currentBackoffMs).toBe(0);
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(60_000); // first backoff = pollIntervalMs
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(120_000); // doubled
    // cap check: many failures never exceed 15 min
    for (let i = 0; i < 10; i++) await p.pollOnce();
    expect(p.currentBackoffMs).toBe(900_000);
    // no events ingested while failing
    const n = fail.db.prepare('SELECT COUNT(*) AS n FROM events').get() as any;
    expect(n.n).toBe(0);
  });

  it('resets backoff after a successful poll', async () => {
    let shouldFail = true;
    const flaky = deps({
      fetchBatch: async (raceDate) => {
        if (shouldFail) {
          const e: any = new Error('rate limited');
          e.status = 403;
          throw e;
        }
        return { raceDate, activities: [] };
      },
    });
    const p = new Poller(flaky.d);
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(60_000);
    shouldFail = false;
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/github/poller.test.ts`
Expected: FAIL — `Cannot find module '../../src/github/poller'`.

- [ ] **Step 3: Implement the poller**

Create `api/src/github/poller.ts`:

```ts
import type Database from 'better-sqlite3';
import { scoreFromBreakdown, EMPTY_BREAKDOWN } from '@racingshape/shared';
import type { ScoreBreakdown } from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events';
import { upsertDailyStats } from '../db/repositories/dailyStats';
import { insertSnapshot } from '../db/repositories/snapshots';
import { getMeta, setMeta } from '../db/repositories/pollMeta';
import { ingestEvents } from './ingest';
import { raceDateFor } from '../time/raceDate';
import type { RawActivityBatch } from './types';

export interface PollerDeps {
  db: Database.Database;
  clock: () => Date;
  pollIntervalMs: number;
  snapshotIntervalMs: number;
  /** Fetch the day's activity for a race date (wraps the client in production). */
  fetchBatch: (raceDate: string) => Promise<RawActivityBatch>;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
}

const MAX_BACKOFF_MS = 900_000; // 15 minutes
const META_LAST_POLLED = 'last_polled_at';
const META_LAST_SNAPSHOT = 'last_snapshot_at';

function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (status === 403 || status === 429) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return msg.includes('secondary rate') || msg.includes('rate limit');
}

export class Poller {
  /** Current backoff in ms; 0 means healthy. Exposed for tests/observability. */
  currentBackoffMs = 0;
  private handle: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: PollerDeps) {}

  /** Start the interval loop. Re-arms itself; uses backoff delay when unhealthy. */
  start(): void {
    this.stopped = false;
    const tick = async () => {
      if (this.stopped) return;
      await this.pollOnce();
      if (this.stopped) return;
      const delay = this.currentBackoffMs > 0 ? this.currentBackoffMs : this.deps.pollIntervalMs;
      this.handle = this.deps.setTimer(tick, delay);
    };
    this.handle = this.deps.setTimer(tick, 0);
  }

  stop(): void {
    this.stopped = true;
    if (this.handle != null) {
      this.deps.clearTimer(this.handle);
      this.handle = null;
    }
  }

  async pollOnce(): Promise<void> {
    const { db, clock, fetchBatch, pollIntervalMs, snapshotIntervalMs } = this.deps;
    const now = clock();
    const raceDate = raceDateFor(now);

    let batch: RawActivityBatch;
    try {
      batch = await fetchBatch(raceDate);
    } catch (err) {
      if (isRateLimited(err)) {
        this.currentBackoffMs =
          this.currentBackoffMs === 0
            ? pollIntervalMs
            : Math.min(this.currentBackoffMs * 2, MAX_BACKOFF_MS);
        return;
      }
      throw err;
    }

    // success: reset backoff
    this.currentBackoffMs = 0;

    ingestEvents(db, batch);
    this.recomputeDailyStats(raceDate);
    this.maybeSnapshot(raceDate, now);
    setMeta(db, META_LAST_POLLED, now.toISOString());
  }

  private recomputeDailyStats(raceDate: string): void {
    const { db } = this.deps;
    const map = breakdownByRacer(db, raceDate);
    let commits = 0;
    let prsOpened = 0;
    let prsMerged = 0;
    let issuesClosed = 0;
    for (const b of map.values()) {
      commits += b.commit;
      prsOpened += b.pr_opened;
      prsMerged += b.pr_merged;
      issuesClosed += b.issue_closed;
    }
    upsertDailyStats(db, { raceDate, commits, prsOpened, prsMerged, issuesClosed });
  }

  private maybeSnapshot(raceDate: string, now: Date): void {
    const { db, snapshotIntervalMs } = this.deps;
    const lastIso = getMeta(db, META_LAST_SNAPSHOT);
    const elapsed = lastIso ? now.getTime() - new Date(lastIso).getTime() : Infinity;
    if (elapsed < snapshotIntervalMs) return;
    this.snapshotNow(raceDate, now);
  }

  /** Capture a score snapshot for every racer with activity today. Also used by the reset scheduler. */
  snapshotNow(raceDate: string, now: Date): void {
    const { db } = this.deps;
    const map = breakdownByRacer(db, raceDate);
    const capturedAt = now.toISOString();
    for (const [login, breakdown] of map.entries()) {
      const b: ScoreBreakdown = breakdown ?? EMPTY_BREAKDOWN;
      insertSnapshot(db, { raceDate, racerLogin: login, score: scoreFromBreakdown(b), capturedAt });
    }
    setMeta(db, META_LAST_SNAPSHOT, capturedAt);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/github/poller.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/github/poller.ts api/test/github/poller.test.ts
git commit -m "feat(api): add poller with ingest, daily_stats, snapshot cadence, backoff"
```

---

## Task 4: Cosmetics service — `cosmeticsFor`

**Files:**
- Create: `api/src/services/cosmeticsService.ts`
- Test: `api/test/services/cosmeticsService.test.ts`

`cosmeticsFor(db, date)` returns `Map<login, Cosmetic[]>` (DESIGN §5.3):
- `flame_trail` — that racer has a streak of **≥ 5** consecutive days (each with ≥ 1 event) ending on `date`.
- `gold_rims` — the author of the **earliest** `pr_merged` event on `date` (first merge of the day). Ties broken by login asc.
- `rookie_decal` — the racer with the largest positive score delta vs the previous day (most-improved). No award if no one improved.

- [ ] **Step 1: Write the failing test**

Create `api/test/services/cosmeticsService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { cosmeticsFor } from '../../src/services/cosmeticsService';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function addEvent(db: Database.Database, e: { id: string; login: string; type: string; points: number; at: string; date: string }) {
  db.prepare(
    'INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)',
  ).run(e.id, e.login, e.type, e.points, e.at, e.date);
}

describe('cosmeticsFor', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('awards flame_trail for a 5-day streak ending on date', () => {
    const days = ['2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'];
    days.forEach((d, i) =>
      addEvent(db, { id: `commit:s${i}`, login: 'devon-r', type: 'commit', points: 1, at: `${d}T15:00:00.000Z`, date: d }),
    );
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('devon-r')).toContain('flame_trail');
  });

  it('does not award flame_trail for only a 4-day streak', () => {
    const days = ['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'];
    days.forEach((d, i) =>
      addEvent(db, { id: `commit:s${i}`, login: 'mira-k', type: 'commit', points: 1, at: `${d}T15:00:00.000Z`, date: d }),
    );
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('mira-k') ?? []).not.toContain('flame_trail');
  });

  it('awards gold_rims to the author of the earliest pr_merged that day', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'late', type: 'pr_merged', points: 8, at: '2026-06-02T18:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:2', login: 'early', type: 'pr_merged', points: 8, at: '2026-06-02T09:00:00.000Z', date: '2026-06-02' });
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('early')).toContain('gold_rims');
    expect(out.get('late') ?? []).not.toContain('gold_rims');
  });

  it('awards rookie_decal to the most-improved racer vs the prior day', () => {
    // yesterday
    addEvent(db, { id: 'commit:y1', login: 'devon-r', type: 'commit', points: 1, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    addEvent(db, { id: 'commit:y2', login: 'mira-k', type: 'commit', points: 1, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    // today: mira jumps by a merge (+8), devon stays flat (+1)
    addEvent(db, { id: 'commit:t1', login: 'devon-r', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:9', login: 'mira-k', type: 'pr_merged', points: 8, at: '2026-06-02T11:00:00.000Z', date: '2026-06-02' });
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('mira-k')).toContain('rookie_decal');
    expect(out.get('devon-r') ?? []).not.toContain('rookie_decal');
  });

  it('returns an empty map for a day with no events', () => {
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/services/cosmeticsService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/cosmeticsService'`.

- [ ] **Step 3: Implement the cosmetics service**

Create `api/src/services/cosmeticsService.ts`:

```ts
import type Database from 'better-sqlite3';
import type { Cosmetic } from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events';

const FLAME_STREAK_DAYS = 5;

/** Subtract one day from a YYYY-MM-DD key (UTC-safe arithmetic on the date key). */
function prevDateKey(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function add(map: Map<string, Cosmetic[]>, login: string, c: Cosmetic): void {
  const list = map.get(login) ?? [];
  if (!list.includes(c)) list.push(c);
  map.set(login, list);
}

/**
 * Earned cosmetics for `date` (DESIGN §5.3):
 *  - flame_trail: racer has a >=5-day consecutive-activity streak ending on `date`.
 *  - gold_rims:   author of the earliest pr_merged event that day (first merge).
 *  - rookie_decal: most-improved racer vs the prior day (largest positive score delta).
 */
export function cosmeticsFor(db: Database.Database, date: string): Map<string, Cosmetic[]> {
  const out = new Map<string, Cosmetic[]>();

  const todayScores = scoresByLogin(db, date);
  if (todayScores.size === 0) return out;

  // flame_trail
  for (const login of todayScores.keys()) {
    if (streakEndingOn(db, login, date) >= FLAME_STREAK_DAYS) add(out, login, 'flame_trail');
  }

  // gold_rims — earliest pr_merged that day
  const firstMerge = db
    .prepare(
      "SELECT racer_login AS login FROM events WHERE race_date = ? AND type = 'pr_merged' ORDER BY occurred_at ASC, racer_login ASC LIMIT 1",
    )
    .get(date) as { login: string } | undefined;
  if (firstMerge) add(out, firstMerge.login, 'gold_rims');

  // rookie_decal — most-improved vs prior day
  const prev = scoresByLogin(db, prevDateKey(date));
  let bestLogin: string | null = null;
  let bestDelta = 0;
  for (const [login, score] of todayScores.entries()) {
    const delta = score - (prev.get(login) ?? 0);
    if (delta > bestDelta || (delta === bestDelta && delta > 0 && (bestLogin === null || login < bestLogin))) {
      bestDelta = delta;
      bestLogin = login;
    }
  }
  if (bestLogin && bestDelta > 0) add(out, bestLogin, 'rookie_decal');

  return out;
}

function scoresByLogin(db: Database.Database, date: string): Map<string, number> {
  const m = breakdownByRacer(db, date);
  const out = new Map<string, number>();
  for (const [login, b] of m.entries()) out.set(login, scoreFromBreakdown(b));
  return out;
}

/** Length of the consecutive-day activity streak for `login` ending on `date` (inclusive). */
function streakEndingOn(db: Database.Database, login: string, date: string): number {
  const stmt = db.prepare(
    'SELECT COUNT(*) AS n FROM events WHERE racer_login = ? AND race_date = ?',
  );
  let streak = 0;
  let cursor = date;
  for (;;) {
    const row = stmt.get(login, cursor) as { n: number };
    if (row.n === 0) break;
    streak += 1;
    cursor = prevDateKey(cursor);
  }
  return streak;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/services/cosmeticsService.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/cosmeticsService.ts api/test/services/cosmeticsService.test.ts
git commit -m "feat(api): add earned-cosmetics derivation (flame/gold/rookie)"
```

---

## Task 5: Recap service — `buildRecap`

**Files:**
- Create: `api/src/services/recapService.ts`
- Test: `api/test/services/recapService.test.ts`

`buildRecap(db, date)` returns a `Recap` (roadmap §6):
- `podium` — top 3 racers by score for the day, each a `PodiumStep` (position 1..3, login, displayName, avatarUrl, score, breakdown). Fewer than 3 racers → fewer steps.
- `superlatives` — exactly 3, keyed `fastest_hour`, `comeback`, `midnight_grinder`:
  - `fastest_hour` — racer with the most **points** in any rolling 60-minute window over the day's events. `login` null if no events.
  - `comeback` — biggest **second-half climb** from snapshots: largest `(finalScore − scoreAtMidday)` using the snapshot nearest the day's midpoint vs the latest snapshot. `login` null if no snapshots.
  - `midnight_grinder` — author of the **latest** event of the day. `login` null if no events.

- [ ] **Step 1: Write the failing test**

Create `api/test/services/recapService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { buildRecap } from '../../src/services/recapService';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function addRacer(db: Database.Database, login: string) {
  db.prepare('INSERT OR IGNORE INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    login,
    login.toUpperCase(),
    `https://a/${login}.png`,
    '2026-06-01T00:00:00.000Z',
  );
}
function addEvent(db: Database.Database, e: { id: string; login: string; type: string; points: number; at: string; date: string }) {
  addRacer(db, e.login);
  db.prepare('INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    e.id, e.login, e.type, e.points, e.at, e.date,
  );
}
function addSnap(db: Database.Database, s: { login: string; score: number; at: string; date: string }) {
  db.prepare('INSERT OR IGNORE INTO race_snapshots(race_date, racer_login, score, captured_at) VALUES (?,?,?,?)').run(
    s.date, s.login, s.score, s.at,
  );
}

describe('buildRecap', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('builds a podium of the top 3 by score', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_opened:2', login: 'b', type: 'pr_opened', points: 5, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'issue_closed:3', login: 'c', type: 'issue_closed', points: 3, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:4', login: 'd', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });

    const recap = buildRecap(db, '2026-06-02');
    expect(recap.podium.map((p) => p.login)).toEqual(['a', 'b', 'c']);
    expect(recap.podium[0]).toMatchObject({ position: 1, score: 8 });
    expect(recap.podium[0].breakdown.pr_merged).toBe(1);
  });

  it('fastest_hour picks the racer with the most points in any 60-min window', () => {
    // a: 3 commits within an hour (3 pts). b: a single 8-pt merge (8 pts in its own window).
    addEvent(db, { id: 'commit:a1', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:a2', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:20:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:a3', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:40:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:7', login: 'b', type: 'pr_merged', points: 8, at: '2026-06-02T16:00:00.000Z', date: '2026-06-02' });

    const recap = buildRecap(db, '2026-06-02');
    const fh = recap.superlatives.find((s) => s.key === 'fastest_hour')!;
    expect(fh.login).toBe('b');
  });

  it('midnight_grinder is the author of the latest event', () => {
    addEvent(db, { id: 'commit:e', login: 'early', type: 'commit', points: 1, at: '2026-06-02T09:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:l', login: 'nightowl', type: 'commit', points: 1, at: '2026-06-02T23:45:00.000Z', date: '2026-06-02' });
    const recap = buildRecap(db, '2026-06-02');
    const mg = recap.superlatives.find((s) => s.key === 'midnight_grinder')!;
    expect(mg.login).toBe('nightowl');
  });

  it('comeback is the biggest second-half climb from snapshots', () => {
    // a flat all day; b surges after midday.
    addSnap(db, { login: 'a', score: 5, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 1, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 6, at: '2026-06-02T23:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 14, at: '2026-06-02T23:00:00.000Z', date: '2026-06-02' });
    const recap = buildRecap(db, '2026-06-02');
    const cb = recap.superlatives.find((s) => s.key === 'comeback')!;
    expect(cb.login).toBe('b');
  });

  it('superlatives have null login when no data supports them', () => {
    const recap = buildRecap(db, '2026-06-02');
    expect(recap.podium).toEqual([]);
    expect(recap.superlatives.map((s) => s.key)).toEqual(['fastest_hour', 'comeback', 'midnight_grinder']);
    for (const s of recap.superlatives) expect(s.login).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/services/recapService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/recapService'`.

- [ ] **Step 3: Implement the recap service**

Create `api/src/services/recapService.ts`:

```ts
import type Database from 'better-sqlite3';
import type { Recap, PodiumStep, Superlative, ScoreBreakdown } from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';
import { breakdownByRacer, eventsForDate } from '../db/repositories/events';
import { framesForDate } from '../db/repositories/snapshots';
import { getRacer } from '../db/repositories/racers';

const HOUR_MS = 3_600_000;

export function buildRecap(db: Database.Database, date: string): Recap {
  return {
    raceDate: date,
    podium: buildPodium(db, date),
    superlatives: [
      fastestHour(db, date),
      comeback(db, date),
      midnightGrinder(db, date),
    ],
  };
}

function buildPodium(db: Database.Database, date: string): PodiumStep[] {
  const map = breakdownByRacer(db, date);
  const scored = [...map.entries()]
    .map(([login, breakdown]) => ({ login, breakdown, score: scoreFromBreakdown(breakdown) }))
    .sort((a, b) => b.score - a.score || a.login.localeCompare(b.login))
    .slice(0, 3);

  return scored.map((s, i) => {
    const racer = getRacer(db, s.login);
    return {
      position: i + 1,
      login: s.login,
      displayName: racer?.displayName ?? s.login,
      avatarUrl: racer?.avatarUrl ?? '',
      score: s.score,
      breakdown: s.breakdown as ScoreBreakdown,
    };
  });
}

/** Most points in any rolling 60-min window, summed per racer. */
function fastestHour(db: Database.Database, date: string): Superlative {
  const events = eventsForDate(db, date)
    .map((e) => ({ login: e.racerLogin, points: e.points, t: new Date(e.occurredAt).getTime() }))
    .sort((a, b) => a.t - b.t);

  let bestLogin: string | null = null;
  let bestPoints = 0;
  let bestStart = 0;

  // For each event, the window [t, t+1h) anchored at that event; sum same-racer points within it.
  for (let i = 0; i < events.length; i++) {
    const start = events[i].t;
    const byLogin = new Map<string, number>();
    for (let j = i; j < events.length && events[j].t < start + HOUR_MS; j++) {
      byLogin.set(events[j].login, (byLogin.get(events[j].login) ?? 0) + events[j].points);
    }
    for (const [login, pts] of byLogin.entries()) {
      if (pts > bestPoints) {
        bestPoints = pts;
        bestLogin = login;
        bestStart = start;
      }
    }
  }

  if (bestLogin === null) {
    return { key: 'fastest_hour', title: 'Fastest hour', login: null, detail: 'No activity yet' };
  }
  const hour = new Date(bestStart).getUTCHours();
  return {
    key: 'fastest_hour',
    title: 'Fastest hour',
    login: bestLogin,
    detail: `${bestPoints} pts in 60 min · from ${String(hour).padStart(2, '0')}:00 UTC`,
  };
}

/** Biggest climb between the snapshot nearest the day midpoint and the final snapshot. */
function comeback(db: Database.Database, date: string): Superlative {
  const frames = framesForDate(db, date);
  if (frames.length === 0) {
    return { key: 'comeback', title: 'Comeback of the day', login: null, detail: 'No snapshots' };
  }

  const final = frames[frames.length - 1];
  // midpoint of the captured window
  const first = frames[0];
  const mid = (new Date(first.capturedAt).getTime() + new Date(final.capturedAt).getTime()) / 2;
  let midFrame = frames[0];
  let bestDist = Infinity;
  for (const f of frames) {
    const dist = Math.abs(new Date(f.capturedAt).getTime() - mid);
    if (dist < bestDist) {
      bestDist = dist;
      midFrame = f;
    }
  }

  const midScore = new Map(midFrame.scores.map((s) => [s.login, s.score]));
  let bestLogin: string | null = null;
  let bestClimb = 0;
  for (const s of final.scores) {
    const climb = s.score - (midScore.get(s.login) ?? 0);
    if (climb > bestClimb || (climb === bestClimb && climb > 0 && (bestLogin === null || s.login < bestLogin))) {
      bestClimb = climb;
      bestLogin = s.login;
    }
  }

  if (bestLogin === null || bestClimb <= 0) {
    return { key: 'comeback', title: 'Comeback of the day', login: null, detail: 'No late climb' };
  }
  return {
    key: 'comeback',
    title: 'Comeback of the day',
    login: bestLogin,
    detail: `+${bestClimb} pts in the second half`,
  };
}

/** Author of the latest event of the day. */
function midnightGrinder(db: Database.Database, date: string): Superlative {
  const events = eventsForDate(db, date).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  if (events.length === 0) {
    return { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'No activity yet' };
  }
  const latest = events[0];
  const hh = new Date(latest.occurredAt).getUTCHours();
  const mm = new Date(latest.occurredAt).getUTCMinutes();
  return {
    key: 'midnight_grinder',
    title: 'Midnight grinder',
    login: latest.racerLogin,
    detail: `Last commit at ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} UTC`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/services/recapService.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/recapService.ts api/test/services/recapService.test.ts
git commit -m "feat(api): add grand-prix recap (podium + 3 superlatives)"
```

---

## Task 6: Race service — `getToday`, `getArchive`, `listRaces`

**Files:**
- Create: `api/src/services/raceService.ts`
- Test: `api/test/services/raceService.test.ts`

- `getToday(db, now)` → `RaceToday`: builds standings via `buildStandings` using today's `breakdownByRacer`, `summaryForDate` reactions, `cosmeticsFor`, and a `topMoverLogin` derived from the latest snapshot vs the previous snapshot (who gained most). `topScore` = max standing score floored to 1 (roadmap §10). `lastPolledAt` from `poll_meta` (`last_polled_at`).
- `getArchive(db, date)` → `RaceArchive`: `live:false`, final standings (same builder), `frames` from `framesForDate`, `reactions` from `listForDate`, `recap` from `buildRecap`. `topScore` floored to 1.
- `listRaces(db)` → `RaceListItem[]`: one item per archived `race_date` (distinct dates that have snapshots or events, excluding today), with `topScore` and `winnerLogin` (highest final score; null if none), newest first.

- [ ] **Step 1: Write the failing test**

Create `api/test/services/raceService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { getToday, getArchive, listRaces } from '../../src/services/raceService';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}
function addRacer(db: Database.Database, login: string) {
  db.prepare('INSERT OR IGNORE INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    login, login.toUpperCase(), `https://a/${login}.png`, '2026-06-01T00:00:00.000Z',
  );
}
function addEvent(db: Database.Database, e: { id: string; login: string; type: string; points: number; at: string; date: string }) {
  addRacer(db, e.login);
  db.prepare('INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    e.id, e.login, e.type, e.points, e.at, e.date,
  );
}
function addSnap(db: Database.Database, s: { login: string; score: number; at: string; date: string }) {
  db.prepare('INSERT OR IGNORE INTO race_snapshots(race_date, racer_login, score, captured_at) VALUES (?,?,?,?)').run(
    s.date, s.login, s.score, s.at,
  );
}

describe('raceService', () => {
  let db: Database.Database;
  const now = new Date('2026-06-02T15:00:00.000Z'); // race_date 2026-06-02
  beforeEach(() => {
    db = freshDb();
  });

  it('getToday returns standings, topScore>=1, and lastPolledAt', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:2', login: 'b', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    db.prepare('INSERT INTO poll_meta(key, value) VALUES (?,?)').run('last_polled_at', '2026-06-02T15:00:00.000Z');

    const today = getToday(db, now);
    expect(today.live).toBe(true);
    expect(today.raceDate).toBe('2026-06-02');
    expect(today.topScore).toBe(8);
    expect(today.lastPolledAt).toBe('2026-06-02T15:00:00.000Z');
    expect(today.standings[0].login).toBe('a');
    expect(today.standings[0].isLeader).toBe(true);
  });

  it('getToday floors topScore to 1 on an empty day', () => {
    const today = getToday(db, now);
    expect(today.topScore).toBe(1);
    expect(today.standings).toEqual([]);
    expect(today.lastPolledAt).toBeNull();
  });

  it('getToday marks the biggest gainer between the last two snapshots as topMover', () => {
    addEvent(db, { id: 'commit:a', login: 'a', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:9', login: 'b', type: 'pr_merged', points: 8, at: '2026-06-02T14:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 1, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 0, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 1, at: '2026-06-02T14:30:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 8, at: '2026-06-02T14:30:00.000Z', date: '2026-06-02' });

    const today = getToday(db, now);
    const b = today.standings.find((s) => s.login === 'b')!;
    expect(b.topMover).toBe(true);
  });

  it('getArchive returns final standings, frames, reactions, and recap', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    addSnap(db, { login: 'a', score: 8, at: '2026-06-01T23:00:00.000Z', date: '2026-06-01' });
    db.prepare('INSERT INTO reactions(id, race_date, target_racer_login, kind, reactor, created_at) VALUES (?,?,?,?,?,?)').run(
      'r1', '2026-06-01', 'a', '🔥', 'mira-k', '2026-06-01T11:00:00.000Z',
    );

    const arch = getArchive(db, '2026-06-01');
    expect(arch.live).toBe(false);
    expect(arch.raceDate).toBe('2026-06-01');
    expect(arch.topScore).toBe(8);
    expect(arch.standings[0].login).toBe('a');
    expect(arch.frames.length).toBe(1);
    expect(arch.reactions[0].targetLogin).toBe('a');
    expect(arch.recap.podium[0].login).toBe('a');
  });

  it('listRaces lists archived dates newest-first with winner + topScore', () => {
    addSnap(db, { login: 'a', score: 8, at: '2026-05-31T23:00:00.000Z', date: '2026-05-31' });
    addSnap(db, { login: 'b', score: 3, at: '2026-05-31T23:00:00.000Z', date: '2026-05-31' });
    addSnap(db, { login: 'c', score: 5, at: '2026-06-01T23:00:00.000Z', date: '2026-06-01' });

    const races = listRaces(db);
    expect(races.map((r) => r.raceDate)).toEqual(['2026-06-01', '2026-05-31']);
    expect(races[0]).toMatchObject({ raceDate: '2026-06-01', topScore: 5, winnerLogin: 'c' });
    expect(races[1]).toMatchObject({ raceDate: '2026-05-31', topScore: 8, winnerLogin: 'a' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/services/raceService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/raceService'`.

- [ ] **Step 3: Implement the race service**

Create `api/src/services/raceService.ts`:

```ts
import type Database from 'better-sqlite3';
import type {
  RaceToday, RaceArchive, RaceListItem, RacerStanding, ReactionSummary,
} from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events';
import { summaryForDate, listForDate } from '../db/repositories/reactions';
import { framesForDate } from '../db/repositories/snapshots';
import { listRacers } from '../db/repositories/racers';
import { getMeta } from '../db/repositories/pollMeta';
import { buildStandings } from '../scoring/standings';
import { raceDateFor } from '../time/raceDate';
import { cosmeticsFor } from './cosmeticsService';
import { buildRecap } from './recapService';

/** Top mover = racer who gained the most points between the last two snapshot frames. */
function topMoverFromFrames(db: Database.Database, raceDate: string): string | null {
  const frames = framesForDate(db, raceDate);
  if (frames.length < 2) return null;
  const prev = new Map(frames[frames.length - 2].scores.map((s) => [s.login, s.score]));
  const latest = frames[frames.length - 1].scores;
  let bestLogin: string | null = null;
  let bestGain = 0;
  for (const s of latest) {
    const gain = s.score - (prev.get(s.login) ?? 0);
    if (gain > bestGain || (gain === bestGain && gain > 0 && (bestLogin === null || s.login < bestLogin))) {
      bestGain = gain;
      bestLogin = s.login;
    }
  }
  return bestGain > 0 ? bestLogin : null;
}

function standingsFor(db: Database.Database, raceDate: string): RacerStanding[] {
  const breakdown = breakdownByRacer(db, raceDate);
  const racers = listRacers(db).filter((r) => breakdown.has(r.login));
  const reactions: Map<string, ReactionSummary> = summaryForDate(db, raceDate);
  const cosmetics = cosmeticsFor(db, raceDate);
  const topMoverLogin = topMoverFromFrames(db, raceDate);
  return buildStandings({ racers, breakdown, reactions, cosmetics, topMoverLogin });
}

function topScoreOf(standings: RacerStanding[]): number {
  return Math.max(1, ...standings.map((s) => s.score), 1);
}

export function getToday(db: Database.Database, now: Date): RaceToday {
  const raceDate = raceDateFor(now);
  const standings = standingsFor(db, raceDate);
  return {
    raceDate,
    live: true,
    topScore: topScoreOf(standings),
    standings,
    lastPolledAt: getMeta(db, 'last_polled_at') ?? null,
  };
}

export function getArchive(db: Database.Database, date: string): RaceArchive {
  const standings = standingsFor(db, date);
  return {
    raceDate: date,
    live: false,
    topScore: topScoreOf(standings),
    standings,
    frames: framesForDate(db, date),
    reactions: listForDate(db, date),
    recap: buildRecap(db, date),
  };
}

export function listRaces(db: Database.Database): RaceListItem[] {
  const today = raceDateFor(new Date());
  const dates = db
    .prepare(
      `SELECT DISTINCT race_date AS d FROM (
         SELECT race_date FROM race_snapshots
         UNION SELECT race_date FROM events
       ) WHERE race_date <> ? ORDER BY d DESC`,
    )
    .all(today) as { d: string }[];

  return dates.map(({ d }) => {
    const standings = standingsFor(db, d);
    return {
      raceDate: d,
      topScore: topScoreOf(standings),
      winnerLogin: standings.length > 0 ? standings[0].login : null,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/services/raceService.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/raceService.ts api/test/services/raceService.test.ts
git commit -m "feat(api): add race service (today, archive, list)"
```

---

## Task 7: Stats service — `getStats`

**Files:**
- Create: `api/src/services/statsService.ts`
- Test: `api/test/services/statsService.test.ts`

`getStats(db, range, now)` → `StatsResponse` over a window of `range` days ending today (NY date from `now`). `range` is like `"14d"`; parse the integer, default 14.
- `chart`: `ChartDay[]` ascending by date, one per `daily_stats` day in range (`commits`, `prsOpened` → `prsOpened`, `issuesClosed`). Use `dailyStats.getRange`.
- `totalTasks`: `issues + prs` where `issues = sum(issuesClosed)`, `prs = sum(prsOpened)`; `total = issues + prs`; `deltaVsPriorWeek` = (this 7-day window total) − (prior 7-day window total), signed.
- `completion`: `closed = sum(issuesClosed) + sum(prsMerged)`, `opened = sum(prsOpened)`; `rate = opened > 0 ? closed/opened : 0`.
- `streak`: consecutive days with ≥ 1 event ending today (`current`), `startDate` of that run (null if 0), `bestThisMonth` = longest such run within the current calendar month.
- `repoUrl`: `https://github.com/{owner}/{name}` from config (passed in).

> Pass `config` into `getStats` so `repoUrl` is built without re-reading env. Signature: `getStats(db, range, now, config)`.

- [ ] **Step 1: Write the failing test**

Create `api/test/services/statsService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { getStats } from '../../src/services/statsService';
import type { AppConfig } from '../../src/config';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}
const config: AppConfig = {
  port: 8787, githubToken: 'x', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:',
};
function addDaily(db: Database.Database, r: { date: string; commits?: number; prsOpened?: number; prsMerged?: number; issuesClosed?: number }) {
  db.prepare('INSERT OR REPLACE INTO daily_stats(race_date, commits, prs_opened, prs_merged, issues_closed) VALUES (?,?,?,?,?)').run(
    r.date, r.commits ?? 0, r.prsOpened ?? 0, r.prsMerged ?? 0, r.issuesClosed ?? 0,
  );
}
function addEvent(db: Database.Database, date: string, at: string, id: string) {
  db.prepare('INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    id, 'a', 'commit', 1, at, date,
  );
}

describe('getStats', () => {
  let db: Database.Database;
  const now = new Date('2026-06-02T15:00:00.000Z'); // today = 2026-06-02
  beforeEach(() => {
    db = freshDb();
  });

  it('returns repoUrl from config and echoes the range', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.repoUrl).toBe('https://github.com/S2AI/s2shape');
    expect(s.range).toBe('14d');
  });

  it('builds the chart ascending by date within range', () => {
    addDaily(db, { date: '2026-06-01', commits: 3, prsOpened: 1, issuesClosed: 2 });
    addDaily(db, { date: '2026-06-02', commits: 5, prsOpened: 2, issuesClosed: 0 });
    const s = getStats(db, '14d', now, config);
    expect(s.chart.map((c) => c.raceDate)).toEqual(['2026-06-01', '2026-06-02']);
    expect(s.chart[1]).toEqual({ raceDate: '2026-06-02', commits: 5, prsOpened: 2, issuesClosed: 0 });
  });

  it('computes totalTasks as issues + prs', () => {
    addDaily(db, { date: '2026-06-02', prsOpened: 4, issuesClosed: 6 });
    const s = getStats(db, '14d', now, config);
    expect(s.totalTasks).toMatchObject({ issues: 6, prs: 4, total: 10 });
  });

  it('computes completion rate as closed / opened', () => {
    addDaily(db, { date: '2026-06-02', prsOpened: 4, prsMerged: 2, issuesClosed: 1 });
    const s = getStats(db, '14d', now, config);
    expect(s.completion.opened).toBe(4);
    expect(s.completion.closed).toBe(3); // merged + issues_closed
    expect(s.completion.rate).toBeCloseTo(0.75);
  });

  it('completion rate is 0 when nothing was opened', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.completion.rate).toBe(0);
  });

  it('computes a streak of consecutive event days ending today', () => {
    addEvent(db, '2026-05-31', '2026-05-31T10:00:00.000Z', 'commit:1');
    addEvent(db, '2026-06-01', '2026-06-01T10:00:00.000Z', 'commit:2');
    addEvent(db, '2026-06-02', '2026-06-02T10:00:00.000Z', 'commit:3');
    const s = getStats(db, '14d', now, config);
    expect(s.streak.current).toBe(3);
    expect(s.streak.startDate).toBe('2026-05-31');
  });

  it('streak is 0 when today has no events', () => {
    addEvent(db, '2026-05-31', '2026-05-31T10:00:00.000Z', 'commit:1');
    const s = getStats(db, '14d', now, config);
    expect(s.streak.current).toBe(0);
    expect(s.streak.startDate).toBeNull();
  });

  it('handles an empty range', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.chart).toEqual([]);
    expect(s.totalTasks.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/services/statsService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/statsService'`.

- [ ] **Step 3: Implement the stats service**

Create `api/src/services/statsService.ts`:

```ts
import type Database from 'better-sqlite3';
import type { StatsResponse, ChartDay, TasksStat, CompletionStat, StreakStat } from '@racingshape/shared';
import type { AppConfig } from '../config';
import { getRange } from '../db/repositories/dailyStats';
import { raceDateFor } from '../time/raceDate';

function parseRangeDays(range: string): number {
  const m = /^(\d+)d$/.exec(range.trim());
  const n = m ? Number(m[1]) : 14;
  return n > 0 ? n : 14;
}

/** Shift a YYYY-MM-DD key by `delta` days (negative = earlier). */
function shiftDateKey(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function getStats(db: Database.Database, range: string, now: Date, config: AppConfig): StatsResponse {
  const days = parseRangeDays(range);
  const today = raceDateFor(now);
  const fromDate = shiftDateKey(today, -(days - 1));

  const rows = getRange(db, fromDate, today); // ascending by date (plan-01 guarantee)
  const chart: ChartDay[] = rows.map((r) => ({
    raceDate: r.raceDate,
    commits: r.commits,
    prsOpened: r.prsOpened,
    issuesClosed: r.issuesClosed,
  }));

  const issues = sum(rows, (r) => r.issuesClosed);
  const prs = sum(rows, (r) => r.prsOpened);
  const merged = sum(rows, (r) => r.prsMerged);

  const totalTasks: TasksStat = {
    issues,
    prs,
    total: issues + prs,
    deltaVsPriorWeek: weeklyDelta(db, today),
  };

  const opened = prs;
  const closed = merged + issues;
  const completion: CompletionStat = {
    opened,
    closed,
    rate: opened > 0 ? closed / opened : 0,
  };

  return {
    range,
    repoUrl: `https://github.com/${config.repoOwner}/${config.repoName}`,
    chart,
    totalTasks,
    completion,
    streak: computeStreak(db, today),
  };
}

function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + f(r), 0);
}

/** (this 7d total tasks) − (prior 7d total tasks), signed. */
function weeklyDelta(db: Database.Database, today: string): number {
  const thisFrom = shiftDateKey(today, -6);
  const priorTo = shiftDateKey(today, -7);
  const priorFrom = shiftDateKey(today, -13);
  const thisRows = getRange(db, thisFrom, today);
  const priorRows = getRange(db, priorFrom, priorTo);
  const thisTotal = sum(thisRows, (r) => r.issuesClosed + r.prsOpened);
  const priorTotal = sum(priorRows, (r) => r.issuesClosed + r.prsOpened);
  return thisTotal - priorTotal;
}

/** True if `date` has >=1 event. */
function hasEvents(db: Database.Database, date: string): boolean {
  const row = db.prepare('SELECT 1 FROM events WHERE race_date = ? LIMIT 1').get(date) as unknown;
  return row != null;
}

function computeStreak(db: Database.Database, today: string): StreakStat {
  // current run ending today
  let current = 0;
  let cursor = today;
  let startDate: string | null = null;
  while (hasEvents(db, cursor)) {
    current += 1;
    startDate = cursor;
    cursor = shiftDateKey(cursor, -1);
  }

  // best run within the current calendar month (scan that month's days)
  const [y, m] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let best = 0;
  let run = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (hasEvents(db, key)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, startDate, bestThisMonth: best };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/services/statsService.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/statsService.ts api/test/services/statsService.test.ts
git commit -m "feat(api): add stats service (chart, tasks, completion, streak)"
```

---

## Task 8: Reset scheduler — NY-midnight final snapshot + rollover

**Files:**
- Create: `api/src/scheduler/resetScheduler.ts`
- Test: `api/test/scheduler/resetScheduler.test.ts`

`ResetScheduler` arms a timer for `msUntilNextNyMidnight(now)`. When it fires it:
1. captures a **final snapshot** for the closing day (the NY date of the instant just before midnight) via the injected `snapshot(raceDate, at)` callback (the poller's `snapshotNow` in production), and
2. re-arms for the next midnight.

**Reset is a date-key rollover, not a wipe.** Events already carry their own `race_date`, so the new day's `getToday` naturally reads the new date; nothing is deleted. The only stored action at midnight is the final snapshot that seals the closing day for replay.

- [ ] **Step 1: Write the failing test**

Create `api/test/scheduler/resetScheduler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ResetScheduler, type ResetSchedulerDeps } from '../../src/scheduler/resetScheduler';

describe('ResetScheduler', () => {
  it('arms a timer for msUntilNextNyMidnight and snapshots the closing day on fire', () => {
    let fire: (() => void) | null = null;
    const snapshot = vi.fn();
    // 2026-06-02T23:59:00 EDT is 2026-06-03T03:59:00Z; ms to NY midnight = 60s.
    let now = new Date('2026-06-03T03:59:00.000Z');

    const deps: ResetSchedulerDeps = {
      clock: () => now,
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot,
      setTimer: (fn) => {
        fire = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    };

    const sched = new ResetScheduler(deps);
    sched.start();
    expect(fire).not.toBeNull();

    // advance to just before the new midnight and fire
    now = new Date('2026-06-03T04:00:00.000Z');
    fire!();
    expect(snapshot).toHaveBeenCalledTimes(1);
    // it snapshots the *closing* day's race date
    expect(snapshot.mock.calls[0][0]).toBe('2026-06-02');
  });

  it('re-arms the timer after firing', () => {
    let armCount = 0;
    let fire: (() => void) | null = null;
    const now = new Date('2026-06-03T03:59:00.000Z');
    const deps: ResetSchedulerDeps = {
      clock: () => now,
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot: () => {},
      setTimer: (fn) => {
        armCount += 1;
        fire = fn;
        return armCount as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    };
    const sched = new ResetScheduler(deps);
    sched.start();
    expect(armCount).toBe(1);
    fire!();
    expect(armCount).toBe(2); // re-armed for the next midnight
  });

  it('stop() clears the timer and prevents re-arming', () => {
    const clearTimer = vi.fn();
    let fire: (() => void) | null = null;
    const deps: ResetSchedulerDeps = {
      clock: () => new Date('2026-06-03T03:59:00.000Z'),
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot: () => {},
      setTimer: (fn) => {
        fire = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer,
    };
    const sched = new ResetScheduler(deps);
    sched.start();
    sched.stop();
    expect(clearTimer).toHaveBeenCalled();
    const armedBefore = fire;
    fire!(); // firing after stop must not re-arm or snapshot
    expect(fire).toBe(armedBefore);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/scheduler/resetScheduler.test.ts`
Expected: FAIL — `Cannot find module '../../src/scheduler/resetScheduler'`.

- [ ] **Step 3: Implement the scheduler**

Create `api/src/scheduler/resetScheduler.ts`:

```ts
export interface ResetSchedulerDeps {
  clock: () => Date;
  msUntilNextNyMidnight: (now: Date) => number;
  raceDateFor: (date: Date) => string;
  /** Capture a final snapshot for the closing day. */
  snapshot: (raceDate: string, at: Date) => void;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * Fires at NY midnight to seal the closing day with a final snapshot, then re-arms.
 * NOT destructive: events already carry their own race_date, so the next day's
 * getToday simply reads the new date key. Reset == rollover + final snapshot.
 */
export class ResetScheduler {
  private handle: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: ResetSchedulerDeps) {}

  start(): void {
    this.stopped = false;
    this.arm();
  }

  stop(): void {
    this.stopped = true;
    if (this.handle != null) {
      this.deps.clearTimer(this.handle);
      this.handle = null;
    }
  }

  private arm(): void {
    if (this.stopped) return;
    const ms = this.deps.msUntilNextNyMidnight(this.deps.clock());
    this.handle = this.deps.setTimer(() => this.onMidnight(), ms);
  }

  private onMidnight(): void {
    if (this.stopped) return;
    const at = this.deps.clock();
    // The closing day = the NY date one millisecond before "now" (we just crossed midnight).
    const closing = this.deps.raceDateFor(new Date(at.getTime() - 1));
    this.deps.snapshot(closing, at);
    this.arm();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/scheduler/resetScheduler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/scheduler/resetScheduler.ts api/test/scheduler/resetScheduler.test.ts
git commit -m "feat(api): add NY-midnight reset scheduler (final snapshot + rollover)"
```

---

## Task 9: Routes + `createApp` factory

**Files:**
- Create: `api/src/routes/race.ts`
- Create: `api/src/routes/races.ts`
- Create: `api/src/routes/stats.ts`
- Create: `api/src/routes/reactions.ts`
- Create: `api/src/app.ts`
- Test: `api/test/app.test.ts`

`createApp(deps)` wires JSON middleware, mounts routes, and adds a 404 + error handler. `deps` carries the open `db`, the `config`, and a `clock` so routes that need "now" are deterministic. The token lives only inside `config` and is **never** serialized; an integration test asserts no response body contains it.

`POST /api/race/today/reactions` validates `CreateReactionBody`, writes only to **today's** `race_date`, and returns `CreateReactionResponse` with the target's updated `ReactionSummary`. Reactions are cosmetic and never touch score.

- [ ] **Step 1: Write the failing integration test**

Create `api/test/app.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate';
import { createApp, type AppDeps } from '../src/app';
import type { AppConfig } from '../src/config';

const config: AppConfig = {
  port: 8787, githubToken: 'super-secret-token-xyz', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:',
};

function seedDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare('INSERT INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    'a', 'A', 'https://a/a.png', '2026-06-01T00:00:00.000Z',
  );
  db.prepare('INSERT INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    'b', 'B', 'https://a/b.png', '2026-06-01T00:00:00.000Z',
  );
  // today (2026-06-02) events
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'pr_merged:1', 'a', 'pr_merged', 8, '2026-06-02T10:00:00.000Z', '2026-06-02',
  );
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'commit:2', 'b', 'commit', 1, '2026-06-02T10:00:00.000Z', '2026-06-02',
  );
  db.prepare('INSERT INTO poll_meta(key, value) VALUES (?,?)').run('last_polled_at', '2026-06-02T15:00:00.000Z');
  // archived day 2026-06-01
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'pr_merged:9', 'a', 'pr_merged', 8, '2026-06-01T10:00:00.000Z', '2026-06-01',
  );
  db.prepare('INSERT INTO race_snapshots(race_date, racer_login, score, captured_at) VALUES (?,?,?,?)').run(
    '2026-06-01', 'a', 8, '2026-06-01T23:00:00.000Z',
  );
  // daily_stats for chart
  db.prepare('INSERT INTO daily_stats(race_date, commits, prs_opened, prs_merged, issues_closed) VALUES (?,?,?,?,?)').run(
    '2026-06-02', 1, 0, 1, 0,
  );
  return db;
}

function makeApp(db: Database.Database) {
  const deps: AppDeps = { db, config, clock: () => new Date('2026-06-02T15:00:00.000Z') };
  return createApp(deps);
}

describe('API integration', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = seedDb();
  });

  it('GET /api/race/today returns live standings', async () => {
    const res = await request(makeApp(db)).get('/api/race/today');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
    expect(res.body.raceDate).toBe('2026-06-02');
    expect(res.body.standings[0].login).toBe('a');
    expect(res.body.topScore).toBe(8);
  });

  it('GET /api/race/:date returns an archive', async () => {
    const res = await request(makeApp(db)).get('/api/race/2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(false);
    expect(res.body.raceDate).toBe('2026-06-01');
    expect(res.body.recap.podium[0].login).toBe('a');
  });

  it('GET /api/race/:date 404s for an unknown date', async () => {
    const res = await request(makeApp(db)).get('/api/race/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /api/races lists archived dates', async () => {
    const res = await request(makeApp(db)).get('/api/races');
    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.raceDate)).toContain('2026-06-01');
  });

  it('GET /api/stats returns chart + sidebar shapes', async () => {
    const res = await request(makeApp(db)).get('/api/stats?range=14d');
    expect(res.status).toBe(200);
    expect(res.body.repoUrl).toBe('https://github.com/S2AI/s2shape');
    expect(Array.isArray(res.body.chart)).toBe(true);
    expect(res.body.totalTasks).toBeDefined();
    expect(res.body.streak).toBeDefined();
  });

  it('POST /api/race/today/reactions increments the target summary', async () => {
    const res = await request(makeApp(db))
      .post('/api/race/today/reactions')
      .send({ targetLogin: 'a', kind: '🔥', reactor: 'mira-k' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.reactions.total).toBe(1);
    expect(res.body.reactions.byKind['🔥']).toBe(1);
  });

  it('POST /api/race/today/reactions 400s on an invalid body', async () => {
    const res = await request(makeApp(db))
      .post('/api/race/today/reactions')
      .send({ targetLogin: 'a', kind: 'nope', reactor: 'mira-k' });
    expect(res.status).toBe(400);
  });

  it('never serializes the github token in any response', async () => {
    const endpoints = ['/api/race/today', '/api/race/2026-06-01', '/api/races', '/api/stats?range=14d'];
    for (const e of endpoints) {
      const res = await request(makeApp(db)).get(e);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-token-xyz');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/app.test.ts`
Expected: FAIL — `Cannot find module '../src/app'`.

- [ ] **Step 3: Implement the race + races routes**

Create `api/src/routes/race.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getToday, getArchive } from '../services/raceService';
import { insertReaction, summaryForDate } from '../db/repositories/reactions';
import { raceDateFor } from '../time/raceDate';
import { reactionsRouter } from './reactions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function raceRouter(db: Database.Database, clock: () => Date): Router {
  const router = Router();

  router.get('/today', (_req, res) => {
    res.json(getToday(db, clock()));
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
```

- [ ] **Step 4: Implement the reactions route**

Create `api/src/routes/reactions.ts`:

```ts
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { CreateReactionBody, CreateReactionResponse, ReactionKind, ReactionSummary } from '@racingshape/shared';
import { insertReaction, summaryForDate } from '../db/repositories/reactions';
import { raceDateFor } from '../time/raceDate';

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
    const summary = summaryForDate(db, raceDate).get(body.targetLogin) ?? EMPTY_SUMMARY;
    const out: CreateReactionResponse = { ok: true, reactions: summary };
    res.status(201).json(out);
  });

  return router;
}
```

- [ ] **Step 5: Implement the races + stats routes**

Create `api/src/routes/races.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { listRaces } from '../services/raceService';

export function racesRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(listRaces(db));
  });
  return router;
}
```

Create `api/src/routes/stats.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config';
import { getStats } from '../services/statsService';

export function statsRouter(db: Database.Database, config: AppConfig, clock: () => Date): Router {
  const router = Router();
  router.get('/', (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : '14d';
    res.json(getStats(db, range, clock(), config));
  });
  return router;
}
```

- [ ] **Step 6: Implement the app factory**

Create `api/src/app.ts`:

```ts
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import type { AppConfig } from './config';
import { raceRouter } from './routes/race';
import { racesRouter } from './routes/races';
import { statsRouter } from './routes/stats';

export interface AppDeps {
  db: Database.Database;
  config: AppConfig;
  clock: () => Date;
}

/** Build the Express app. No `listen` — callers (index.ts / tests) own the server. */
export function createApp(deps: AppDeps): Express {
  const { db, config, clock } = deps;
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/race', raceRouter(db, clock));
  app.use('/api/races', racesRouter(db));
  app.use('/api/stats', statsRouter(db, config, clock));

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  // error handler (must keep 4 args for Express to treat it as such)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', message });
  });

  return app;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/app.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Commit**

```bash
git add api/src/routes/race.ts api/src/routes/races.ts api/src/routes/stats.ts api/src/routes/reactions.ts api/src/app.ts api/test/app.test.ts
git commit -m "feat(api): add REST routes and testable createApp factory"
```

---

## Task 10: Production wiring — client fetch + `index.ts` entry

**Files:**
- Create: `api/src/github/fetchActivity.ts`
- Create: `api/src/index.ts`
- Test: `api/test/github/fetchActivity.test.ts`

`fetchActivity.ts` builds the production `fetchBatch` the poller needs: it runs three `conditionalGet` calls (commits, PRs, issues) against `S2AI/s2shape`, maps each result to `RawActivity[]`, filters to the target NY race date by `occurredAt`, and returns a `RawActivityBatch`. `index.ts` loads config, opens + migrates the DB, builds the Octokit client, wires the poller with the real `fetchBatch` and real timers, starts the reset scheduler, and listens.

- [ ] **Step 1: Write the failing test for activity mapping**

Create `api/test/github/fetchActivity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapCommits, mapPulls, mapIssues } from '../../src/github/fetchActivity';

describe('fetchActivity mappers', () => {
  it('maps commit payloads to RawActivity', () => {
    const raw = [
      {
        sha: 'abc',
        commit: { author: { date: '2026-06-02T15:00:00Z' } },
        author: { login: 'devon-r', avatar_url: 'https://a/d.png' },
      },
    ];
    const out = mapCommits(raw as any);
    expect(out).toEqual([
      {
        type: 'commit',
        nativeId: 'abc',
        author: { login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://a/d.png' },
        occurredAt: '2026-06-02T15:00:00.000Z',
      },
    ]);
  });

  it('maps an open PR to pr_opened and a merged PR to pr_merged', () => {
    const raw = [
      { number: 12, state: 'open', merged_at: null, created_at: '2026-06-02T16:00:00Z',
        user: { login: 'mira-k', avatar_url: 'https://a/m.png' } },
      { number: 13, state: 'closed', merged_at: '2026-06-02T17:00:00Z', created_at: '2026-06-02T09:00:00Z',
        user: { login: 'devon-r', avatar_url: 'https://a/d.png' } },
    ];
    const out = mapPulls(raw as any);
    expect(out).toEqual([
      { type: 'pr_opened', nativeId: '12', author: { login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://a/m.png' }, occurredAt: '2026-06-02T16:00:00.000Z' },
      { type: 'pr_merged', nativeId: '13', author: { login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://a/d.png' }, occurredAt: '2026-06-02T17:00:00.000Z' },
    ]);
  });

  it('maps a closed issue to issue_closed and skips PRs surfaced as issues', () => {
    const raw = [
      { number: 34, state: 'closed', closed_at: '2026-06-02T18:00:00Z',
        user: { login: 'mira-k', avatar_url: 'https://a/m.png' } },
      { number: 35, state: 'closed', closed_at: '2026-06-02T18:30:00Z', pull_request: {},
        user: { login: 'devon-r', avatar_url: 'https://a/d.png' } },
    ];
    const out = mapIssues(raw as any);
    expect(out).toEqual([
      { type: 'issue_closed', nativeId: '34', author: { login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://a/m.png' }, occurredAt: '2026-06-02T18:00:00.000Z' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/github/fetchActivity.test.ts`
Expected: FAIL — `Cannot find module '../../src/github/fetchActivity'`.

- [ ] **Step 3: Implement the fetch/mappers**

Create `api/src/github/fetchActivity.ts`:

```ts
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config';
import { conditionalGet, type RequestFn } from './client';
import { raceDateFor } from '../time/raceDate';
import type { RawActivity, RawActivityBatch } from './types';

interface RawCommit {
  sha: string;
  commit: { author?: { date?: string } | null };
  author: { login?: string; avatar_url?: string } | null;
}
interface RawPull {
  number: number;
  state: string;
  merged_at: string | null;
  created_at: string;
  user: { login?: string; avatar_url?: string } | null;
}
interface RawIssue {
  number: number;
  state: string;
  closed_at: string | null;
  pull_request?: unknown;
  user: { login?: string; avatar_url?: string } | null;
}

function author(login: string | undefined, avatar: string | undefined) {
  const l = login ?? 'unknown';
  return { login: l, displayName: l, avatarUrl: avatar ?? '' };
}
const iso = (s: string) => new Date(s).toISOString();

export function mapCommits(rows: RawCommit[]): RawActivity[] {
  return rows
    .filter((c) => c.commit?.author?.date)
    .map((c) => ({
      type: 'commit' as const,
      nativeId: c.sha,
      author: author(c.author?.login, c.author?.avatar_url),
      occurredAt: iso(c.commit!.author!.date!),
    }));
}

export function mapPulls(rows: RawPull[]): RawActivity[] {
  const out: RawActivity[] = [];
  for (const p of rows) {
    if (p.merged_at) {
      out.push({
        type: 'pr_merged',
        nativeId: String(p.number),
        author: author(p.user?.login, p.user?.avatar_url),
        occurredAt: iso(p.merged_at),
      });
    } else {
      out.push({
        type: 'pr_opened',
        nativeId: String(p.number),
        author: author(p.user?.login, p.user?.avatar_url),
        occurredAt: iso(p.created_at),
      });
    }
  }
  return out;
}

export function mapIssues(rows: RawIssue[]): RawActivity[] {
  return rows
    .filter((i) => i.state === 'closed' && i.closed_at && i.pull_request === undefined)
    .map((i) => ({
      type: 'issue_closed' as const,
      nativeId: String(i.number),
      author: author(i.user?.login, i.user?.avatar_url),
      occurredAt: iso(i.closed_at!),
    }));
}

/**
 * Production fetchBatch for the poller: pull commits/PRs/issues via conditional GETs,
 * map them, and keep only those whose NY race date matches the target day.
 */
export function makeFetchBatch(
  db: Database.Database,
  request: RequestFn,
  config: AppConfig,
): (raceDate: string) => Promise<RawActivityBatch> {
  const base = `/repos/${config.repoOwner}/${config.repoName}`;
  return async (raceDate: string): Promise<RawActivityBatch> => {
    const commits = await conditionalGet<RawCommit[]>(db, request, `GET ${base}/commits`, { per_page: 100 });
    const pulls = await conditionalGet<RawPull[]>(db, request, `GET ${base}/pulls`, { state: 'all', per_page: 100, sort: 'updated', direction: 'desc' });
    const issues = await conditionalGet<RawIssue[]>(db, request, `GET ${base}/issues`, { state: 'closed', per_page: 100, sort: 'updated', direction: 'desc' });

    const all = [...mapCommits(commits), ...mapPulls(pulls), ...mapIssues(issues)];
    const activities = all.filter((a) => raceDateFor(new Date(a.occurredAt)) === raceDate);
    return { raceDate, activities };
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/github/fetchActivity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the entry point**

Create `api/src/index.ts`:

```ts
import { loadConfig } from './config';
import { openDb } from './db/connection';
import { migrate } from './db/migrate';
import { createApp } from './app';
import { makeOctokit } from './github/client';
import { makeFetchBatch } from './github/fetchActivity';
import { Poller } from './github/poller';
import { ResetScheduler } from './scheduler/resetScheduler';
import { raceDateFor, msUntilNextNyMidnight } from './time/raceDate';

function main(): void {
  const config = loadConfig(process.env);
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
  });

  const scheduler = new ResetScheduler({
    clock: () => new Date(),
    msUntilNextNyMidnight,
    raceDateFor,
    snapshot: (raceDate, at) => poller.snapshotNow(raceDate, at),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h),
  });

  const app = createApp({ db, config, clock: () => new Date() });

  poller.start();
  scheduler.start();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`RacingShape API listening on :${config.port}`);
  });
}

main();
```

- [ ] **Step 6: Type-check the whole api workspace and run all its tests**

Run: `npm test -w @racingshape/api`
Expected: PASS — every api test green (client, ingest, poller, services, scheduler, app, fetchActivity).

- [ ] **Step 7: Add `dev`/`start`/`build` scripts to the api workspace**

Modify `api/package.json` `scripts` to include (keep any existing `test` script):

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

Run (installs the dev runner if not already present from plan 01):

```bash
npm install -w @racingshape/api -D tsx
```

Expected: `tsx` added to api devDependencies.

- [ ] **Step 8: Verify the API boots**

Run (from repo root, with a fake token so `loadConfig` passes):

```bash
GITHUB_TOKEN=dummy PORT=8799 DB_PATH=./data/boot-check.db timeout 5 npm run dev -w @racingshape/api || true
```

Expected: log line `RacingShape API listening on :8799` appears before the timeout kills it. (The poller's first GitHub call may 403 with the dummy token — that is fine; backoff handles it and the process still serves.)

- [ ] **Step 9: Commit**

```bash
git add api/src/github/fetchActivity.ts api/src/index.ts api/test/github/fetchActivity.test.ts api/package.json package-lock.json
git commit -m "feat(api): wire production fetchBatch, poller, scheduler, and entry point"
```

---

## Task 11: Update root `CLAUDE.md` pre-code note

**Files:**
- Modify: `CLAUDE.md` (replace the "Project status: pre-code" section)

The API is now runnable, so the "pre-code" placeholder in the root `CLAUDE.md` is stale. Replace it with the real commands.

- [ ] **Step 1: Replace the pre-code section**

In `CLAUDE.md`, replace the entire block starting at `## Project status: pre-code` and ending just before `## What RacingShape is` with:

```markdown
## Commands

The monorepo uses npm workspaces (`shared`, `api`, `web`). Run from the repo root.

- **Install:** `npm install`
- **Test everything:** `npm test`
- **Test one workspace:** `npm test -w @racingshape/api`
- **Test one file:** `npm test -w @racingshape/api -- run api/test/github/poller.test.ts`
- **Test by name:** append `-t "name substring"`
- **Run the API (dev):** `npm run dev -w @racingshape/api` (needs `GITHUB_TOKEN` in env; see `.env.example`)
- **Build the API:** `npm run build -w @racingshape/api`

> Frontend (`web`) dev/build scripts are added by plan 03.
```

- [ ] **Step 2: Verify the file still reads coherently**

Run: `npm test`
Expected: PASS across all workspaces (sanity check that nothing referenced the removed section).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: replace pre-code note with real api run/test commands"
```

---

## Done when

- [ ] `GET /api/race/today`, `GET /api/race/:date`, `GET /api/races`, `GET /api/stats?range=14d`, and `POST /api/race/today/reactions` are implemented and covered by green `supertest` integration tests (`api/test/app.test.ts`).
- [ ] `/api/race/:date` 404s for an unknown date; the reaction POST returns 201 and an incremented `ReactionSummary`; no endpoint response ever contains the GitHub token (asserted).
- [ ] `Poller` is unit-tested: `pollOnce` ingests + recomputes daily_stats + snapshots on cadence; 403/secondary-limit backoff doubles, caps at 15 min, and resets after success — all with an injected clock and a mocked `fetchBatch` (no real timers/network).
- [ ] `ResetScheduler` is unit-tested: arms for `msUntilNextNyMidnight`, snapshots the **closing** day on fire, re-arms, and `stop()` halts it — injected timer, no real clock.
- [ ] `ingestEvents`, `cosmeticsFor`, `buildRecap`, `getToday`/`getArchive`/`listRaces`, `getStats`, and the `fetchActivity` mappers each have passing unit tests.
- [ ] `npm test -w @racingshape/api` is fully green; `npm run dev -w @racingshape/api` boots and logs `RacingShape API listening on :<port>`.
- [ ] Root `CLAUDE.md` pre-code section is replaced with real run/test commands.

**Handoff to Plan 03:** the API now serves live and archived race data, stats, recap, cosmetics, and reactions over REST — Plan 03 (`...-03-frontend-race.md`) builds the Vite+React+Tailwind dashboard that consumes these exact shapes via a typed `web/src/lib/api.ts`.
