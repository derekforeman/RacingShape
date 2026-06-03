# RacingShape — Build Roadmap & Shared Contract

> **For agentic workers:** This document is the **canonical contract** for the whole
> RacingShape build. The four phase plans in this directory implement it in order. When a
> phase plan references a type, file path, scoring weight, DB column, or API shape, the
> definitive version is **here**. If a phase plan and this document disagree, this document
> wins — fix the phase plan.

**Goal:** Ship RacingShape v1 — a daily GitHub-activity car race dashboard for `S2AI/s2shape` —
in four sequential, independently-testable slices.

**Source of truth:** [`prd.md`](../../../prd.md), [`DESIGN.md`](../../../DESIGN.md),
[`mockup-2-f1-broadcast.html`](../../../mockup-2-f1-broadcast.html). Decisions in those are
approved, not open questions. This roadmap translates them into concrete tech and contracts.

---

## 1. Execution order

Build the plans in this order. Each produces working, tested software on its own.

| # | Plan | Ships | Depends on |
|---|------|-------|------------|
| 01 | [`...-01-backend-core.md`](2026-06-02-racingshape-01-backend-core.md) | Monorepo + `shared` package + SQLite schema/migrations + NY race-date logic + scoring engine + config. A tested core library with no network. | — |
| 02 | [`...-02-github-api.md`](2026-06-02-racingshape-02-github-api.md) | GitHub poller (ETags + backoff), event ingest, snapshotting, stats aggregation, recap + cosmetics computation, all REST endpoints, reset scheduler. A running API serving real data. | 01 |
| 03 | [`...-03-frontend-race.md`](2026-06-02-racingshape-03-frontend-race.md) | Vite+React+Tailwind shell, design tokens, tooltip engine, header, timing tower, track + cars with auto-scale + tween, telemetry chart, pit wall, dark mode. Live dashboard against the API. | 02 |
| 04 | [`...-04-delight.md`](2026-06-02-racingshape-04-delight.md) | Pit-stop boosts (particles + cheer), Grand Prix recap card + PNG export, earned cosmetics layer, date selector + replay engine. The full delight layer. | 03 |

**Hard rule on scope:** v1 is the whole release (PRD §7). Build everything in plans 01–04.
Do not pull deferred items in (multi-repo, configurable weights, Slack, etc.). Do not defer
v1 items.

---

## 2. Tech stack & rationale

| Concern | Choice | Why |
|---|---|---|
| Monorepo | npm **workspaces** (`shared`, `api`, `web`) | Built into npm 11; no extra tooling. |
| Language | TypeScript everywhere | PRD §6. |
| Backend HTTP | **Express 5** | Boring, universally known, matches "keep it small." |
| SQLite driver | **better-sqlite3** | Synchronous, simple, ideal at this scale; no async ceremony. |
| GitHub client | **@octokit/rest** | First-class ETag/conditional-request support for rate limits. |
| Test runner | **Vitest** | One runner for both backend and frontend; TS-native, fast. |
| Frontend build | **Vite** + React 18 + TypeScript | Standard, fast HMR. |
| Styling | **Tailwind CSS** + CSS custom properties for tokens | PRD §6; tokens drive dark/light. |
| Charts | Hand-built CSS stacked bars (no chart lib) | Mockup already does this; keeps deps light. |
| PNG export (recap) | **html-to-image** (client canvas) | Avoids a server-side render path; simplest of the DESIGN §10 options. |
| Animations | CSS transitions + a JS frame stepper for replay | Mockup approach; no animation lib. |
| Lint/format | ESLint (flat config) + Prettier | Minimal, standard. |

> 💡 **npm workspaces**: one root `package.json` lists child package folders under `workspaces`;
> `npm install` once at root links them so `@racingshape/shared` is importable from `api`/`web`
> without publishing.

**Node version:** 26 (already installed). Pin with an `.nvmrc` of `26`.

---

## 3. Repository layout (target end-state)

```
package.json                 root: workspaces + top-level scripts
.nvmrc                       "26"
tsconfig.base.json           shared compiler options
eslint.config.js             flat ESLint config (root)
.prettierrc.json
.env.example                 documents every env var
.gitignore                   (extend: data/, node_modules, dist, .env)
data/                        SQLite file lives here (gitignored)

shared/                      @racingshape/shared — types + scoring, zero deps
  package.json
  tsconfig.json
  src/
    types.ts                 ALL shared TS types (see §6)
    scoring.ts               SCORE_WEIGHTS + helpers (see §5)
    index.ts                 re-exports
  test/
    scoring.test.ts

api/                         @racingshape/api
  package.json
  tsconfig.json
  src/
    index.ts                 entry: build app, open db, start poller+scheduler, listen
    app.ts                   createApp(deps) -> express.Express  (testable, no listen)
    config.ts                loadConfig(env) -> AppConfig (see §7)
    db/
      connection.ts          openDb(path) -> Database, sets pragmas
      migrate.ts             migrate(db): runs SCHEMA_SQL
      schema.sql.ts          SCHEMA_SQL string constant (see §8)
      repositories/
        racers.ts            upsertRacer, getRacer, listRacers
        events.ts            insertEventsIgnore, breakdownByRacer, countsForRange
        snapshots.ts         insertSnapshot, framesForDate, latestScores
        reactions.ts         insertReaction, summaryForDate, listForDate
        dailyStats.ts        upsertDailyStats, getRange
        httpCache.ts         get/put conditional-request cache
        pollMeta.ts          get/set string meta
    time/
      raceDate.ts            raceDateFor(date), msUntilNextNyMidnight(now), nyParts(date)
    scoring/
      standings.ts           buildStandings(...) -> RacerStanding[]
    github/
      client.ts              makeOctokit(config) + conditionalGet wrapper
      ingest.ts              ingestEvents(db, raw) -> normalized event rows
      poller.ts              Poller class: start/stop, pollOnce(), backoff
    services/
      raceService.ts         getToday(db), getArchive(db,date), listRaces(db)
      statsService.ts        getStats(db, range)
      recapService.ts        buildRecap(db, date) -> Recap
      cosmeticsService.ts    cosmeticsFor(db, date) -> Map<login, Cosmetic[]>
    scheduler/
      resetScheduler.ts      schedules midnight-NY archive+reset
    routes/
      race.ts                /api/race/today, /api/race/:date
      races.ts               /api/races
      stats.ts               /api/stats
      reactions.ts           POST /api/race/today/reactions
  test/
    ... (mirrors src)

web/                         @racingshape/web
  package.json
  tsconfig.json
  index.html
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  src/
    main.tsx
    App.tsx
    index.css                Tailwind directives + token CSS vars (see §9)
    lib/
      api.ts                 typed fetch client for every endpoint
      types.ts               re-export from @racingshape/shared
      usePolling.ts          generic interval-refetch hook
      useTheme.ts            dark/light + localStorage
      tooltip.tsx            TooltipProvider + useTip + tip() helper; applied via data-tip="HEADER||body" attribute
      format.ts              breakdown -> tooltip text helpers
    components/
      Header.tsx
      RaceControl.tsx        frame wrapping tower+track
      TimingTower.tsx
      Track.tsx
      Car.tsx
      TelemetryChart.tsx
      PitWall.tsx
      Recap.tsx
      DateSelector.tsx       (plan 04)
      ReplayControls.tsx     (plan 04)
      BoostButton.tsx        (plan 04)
      cosmetics/Cosmetics.tsx(plan 04)
    replay/
      useReplay.ts           (plan 04) frame stepper
  test/
    ...
```

> Plans 01–03 create the files they need; plan 04 adds the delight-only files. A file listed
> here but not yet created is created by the plan that first needs it.

---

## 4. Conventions (all plans honor these)

- **TDD, bite-sized steps.** Write failing test → run it (see it fail) → minimal code → run
  (see it pass) → commit. One action per step.
- **Commits:** Conventional Commits (`feat:`, `test:`, `chore:`, `fix:`, `docs:`). Per
  `CLAUDE.md`: **no Claude co-author line, no Claude Code links.**
- **Branching:** Conventional Branch naming, branched from `dev` (e.g.
  `feat/backend-core-scaffold`). PRs target `dev`. Never commit to `master`.
- **Test commands:**
  - All: `npm test` (root → `vitest run` across workspaces).
  - One workspace: `npm test -w @racingshape/api`.
  - One file: `npm test -w @racingshape/api -- run api/test/time/raceDate.test.ts`.
  - One test by name: append `-t "name substring"`.
- **No `any`** in committed code unless quarantined behind an explicit cast with a comment.
- **Encouraging, never punitive** (PRD principle): no API field, copy string, or UI element
  ranks the back of the pack as judgment. The `topMover`/DRS signal is a *positive* nudge only.
- **GitHub token is server-side only.** It is read from env in `api/src/config.ts` and never
  serialized into any API response or sent to `web`.

---

## 5. Scoring (canonical) — `shared/src/scoring.ts`

```ts
import type { EventType, ScoreBreakdown } from './types';

/** Weighted activity points per GitHub event. Tune here only (PRD §4). */
export const SCORE_WEIGHTS: Record<EventType, number> = {
  commit: 1,
  pr_opened: 5,
  pr_merged: 8,
  issue_closed: 3,
};

export function pointsFor(type: EventType): number {
  return SCORE_WEIGHTS[type];
}

/** Total score from a count-per-type breakdown. */
export function scoreFromBreakdown(b: ScoreBreakdown): number {
  return (
    b.commit * SCORE_WEIGHTS.commit +
    b.pr_opened * SCORE_WEIGHTS.pr_opened +
    b.pr_merged * SCORE_WEIGHTS.pr_merged +
    b.issue_closed * SCORE_WEIGHTS.issue_closed
  );
}

export const EMPTY_BREAKDOWN: ScoreBreakdown = {
  commit: 0,
  pr_opened: 0,
  pr_merged: 0,
  issue_closed: 0,
};
```

---

## 6. Shared types (canonical) — `shared/src/types.ts`

These are the exact names/shapes every plan must use. The API returns these; the web consumes
them.

```ts
export type EventType = 'commit' | 'pr_opened' | 'pr_merged' | 'issue_closed';
export type ReactionKind = '🔥' | '⚡' | '🏎️';
export type Cosmetic = 'flame_trail' | 'gold_rims' | 'rookie_decal';

export interface Racer {
  login: string;          // github_login (pk)
  displayName: string;
  avatarUrl: string;
  firstSeen: string;      // ISO UTC
}

/** Count of each event type for a racer in a day. */
export interface ScoreBreakdown {
  commit: number;
  pr_opened: number;
  pr_merged: number;
  issue_closed: number;
}

export interface ReactionSummary {
  total: number;
  byKind: Record<ReactionKind, number>;
}

export interface RacerStanding {
  login: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  breakdown: ScoreBreakdown;   // counts per event type (multiply by weights for points)
  position: number;            // 1-based, ties share lower number then by login
  gapToLeader: number;         // points behind P1; 0 for leader
  isLeader: boolean;
  topMover: boolean;           // DRS: gained the most points on the latest poll
  reactions: ReactionSummary;
  cosmetics: Cosmetic[];
}

export interface RaceToday {
  raceDate: string;            // YYYY-MM-DD (America/New_York)
  live: true;
  topScore: number;            // for track auto-scale (>=1)
  standings: RacerStanding[];  // sorted by position
  lastPolledAt: string | null; // ISO UTC
}

export interface SnapshotFrame {
  capturedAt: string;                          // ISO UTC
  scores: { login: string; score: number }[];
}

export interface ArchivedReaction {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;
  createdAt: string;           // ISO UTC
}

export interface PodiumStep {
  position: number;            // 1..3
  login: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface Superlative {
  key: 'fastest_hour' | 'comeback' | 'midnight_grinder';
  title: string;               // human label, e.g. "Fastest hour"
  login: string | null;        // null if no data supports it
  detail: string;              // e.g. "9 commits · 2–3pm"
}

export interface Recap {
  raceDate: string;
  podium: PodiumStep[];        // up to 3
  superlatives: Superlative[]; // exactly 3 (login may be null)
}

export interface RaceArchive {
  raceDate: string;
  live: false;
  topScore: number;
  standings: RacerStanding[];  // final standings for the day
  frames: SnapshotFrame[];     // ordered by capturedAt for replay
  reactions: ArchivedReaction[];
  recap: Recap;
}

export interface RaceListItem {
  raceDate: string;
  topScore: number;
  winnerLogin: string | null;
}

export interface ChartDay {
  raceDate: string;            // YYYY-MM-DD
  commits: number;
  prsOpened: number;
  issuesClosed: number;
}

export interface TasksStat {
  total: number;
  issues: number;
  prs: number;
  deltaVsPriorWeek: number;    // signed
}

export interface CompletionStat {
  rate: number;                // 0..1
  closed: number;
  opened: number;
}

export interface StreakStat {
  current: number;             // consecutive days with >=1 event, ending today
  startDate: string | null;    // YYYY-MM-DD when current run began
  bestThisMonth: number;
}

export interface StatsResponse {
  range: string;               // echo, e.g. "14d"
  repoUrl: string;             // https://github.com/S2AI/s2shape
  chart: ChartDay[];           // ascending by date
  totalTasks: TasksStat;
  completion: CompletionStat;
  streak: StreakStat;
}

/** POST body for a pit-stop boost (plan 04). */
export interface CreateReactionBody {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;             // who cheered (free-text handle for v1)
}

export interface CreateReactionResponse {
  ok: true;
  reactions: ReactionSummary;  // updated count for the target
}
```

---

## 7. Config (canonical) — `api/src/config.ts`

```ts
export interface AppConfig {
  port: number;
  githubToken: string;
  repoOwner: string;        // "S2AI"
  repoName: string;         // "s2shape"
  pollIntervalMs: number;   // default 60_000
  snapshotIntervalMs: number; // default 300_000 (5 min) — replay frame cadence
  dbPath: string;           // default "./data/racingshape.db"
}
```

Env vars (documented in `.env.example`):

| Var | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `8787` | API listen port |
| `GITHUB_TOKEN` | **yes** (runtime) | — | PAT/App token, server-side only |
| `REPO_OWNER` | no | `S2AI` | |
| `REPO_NAME` | no | `s2shape` | |
| `POLL_INTERVAL_MS` | no | `60000` | |
| `SNAPSHOT_INTERVAL_MS` | no | `300000` | |
| `DB_PATH` | no | `./data/racingshape.db` | |

`loadConfig` throws if `GITHUB_TOKEN` is missing **unless** `NODE_ENV==='test'` (tests inject a
fake). Numeric vars are parsed and validated (positive integers).

---

## 8. Database schema (canonical) — `api/src/db/schema.sql.ts`

`SCHEMA_SQL` is this exact DDL (idempotent; run on every boot):

```sql
CREATE TABLE IF NOT EXISTS racers (
  github_login TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT NOT NULL,
  first_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,   -- stable dedupe key, e.g. "commit:<sha>" / "pr_merged:<num>"
  racer_login TEXT NOT NULL,
  type        TEXT NOT NULL,      -- commit|pr_opened|pr_merged|issue_closed
  points      INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,      -- ISO UTC
  race_date   TEXT NOT NULL       -- YYYY-MM-DD America/New_York
);
CREATE INDEX IF NOT EXISTS idx_events_racedate ON events(race_date);
CREATE INDEX IF NOT EXISTS idx_events_racer    ON events(racer_login);

CREATE TABLE IF NOT EXISTS race_snapshots (
  race_date   TEXT NOT NULL,
  racer_login TEXT NOT NULL,
  score       INTEGER NOT NULL,
  captured_at TEXT NOT NULL,      -- ISO UTC
  PRIMARY KEY (race_date, racer_login, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_snap_racedate ON race_snapshots(race_date);

CREATE TABLE IF NOT EXISTS daily_stats (
  race_date     TEXT PRIMARY KEY,
  commits       INTEGER NOT NULL DEFAULT 0,
  prs_opened    INTEGER NOT NULL DEFAULT 0,
  prs_merged    INTEGER NOT NULL DEFAULT 0,
  issues_closed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reactions (
  id                 TEXT PRIMARY KEY,
  race_date          TEXT NOT NULL,
  target_racer_login TEXT NOT NULL,
  kind               TEXT NOT NULL,   -- 🔥|⚡|🏎️
  reactor            TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reactions_racedate ON reactions(race_date);

CREATE TABLE IF NOT EXISTS http_cache (
  url           TEXT PRIMARY KEY,
  etag          TEXT,
  last_modified TEXT,
  body          TEXT,
  fetched_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

**Event id scheme (dedupe):** `commit:<sha>`, `pr_opened:<pr_number>`, `pr_merged:<pr_number>`,
`issue_closed:<issue_number>`. Inserts use `INSERT OR IGNORE` so re-polling is idempotent.

---

## 9. Design tokens (canonical) — from the mockup, into `web/src/index.css`

Dark (default) and light token sets are copied verbatim from
`mockup-2-f1-broadcast.html` `:root` / `[data-theme="light"]` (DESIGN §7):

```
dark:  --bg #07090d  --bg2 #0d1016  --panel #11151c  --panel2 #161b24
       --ink #eef2f7  --muted #8a94a6  --line #222a36
       --accent #e10600  --accent2 #ff3b30  --cyan #15d6e0  --amber #ffb300
       --green #34d399  --grid #1a2029
light: --bg #eef1f5  --bg2 #e3e8ef  --panel #ffffff  --panel2 #f4f6fa
       --ink #0d1320  --muted #5b6678  --line #dde3ec
       --accent #e10600  --accent2 #c81e1e  --cyan #0891b2  --amber #d97706
       --green #059669  --grid #eceff4
```

Fonts: **Rajdhani** (headings/labels), **Chakra Petch** (numerals/telemetry), **Inter** (body) —
loaded via the same Google Fonts link as the mockup. Theme attribute lives on `<html data-theme>`,
persisted in `localStorage` key `racingshape-theme`.

Motion: car `transform`/`left` over ~1s `cubic-bezier(.4,.8,.3,1)`; bars grow on load; tooltip
120ms fade. Replay compresses a full day to ~15s.

---

## 10. Track auto-scale rule (canonical)

Position percentage for a car (matches mockup, DESIGN §4.2, risk note §10):

```
pct = 2 + (score / max(topScore, 1)) * 80      // clamp topScore floor to 1 to avoid /0
```

`topScore` is the day's highest score (or 1 if all zero). This keeps the leader near the front
(~82%), the pack on-screen, and an empty day idling at the 2% start line. The API returns
`topScore`; the web computes `pct` so it can re-tween smoothly.

---

## 11. Tooltip coverage (canonical) — DESIGN §6

Every element below must expose its breakdown via the single tooltip engine
(`web/src/lib/tooltip.tsx`). Format `HEADER||body`, body multi-line. Plans 03/04 must wire each:

timing-tower row · car pod/label · reaction count · boost button · DRS tag · chart bar ·
pit-wall tasks · pit-wall completion · pit-wall streak · podium step · superlative tile ·
finish line · LIVE/date/replay/theme controls. **No dead numbers** — a metric with no tooltip
is a bug, not a style nit.

---

## 12. Done definition (PRD §9 — the whole release passes when)

- [ ] Live race renders today's contributors as avatar cars positioned by weighted score,
      tweening between 60s polls.
- [ ] Race resets at NY midnight; prior day archived and replayable as a ~15s fast-forward.
- [ ] Activity chart shows commits/PRs/issues with working links to `S2AI/s2shape`.
- [ ] Sidebar shows total tasks, completion rate, streak.
- [ ] Dark mode toggles and persists.
- [ ] Runs unattended a week against the private repo (ETags + backoff hold rate limits).
- [ ] Clean, glanceable on a shared monitor in the F1 broadcast direction.
- [ ] Every displayed metric reveals its breakdown on hover (§11).
- [ ] Pit-stop boosts, Grand Prix recap (+PNG), and the three starter cosmetics ship.

---

## 13. Execution handoff

After all four phase plans exist and are reviewed, implement them **in order** with
`superpowers:subagent-driven-development` (fresh subagent per task, two-stage review) or
`superpowers:executing-plans` (inline, batched checkpoints). Do not start plan N+1 until plan
N's tests are green and committed.
