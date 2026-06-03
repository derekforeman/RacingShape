# RacingShape — Backend Core (Plan 01) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monorepo scaffold, the `@racingshape/shared` package (types + scoring), and the network-free core of `@racingshape/api` (config, SQLite schema/migrations, repositories, NY race-date logic, standings engine) — a fully tested core library with no Express and no GitHub calls.

**Architecture:** npm workspaces tie together `shared` (zero-dependency types + scoring) and `api`. `api` uses `better-sqlite3` (synchronous) behind thin repository functions, each tested against an in-memory database. Race-day keying is derived from the `America/New_York` calendar date via `Intl.DateTimeFormat` so it stays correct across the DST/EST flip. Standings are a pure function over breakdowns + racers.

**Tech Stack:** TypeScript, npm workspaces, Vitest, better-sqlite3, Express 5 (declared as a dep here but not used until plan 02), @octokit/rest (declared here, used in plan 02), ESLint (flat config) + Prettier. Node 26.

---

Part of the [build roadmap](2026-06-02-racingshape-roadmap.md) — build plans in order.

This is plan **01** of four. It depends on nothing and produces a tested core library. The roadmap is the canonical contract: every type name (§6), the scoring code (§5), the config interface (§7), the DB DDL (§8), and the file paths (§3) below are copied from it verbatim. If anything here disagrees with the roadmap, the roadmap wins.

**Conventions for every task (roadmap §4):**
- TDD: write failing test → run it (see it fail) → minimal code → run it (see it pass) → commit.
- Conventional Commits. **No Claude co-author line, no Claude Code links** (CLAUDE.md).
- Work on a branch off `dev`, e.g. `feat/backend-core`. Never commit to `master`.
- Test commands:
  - All: `npm test`
  - One workspace: `npm test -w @racingshape/api`
  - One file: `npm test -w @racingshape/api -- run api/test/time/raceDate.test.ts`
  - One test by name: append `-t "name substring"`.

---

## Task 1: Root monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create the root `package.json` with workspaces and top-level scripts**

```json
{
  "name": "racingshape",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=26"
  },
  "workspaces": [
    "shared",
    "api"
  ],
  "scripts": {
    "build": "npm run build -w @racingshape/shared && npm run build -w @racingshape/api",
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "dev": "npm run dev -w @racingshape/api"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "@types/node": "^22.7.0",
    "eslint": "^9.13.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.11.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `.nvmrc`**

```
26
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Create `eslint.config.js` (flat config, TypeScript)**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.tsbuildinfo', 'data/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
```

- [ ] **Step 5: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "semi": true
}
```

- [ ] **Step 6: Create `.env.example` (every var from roadmap §7)**

```
# RacingShape API configuration.
# Copy to .env and fill in. GITHUB_TOKEN is the only required var at runtime.

# API listen port (default 8787)
PORT=8787

# GitHub PAT or App token. REQUIRED at runtime. Server-side only — never sent to the browser.
GITHUB_TOKEN=

# Repository to track (defaults shown)
REPO_OWNER=S2AI
REPO_NAME=s2shape

# Poll cadence in ms (default 60000)
POLL_INTERVAL_MS=60000

# Snapshot/replay frame cadence in ms (default 300000 = 5 min)
SNAPSHOT_INTERVAL_MS=300000

# SQLite file path (default ./data/racingshape.db)
DB_PATH=./data/racingshape.db
```

- [ ] **Step 7: Extend `.gitignore`**

Append these lines to the existing `.gitignore` (keep what's already there):

```
# Node / build (plan 01 additions)
node_modules/
dist/
data/
.env
*.tsbuildinfo
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes without error; creates root `node_modules/` and `package-lock.json`. (Workspace child packages don't exist yet — that's fine, npm just installs root devDeps.)

- [ ] **Step 9: Verify lint runs on an empty tree**

Run: `npm run lint`
Expected: PASS (exit 0) with no files to report, or a clean run. If ESLint complains there are no files, that's acceptable at this stage.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .nvmrc tsconfig.base.json eslint.config.js .prettierrc.json .env.example .gitignore
git commit -m "chore: scaffold npm workspaces monorepo with lint/format/test tooling"
```

---

## Task 2: `@racingshape/shared` package — types + scoring

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/scoring.ts`
- Create: `shared/src/index.ts`
- Test: `shared/test/scoring.test.ts`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@racingshape/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `shared/src/types.ts` (COPY exact types from roadmap §6)**

```ts
export type EventType = 'commit' | 'pr_opened' | 'pr_merged' | 'issue_closed';
export type ReactionKind = '🔥' | '⚡' | '🏎️';
export type Cosmetic = 'flame_trail' | 'gold_rims' | 'rookie_decal';

export interface Racer {
  login: string; // github_login (pk)
  displayName: string;
  avatarUrl: string;
  firstSeen: string; // ISO UTC
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
  breakdown: ScoreBreakdown; // counts per event type (multiply by weights for points)
  position: number; // 1-based, ties share lower number then by login
  gapToLeader: number; // points behind P1; 0 for leader
  isLeader: boolean;
  topMover: boolean; // DRS: gained the most points on the latest poll
  reactions: ReactionSummary;
  cosmetics: Cosmetic[];
}

export interface RaceToday {
  raceDate: string; // YYYY-MM-DD (America/New_York)
  live: true;
  topScore: number; // for track auto-scale (>=1)
  standings: RacerStanding[]; // sorted by position
  lastPolledAt: string | null; // ISO UTC
}

export interface SnapshotFrame {
  capturedAt: string; // ISO UTC
  scores: { login: string; score: number }[];
}

export interface ArchivedReaction {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;
  createdAt: string; // ISO UTC
}

export interface PodiumStep {
  position: number; // 1..3
  login: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface Superlative {
  key: 'fastest_hour' | 'comeback' | 'midnight_grinder';
  title: string; // human label, e.g. "Fastest hour"
  login: string | null; // null if no data supports it
  detail: string; // e.g. "9 commits · 2–3pm"
}

export interface Recap {
  raceDate: string;
  podium: PodiumStep[]; // up to 3
  superlatives: Superlative[]; // exactly 3 (login may be null)
}

export interface RaceArchive {
  raceDate: string;
  live: false;
  topScore: number;
  standings: RacerStanding[]; // final standings for the day
  frames: SnapshotFrame[]; // ordered by capturedAt for replay
  reactions: ArchivedReaction[];
  recap: Recap;
}

export interface RaceListItem {
  raceDate: string;
  topScore: number;
  winnerLogin: string | null;
}

export interface ChartDay {
  raceDate: string; // YYYY-MM-DD
  commits: number;
  prsOpened: number;
  issuesClosed: number;
}

export interface TasksStat {
  total: number;
  issues: number;
  prs: number;
  deltaVsPriorWeek: number; // signed
}

export interface CompletionStat {
  rate: number; // 0..1
  closed: number;
  opened: number;
}

export interface StreakStat {
  current: number; // consecutive days with >=1 event, ending today
  startDate: string | null; // YYYY-MM-DD when current run began
  bestThisMonth: number;
}

export interface StatsResponse {
  range: string; // echo, e.g. "14d"
  repoUrl: string; // https://github.com/S2AI/s2shape
  chart: ChartDay[]; // ascending by date
  totalTasks: TasksStat;
  completion: CompletionStat;
  streak: StreakStat;
}

/** POST body for a pit-stop boost (plan 04). */
export interface CreateReactionBody {
  targetLogin: string;
  kind: ReactionKind;
  reactor: string; // who cheered (free-text handle for v1)
}

export interface CreateReactionResponse {
  ok: true;
  reactions: ReactionSummary; // updated count for the target
}
```

- [ ] **Step 4: Create `shared/src/scoring.ts` (COPY exact code from roadmap §5)**

```ts
import type { EventType, ScoreBreakdown } from './types.js';

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

> Note: the roadmap §5 snippet imports `from './types'`. Because this project uses `NodeNext` module resolution with `verbatimModuleSyntax`, relative imports must carry the `.js` extension — hence `./types.js`. Same applies to `index.ts` below. This is the only deviation from the verbatim snippet and it is required to compile.

- [ ] **Step 5: Create `shared/src/index.ts` (re-export)**

```ts
export * from './types.js';
export * from './scoring.js';
```

- [ ] **Step 6: Write the failing test `shared/test/scoring.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  pointsFor,
  scoreFromBreakdown,
  EMPTY_BREAKDOWN,
  SCORE_WEIGHTS,
} from '../src/index.js';
import type { ScoreBreakdown } from '../src/index.js';

describe('SCORE_WEIGHTS', () => {
  it('uses the canonical weights from PRD §4', () => {
    expect(SCORE_WEIGHTS).toEqual({
      commit: 1,
      pr_opened: 5,
      pr_merged: 8,
      issue_closed: 3,
    });
  });
});

describe('pointsFor', () => {
  it('returns the weight for each event type', () => {
    expect(pointsFor('commit')).toBe(1);
    expect(pointsFor('pr_opened')).toBe(5);
    expect(pointsFor('pr_merged')).toBe(8);
    expect(pointsFor('issue_closed')).toBe(3);
  });
});

describe('EMPTY_BREAKDOWN', () => {
  it('is all zeros', () => {
    expect(EMPTY_BREAKDOWN).toEqual({
      commit: 0,
      pr_opened: 0,
      pr_merged: 0,
      issue_closed: 0,
    });
  });

  it('scores to zero', () => {
    expect(scoreFromBreakdown(EMPTY_BREAKDOWN)).toBe(0);
  });
});

describe('scoreFromBreakdown', () => {
  it('multiplies each count by its weight and sums', () => {
    const b: ScoreBreakdown = {
      commit: 3, // 3
      pr_opened: 2, // 10
      pr_merged: 1, // 8
      issue_closed: 4, // 12
    };
    expect(scoreFromBreakdown(b)).toBe(3 + 10 + 8 + 12);
  });

  it('handles a single commit', () => {
    expect(scoreFromBreakdown({ commit: 1, pr_opened: 0, pr_merged: 0, issue_closed: 0 })).toBe(1);
  });

  it('handles a single merged PR', () => {
    expect(scoreFromBreakdown({ commit: 0, pr_opened: 0, pr_merged: 1, issue_closed: 0 })).toBe(8);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm install` (to link the new workspace), then `npm test -w @racingshape/shared`
Expected: FAIL — Vitest cannot resolve `../src/index.js` / the module isn't built yet, or the test fails to import. (If it errors on missing `vitest` config, that's the failure; we wire it next.) The key signal: the test does not pass.

> If the failure is purely "no test files found" because Vitest isn't picking up `shared/test`, that still counts as red. The next step makes the source resolvable and the test green.

- [ ] **Step 8: Confirm source files compile**

Run: `npm run build -w @racingshape/shared`
Expected: PASS — produces `shared/dist/index.js`, `shared/dist/types.js`, `shared/dist/scoring.js` and matching `.d.ts`. This proves the COPIED source from steps 3–5 compiles.

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -w @racingshape/shared`
Expected: PASS — all assertions green. (Vitest runs the `.ts` source directly; the `.js` extension in imports resolves to the `.ts` files under Vitest's resolver.)

- [ ] **Step 10: Commit**

```bash
git add shared/package.json shared/tsconfig.json shared/src shared/test package-lock.json
git commit -m "feat: add @racingshape/shared with canonical types and scoring engine"
```

---

## Task 3: `@racingshape/api` package skeleton

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`

- [ ] **Step 1: Create `api/package.json`**

```json
{
  "name": "@racingshape/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@octokit/rest": "^21.0.2",
    "@racingshape/shared": "*",
    "better-sqlite3": "^11.3.0",
    "express": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/express": "^5.0.0",
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `api/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install dependencies and link the workspace**

Run: `npm install`
Expected: PASS — installs express, better-sqlite3 (compiles its native binding), @octokit/rest, tsx, type packages; symlinks `@racingshape/shared` into `api/node_modules`. `better-sqlite3` must build; if it fails, the native toolchain is missing — resolve that before proceeding (root-cause it, don't retry blindly).

- [ ] **Step 4: Verify the api workspace resolves the shared package**

Run: `node -e "import('@racingshape/shared').then(m => console.log(typeof m.scoreFromBreakdown))" --input-type=module`
Expected: prints `function`. (Requires `shared/dist` from Task 2 step 8. If it errors, run `npm run build -w @racingshape/shared` first.)

- [ ] **Step 5: Commit**

```bash
git add api/package.json api/tsconfig.json package-lock.json
git commit -m "chore: add @racingshape/api package skeleton with deps"
```

---

## Task 4: `api/src/config.ts` — AppConfig + loadConfig

**Files:**
- Create: `api/src/config.ts`
- Test: `api/test/config.test.ts`

- [ ] **Step 1: Write the failing test `api/test/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseTestEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
});

describe('loadConfig', () => {
  it('applies defaults when only required vars are present (test mode)', () => {
    const cfg = loadConfig(baseTestEnv());
    expect(cfg.port).toBe(8787);
    expect(cfg.repoOwner).toBe('S2AI');
    expect(cfg.repoName).toBe('s2shape');
    expect(cfg.pollIntervalMs).toBe(60_000);
    expect(cfg.snapshotIntervalMs).toBe(300_000);
    expect(cfg.dbPath).toBe('./data/racingshape.db');
  });

  it('reads an empty token in test mode without throwing', () => {
    const cfg = loadConfig(baseTestEnv());
    expect(cfg.githubToken).toBe('');
  });

  it('honors overrides for every var', () => {
    const cfg = loadConfig({
      NODE_ENV: 'test',
      PORT: '9000',
      GITHUB_TOKEN: 'tok_123',
      REPO_OWNER: 'acme',
      REPO_NAME: 'widgets',
      POLL_INTERVAL_MS: '30000',
      SNAPSHOT_INTERVAL_MS: '120000',
      DB_PATH: '/tmp/rs.db',
    });
    expect(cfg.port).toBe(9000);
    expect(cfg.githubToken).toBe('tok_123');
    expect(cfg.repoOwner).toBe('acme');
    expect(cfg.repoName).toBe('widgets');
    expect(cfg.pollIntervalMs).toBe(30_000);
    expect(cfg.snapshotIntervalMs).toBe(120_000);
    expect(cfg.dbPath).toBe('/tmp/rs.db');
  });

  it('throws when GITHUB_TOKEN is missing outside test mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/GITHUB_TOKEN/);
  });

  it('does not throw outside test mode when GITHUB_TOKEN is present', () => {
    const cfg = loadConfig({ NODE_ENV: 'production', GITHUB_TOKEN: 'tok' });
    expect(cfg.githubToken).toBe('tok');
  });

  it('throws on a non-numeric PORT', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', PORT: 'abc' })).toThrow(/PORT/);
  });

  it('throws on a zero or negative interval', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', POLL_INTERVAL_MS: '0' })).toThrow(
      /POLL_INTERVAL_MS/,
    );
    expect(() => loadConfig({ NODE_ENV: 'test', SNAPSHOT_INTERVAL_MS: '-5' })).toThrow(
      /SNAPSHOT_INTERVAL_MS/,
    );
  });

  it('throws on a fractional numeric var', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', PORT: '80.5' })).toThrow(/PORT/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/config.test.ts`
Expected: FAIL — cannot resolve `../src/config.js` (module does not exist).

- [ ] **Step 3: Write the implementation `api/src/config.ts`**

```ts
export interface AppConfig {
  port: number;
  githubToken: string;
  repoOwner: string; // "S2AI"
  repoName: string; // "s2shape"
  pollIntervalMs: number; // default 60_000
  snapshotIntervalMs: number; // default 300_000 (5 min) — replay frame cadence
  dbPath: string; // default "./data/racingshape.db"
}

/** Parse a positive integer env var; throw a clear error naming the var on failure. */
function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${name}: "${raw}" is not a positive integer`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: "${raw}" must be a positive integer`);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const isTest = env.NODE_ENV === 'test';
  const githubToken = env.GITHUB_TOKEN ?? '';
  if (!githubToken && !isTest) {
    throw new Error('Missing required env var GITHUB_TOKEN');
  }

  return {
    port: parsePositiveInt('PORT', env.PORT, 8787),
    githubToken,
    repoOwner: env.REPO_OWNER && env.REPO_OWNER !== '' ? env.REPO_OWNER : 'S2AI',
    repoName: env.REPO_NAME && env.REPO_NAME !== '' ? env.REPO_NAME : 's2shape',
    pollIntervalMs: parsePositiveInt('POLL_INTERVAL_MS', env.POLL_INTERVAL_MS, 60_000),
    snapshotIntervalMs: parsePositiveInt(
      'SNAPSHOT_INTERVAL_MS',
      env.SNAPSHOT_INTERVAL_MS,
      300_000,
    ),
    dbPath: env.DB_PATH && env.DB_PATH !== '' ? env.DB_PATH : './data/racingshape.db',
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/config.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add api/src/config.ts api/test/config.test.ts
git commit -m "feat: add api config loader with validation and test-mode token bypass"
```

---

## Task 5: SQLite schema, connection, and migrations

**Files:**
- Create: `api/src/db/schema.sql.ts`
- Create: `api/src/db/connection.ts`
- Create: `api/src/db/migrate.ts`
- Test: `api/test/db/migrate.test.ts`

- [ ] **Step 1: Create `api/src/db/schema.sql.ts` (exact DDL from roadmap §8)**

```ts
/** Canonical schema (roadmap §8). Idempotent; safe to run on every boot. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS racers (
  github_login TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT NOT NULL,
  first_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  racer_login TEXT NOT NULL,
  type        TEXT NOT NULL,
  points      INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  race_date   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_racedate ON events(race_date);
CREATE INDEX IF NOT EXISTS idx_events_racer    ON events(racer_login);

CREATE TABLE IF NOT EXISTS race_snapshots (
  race_date   TEXT NOT NULL,
  racer_login TEXT NOT NULL,
  score       INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
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
  kind               TEXT NOT NULL,
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
`;
```

- [ ] **Step 2: Create `api/src/db/connection.ts`**

```ts
import Database from 'better-sqlite3';

export type Db = Database.Database;

/**
 * Open a better-sqlite3 database with the pragmas RacingShape relies on:
 * - WAL for concurrent read while the poller writes.
 * - foreign_keys ON for referential safety.
 * Pass ':memory:' for tests.
 */
export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
```

- [ ] **Step 3: Create `api/src/db/migrate.ts`**

```ts
import type { Db } from './connection.js';
import { SCHEMA_SQL } from './schema.sql.js';

/** Apply the canonical schema. Idempotent — safe to call on every boot. */
export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);
}
```

- [ ] **Step 4: Write the failing test `api/test/db/migrate.test.ts`**

```ts
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
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/db/migrate.test.ts`
Expected: FAIL — cannot resolve `../../src/db/connection.js` / `migrate.js` (modules just created should exist; if you run before creating them it fails to import). If steps 1–3 are already in place, this should instead PASS — in that case revert nothing; the red→green here is driven by ordering. To see red deliberately, you may stash the three source files, observe FAIL, then restore them.

> Practical note: because schema/connection/migrate are pure plumbing, the honest TDD red is "import fails." If the source files already exist when you run, accept the PASS and move to commit — do not fabricate a failure.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/db/migrate.test.ts`
Expected: PASS — all three tests green.

- [ ] **Step 7: Commit**

```bash
git add api/src/db/schema.sql.ts api/src/db/connection.ts api/src/db/migrate.ts api/test/db/migrate.test.ts
git commit -m "feat: add sqlite schema, connection with pragmas, and idempotent migrate"
```

---

## Task 6: Repositories

All repositories take a `Db` and are tested against `openDb(':memory:')` + `migrate(db)`. Build them one sub-step group at a time, each with its own test and commit.

**Files:**
- Create: `api/src/db/repositories/racers.ts`
- Create: `api/src/db/repositories/events.ts`
- Create: `api/src/db/repositories/snapshots.ts`
- Create: `api/src/db/repositories/reactions.ts`
- Create: `api/src/db/repositories/dailyStats.ts`
- Create: `api/src/db/repositories/httpCache.ts`
- Create: `api/src/db/repositories/pollMeta.ts`
- Test: `api/test/db/repositories/racers.test.ts`
- Test: `api/test/db/repositories/events.test.ts`
- Test: `api/test/db/repositories/snapshots.test.ts`
- Test: `api/test/db/repositories/reactions.test.ts`
- Test: `api/test/db/repositories/dailyStats.test.ts`
- Test: `api/test/db/repositories/httpCache.test.ts`
- Test: `api/test/db/repositories/pollMeta.test.ts`

### 6a — racers

- [ ] **Step 1: Write the failing test `api/test/db/repositories/racers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { upsertRacer, getRacer, listRacers } from '../../../src/db/repositories/racers.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('racers repository', () => {
  it('inserts and reads a racer', () => {
    const db = freshDb();
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/devon.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
    const r = getRacer(db, 'devon-r');
    expect(r).toEqual({
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/devon.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
  });

  it('returns undefined for an unknown login', () => {
    const db = freshDb();
    expect(getRacer(db, 'nobody')).toBeUndefined();
  });

  it('upsert updates mutable fields but preserves firstSeen', () => {
    const db = freshDb();
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/old.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon Rodriguez',
      avatarUrl: 'https://a/new.png',
      firstSeen: '2026-06-03T09:00:00.000Z', // later first_seen should be ignored
    });
    const r = getRacer(db, 'devon-r');
    expect(r?.displayName).toBe('Devon Rodriguez');
    expect(r?.avatarUrl).toBe('https://a/new.png');
    expect(r?.firstSeen).toBe('2026-06-02T10:00:00.000Z');
  });

  it('lists racers ordered by login ascending', () => {
    const db = freshDb();
    upsertRacer(db, { login: 'zoe', displayName: 'Zoe', avatarUrl: 'z', firstSeen: 't' });
    upsertRacer(db, { login: 'amy', displayName: 'Amy', avatarUrl: 'a', firstSeen: 't' });
    const logins = listRacers(db).map((r) => r.login);
    expect(logins).toEqual(['amy', 'zoe']);
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../racers.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/racers.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/racers.ts`**

```ts
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
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/racers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/racers.ts api/test/db/repositories/racers.test.ts
git commit -m "feat: add racers repository (upsert/get/list)"
```

### 6b — events

- [ ] **Step 1: Write the failing test `api/test/db/repositories/events.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertEventsIgnore,
  breakdownByRacer,
  countsForRange,
  type EventRow,
} from '../../../src/db/repositories/events.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const ev = (over: Partial<EventRow>): EventRow => ({
  id: 'commit:abc',
  racerLogin: 'devon-r',
  type: 'commit',
  points: 1,
  occurredAt: '2026-06-02T12:00:00.000Z',
  raceDate: '2026-06-02',
  ...over,
});

describe('events repository', () => {
  it('inserts events', () => {
    const db = freshDb();
    insertEventsIgnore(db, [ev({ id: 'commit:1' }), ev({ id: 'commit:2' })]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')?.commit).toBe(2);
  });

  it('dedupes on id via INSERT OR IGNORE (re-poll is idempotent)', () => {
    const db = freshDb();
    insertEventsIgnore(db, [ev({ id: 'commit:1' })]);
    insertEventsIgnore(db, [ev({ id: 'commit:1' }), ev({ id: 'commit:2' })]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')?.commit).toBe(2); // not 3
  });

  it('breakdownByRacer counts each type per racer for the given race_date', () => {
    const db = freshDb();
    insertEventsIgnore(db, [
      ev({ id: 'commit:1', type: 'commit', points: 1 }),
      ev({ id: 'commit:2', type: 'commit', points: 1 }),
      ev({ id: 'pr_opened:10', type: 'pr_opened', points: 5 }),
      ev({ id: 'pr_merged:10', type: 'pr_merged', points: 8 }),
      ev({ id: 'issue_closed:7', type: 'issue_closed', points: 3 }),
      ev({ id: 'commit:3', type: 'commit', points: 1, racerLogin: 'amy' }),
      // different day — excluded
      ev({ id: 'commit:9', type: 'commit', points: 1, raceDate: '2026-06-01' }),
    ]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')).toEqual({
      commit: 2,
      pr_opened: 1,
      pr_merged: 1,
      issue_closed: 1,
    });
    expect(map.get('amy')).toEqual({
      commit: 1,
      pr_opened: 0,
      pr_merged: 0,
      issue_closed: 0,
    });
    expect(map.has('commit:9')).toBe(false);
  });

  it('returns an empty map for a day with no events', () => {
    const db = freshDb();
    expect(breakdownByRacer(db, '2026-06-02').size).toBe(0);
  });

  it('countsForRange aggregates per type across the inclusive date range', () => {
    const db = freshDb();
    insertEventsIgnore(db, [
      ev({ id: 'commit:1', type: 'commit', raceDate: '2026-06-01' }),
      ev({ id: 'pr_opened:1', type: 'pr_opened', raceDate: '2026-06-02' }),
      ev({ id: 'pr_merged:1', type: 'pr_merged', raceDate: '2026-06-02' }),
      ev({ id: 'issue_closed:1', type: 'issue_closed', raceDate: '2026-06-03' }),
      ev({ id: 'commit:99', type: 'commit', raceDate: '2026-05-31' }), // out of range
    ]);
    const counts = countsForRange(db, '2026-06-01', '2026-06-03');
    expect(counts).toEqual({
      commit: 1,
      pr_opened: 1,
      pr_merged: 1,
      issue_closed: 1,
    });
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../events.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/events.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/events.ts`**

```ts
import type { EventType, ScoreBreakdown } from '@racingshape/shared';
import { EMPTY_BREAKDOWN } from '@racingshape/shared';
import type { Db } from '../connection.js';

export interface EventRow {
  id: string;
  racerLogin: string;
  type: EventType;
  points: number;
  occurredAt: string; // ISO UTC
  raceDate: string; // YYYY-MM-DD (NY)
}

/** Insert events, ignoring duplicates by primary-key id. Idempotent re-poll. */
export function insertEventsIgnore(db: Db, events: EventRow[]): void {
  if (events.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO events (id, racer_login, type, points, occurred_at, race_date)
     VALUES (@id, @racerLogin, @type, @points, @occurredAt, @raceDate)`,
  );
  const insertMany = db.transaction((rows: EventRow[]) => {
    for (const r of rows) stmt.run(r);
  });
  insertMany(events);
}

/** Per-racer count of each event type for a single race_date. */
export function breakdownByRacer(db: Db, raceDate: string): Map<string, ScoreBreakdown> {
  const rows = db
    .prepare(
      `SELECT racer_login AS login, type, COUNT(*) AS n
       FROM events
       WHERE race_date = ?
       GROUP BY racer_login, type`,
    )
    .all(raceDate) as { login: string; type: EventType; n: number }[];

  const map = new Map<string, ScoreBreakdown>();
  for (const row of rows) {
    let b = map.get(row.login);
    if (!b) {
      b = { ...EMPTY_BREAKDOWN };
      map.set(row.login, b);
    }
    b[row.type] = row.n;
  }
  return map;
}

/** Aggregate count per event type across an inclusive [start, end] date range. */
export function countsForRange(db: Db, start: string, end: string): ScoreBreakdown {
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS n
       FROM events
       WHERE race_date >= ? AND race_date <= ?
       GROUP BY type`,
    )
    .all(start, end) as { type: EventType; n: number }[];

  const out: ScoreBreakdown = { ...EMPTY_BREAKDOWN };
  for (const row of rows) {
    out[row.type] = row.n;
  }
  return out;
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/events.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/events.ts api/test/db/repositories/events.test.ts
git commit -m "feat: add events repository (insert-ignore dedupe, breakdown, range counts)"
```

### 6c — snapshots

- [ ] **Step 1: Write the failing test `api/test/db/repositories/snapshots.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertSnapshot,
  framesForDate,
  latestScores,
} from '../../../src/db/repositories/snapshots.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('snapshots repository', () => {
  it('groups rows into frames ordered by capturedAt', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 3, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 9, '2026-06-02T12:05:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 7, '2026-06-02T12:05:00.000Z');

    const frames = framesForDate(db, '2026-06-02');
    expect(frames).toEqual([
      {
        capturedAt: '2026-06-02T12:00:00.000Z',
        scores: [
          { login: 'amy', score: 3 },
          { login: 'devon-r', score: 5 },
        ],
      },
      {
        capturedAt: '2026-06-02T12:05:00.000Z',
        scores: [
          { login: 'amy', score: 7 },
          { login: 'devon-r', score: 9 },
        ],
      },
    ]);
  });

  it('insertSnapshot is idempotent on (race_date, login, captured_at)', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    const frames = framesForDate(db, '2026-06-02');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.scores).toHaveLength(1);
  });

  it('latestScores returns each racer score from the most recent frame', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 3, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 9, '2026-06-02T12:05:00.000Z');
    const latest = latestScores(db, '2026-06-02');
    expect(latest.get('devon-r')).toBe(9);
    // amy not in the latest frame -> absent
    expect(latest.has('amy')).toBe(false);
  });

  it('returns empties for an unknown date', () => {
    const db = freshDb();
    expect(framesForDate(db, '2099-01-01')).toEqual([]);
    expect(latestScores(db, '2099-01-01').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../snapshots.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/snapshots.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/snapshots.ts`**

```ts
import type { SnapshotFrame } from '@racingshape/shared';
import type { Db } from '../connection.js';

export function insertSnapshot(
  db: Db,
  raceDate: string,
  login: string,
  score: number,
  capturedAt: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO race_snapshots (race_date, racer_login, score, captured_at)
     VALUES (?, ?, ?, ?)`,
  ).run(raceDate, login, score, capturedAt);
}

/** All snapshot frames for a day, ordered by capturedAt asc; scores within a frame by login asc. */
export function framesForDate(db: Db, raceDate: string): SnapshotFrame[] {
  const rows = db
    .prepare(
      `SELECT captured_at AS capturedAt, racer_login AS login, score
       FROM race_snapshots
       WHERE race_date = ?
       ORDER BY captured_at ASC, racer_login ASC`,
    )
    .all(raceDate) as { capturedAt: string; login: string; score: number }[];

  const frames: SnapshotFrame[] = [];
  let current: SnapshotFrame | undefined;
  for (const row of rows) {
    if (!current || current.capturedAt !== row.capturedAt) {
      current = { capturedAt: row.capturedAt, scores: [] };
      frames.push(current);
    }
    current.scores.push({ login: row.login, score: row.score });
  }
  return frames;
}

/** Scores from the most recent frame for the day, keyed by login. */
export function latestScores(db: Db, raceDate: string): Map<string, number> {
  const latest = db
    .prepare(
      `SELECT MAX(captured_at) AS capturedAt FROM race_snapshots WHERE race_date = ?`,
    )
    .get(raceDate) as { capturedAt: string | null } | undefined;

  const map = new Map<string, number>();
  if (!latest || latest.capturedAt === null) return map;

  const rows = db
    .prepare(
      `SELECT racer_login AS login, score
       FROM race_snapshots
       WHERE race_date = ? AND captured_at = ?`,
    )
    .all(raceDate, latest.capturedAt) as { login: string; score: number }[];

  for (const row of rows) map.set(row.login, row.score);
  return map;
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/snapshots.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/snapshots.ts api/test/db/repositories/snapshots.test.ts
git commit -m "feat: add snapshots repository (insert, frames, latest scores)"
```

### 6d — reactions

- [ ] **Step 1: Write the failing test `api/test/db/repositories/reactions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertReaction,
  summaryForDate,
  listForDate,
  type ReactionRow,
} from '../../../src/db/repositories/reactions.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const react = (over: Partial<ReactionRow>): ReactionRow => ({
  id: 'r1',
  raceDate: '2026-06-02',
  targetLogin: 'devon-r',
  kind: '🔥',
  reactor: 'amy',
  createdAt: '2026-06-02T12:00:00.000Z',
  ...over,
});

describe('reactions repository', () => {
  it('summaryForDate totals reactions for a target and breaks down by kind', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r1', kind: '🔥' }));
    insertReaction(db, react({ id: 'r2', kind: '🔥' }));
    insertReaction(db, react({ id: 'r3', kind: '⚡' }));
    insertReaction(db, react({ id: 'r4', kind: '🏎️' }));
    // a reaction for a different target should not count
    insertReaction(db, react({ id: 'r5', targetLogin: 'amy', kind: '🔥' }));

    const summary = summaryForDate(db, '2026-06-02', 'devon-r');
    expect(summary).toEqual({
      total: 4,
      byKind: { '🔥': 2, '⚡': 1, '🏎️': 1 },
    });
  });

  it('returns a zeroed summary when there are no reactions', () => {
    const db = freshDb();
    expect(summaryForDate(db, '2026-06-02', 'devon-r')).toEqual({
      total: 0,
      byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 },
    });
  });

  it('insertReaction is idempotent on id', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r1' }));
    insertReaction(db, react({ id: 'r1' }));
    expect(summaryForDate(db, '2026-06-02', 'devon-r').total).toBe(1);
  });

  it('listForDate returns archived reactions ordered by createdAt asc', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r2', createdAt: '2026-06-02T13:00:00.000Z' }));
    insertReaction(db, react({ id: 'r1', createdAt: '2026-06-02T12:00:00.000Z' }));
    const list = listForDate(db, '2026-06-02');
    expect(list).toEqual([
      {
        targetLogin: 'devon-r',
        kind: '🔥',
        reactor: 'amy',
        createdAt: '2026-06-02T12:00:00.000Z',
      },
      {
        targetLogin: 'devon-r',
        kind: '🔥',
        reactor: 'amy',
        createdAt: '2026-06-02T13:00:00.000Z',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../reactions.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/reactions.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/reactions.ts`**

```ts
import type { ArchivedReaction, ReactionKind, ReactionSummary } from '@racingshape/shared';
import type { Db } from '../connection.js';

export interface ReactionRow {
  id: string;
  raceDate: string;
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;
  createdAt: string; // ISO UTC
}

const ZERO_BY_KIND = (): Record<ReactionKind, number> => ({ '🔥': 0, '⚡': 0, '🏎️': 0 });

export function insertReaction(db: Db, r: ReactionRow): void {
  db.prepare(
    `INSERT OR IGNORE INTO reactions (id, race_date, target_racer_login, kind, reactor, created_at)
     VALUES (@id, @raceDate, @targetLogin, @kind, @reactor, @createdAt)`,
  ).run(r);
}

/** Reaction totals + per-kind breakdown for one target on one day. */
export function summaryForDate(db: Db, raceDate: string, targetLogin: string): ReactionSummary {
  const rows = db
    .prepare(
      `SELECT kind, COUNT(*) AS n
       FROM reactions
       WHERE race_date = ? AND target_racer_login = ?
       GROUP BY kind`,
    )
    .all(raceDate, targetLogin) as { kind: ReactionKind; n: number }[];

  const byKind = ZERO_BY_KIND();
  let total = 0;
  for (const row of rows) {
    byKind[row.kind] = row.n;
    total += row.n;
  }
  return { total, byKind };
}

/** All reactions for a day, ordered by createdAt asc (for archive/replay). */
export function listForDate(db: Db, raceDate: string): ArchivedReaction[] {
  const rows = db
    .prepare(
      `SELECT target_racer_login AS targetLogin, kind, reactor, created_at AS createdAt
       FROM reactions
       WHERE race_date = ?
       ORDER BY created_at ASC`,
    )
    .all(raceDate) as ArchivedReaction[];
  return rows;
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/reactions.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/reactions.ts api/test/db/repositories/reactions.test.ts
git commit -m "feat: add reactions repository (insert, per-target summary, archive list)"
```

### 6e — dailyStats

- [ ] **Step 1: Write the failing test `api/test/db/repositories/dailyStats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  upsertDailyStats,
  getRange,
  type DailyStatsRow,
} from '../../../src/db/repositories/dailyStats.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const row = (over: Partial<DailyStatsRow>): DailyStatsRow => ({
  raceDate: '2026-06-02',
  commits: 0,
  prsOpened: 0,
  prsMerged: 0,
  issuesClosed: 0,
  ...over,
});

describe('dailyStats repository', () => {
  it('inserts and reads back a row in range', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 5, prsOpened: 2 }));
    const range = getRange(db, '2026-06-01', '2026-06-03');
    expect(range).toEqual([
      { raceDate: '2026-06-02', commits: 5, prsOpened: 2, prsMerged: 0, issuesClosed: 0 },
    ]);
  });

  it('upsert overwrites an existing day', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 5 }));
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 9, prsMerged: 1 }));
    const range = getRange(db, '2026-06-02', '2026-06-02');
    expect(range[0]).toEqual({
      raceDate: '2026-06-02',
      commits: 9,
      prsOpened: 0,
      prsMerged: 1,
      issuesClosed: 0,
    });
  });

  it('getRange returns rows ordered by date ascending and respects bounds', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-03', commits: 3 }));
    upsertDailyStats(db, row({ raceDate: '2026-06-01', commits: 1 }));
    upsertDailyStats(db, row({ raceDate: '2026-05-31', commits: 99 })); // out of range
    const dates = getRange(db, '2026-06-01', '2026-06-03').map((r) => r.raceDate);
    expect(dates).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('returns an empty array for an empty range', () => {
    const db = freshDb();
    expect(getRange(db, '2026-06-01', '2026-06-03')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../dailyStats.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/dailyStats.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/dailyStats.ts`**

```ts
import type { Db } from '../connection.js';

export interface DailyStatsRow {
  raceDate: string;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  issuesClosed: number;
}

interface DbRow {
  race_date: string;
  commits: number;
  prs_opened: number;
  prs_merged: number;
  issues_closed: number;
}

function toRow(r: DbRow): DailyStatsRow {
  return {
    raceDate: r.race_date,
    commits: r.commits,
    prsOpened: r.prs_opened,
    prsMerged: r.prs_merged,
    issuesClosed: r.issues_closed,
  };
}

/** Insert or replace the aggregate counts for a day. */
export function upsertDailyStats(db: Db, row: DailyStatsRow): void {
  db.prepare(
    `INSERT INTO daily_stats (race_date, commits, prs_opened, prs_merged, issues_closed)
     VALUES (@raceDate, @commits, @prsOpened, @prsMerged, @issuesClosed)
     ON CONFLICT(race_date) DO UPDATE SET
       commits       = excluded.commits,
       prs_opened    = excluded.prs_opened,
       prs_merged    = excluded.prs_merged,
       issues_closed = excluded.issues_closed`,
  ).run(row);
}

/** Daily stats rows for an inclusive [start, end] date range, ascending by date. */
export function getRange(db: Db, start: string, end: string): DailyStatsRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM daily_stats
       WHERE race_date >= ? AND race_date <= ?
       ORDER BY race_date ASC`,
    )
    .all(start, end) as DbRow[];
  return rows.map(toRow);
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/dailyStats.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/dailyStats.ts api/test/db/repositories/dailyStats.test.ts
git commit -m "feat: add dailyStats repository (upsert, ranged read)"
```

### 6f — httpCache

- [ ] **Step 1: Write the failing test `api/test/db/repositories/httpCache.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { get, put, type HttpCacheRow } from '../../../src/db/repositories/httpCache.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('httpCache repository', () => {
  it('returns undefined for an uncached url', () => {
    const db = freshDb();
    expect(get(db, 'https://api.github.com/x')).toBeUndefined();
  });

  it('stores and retrieves a cache entry by url', () => {
    const db = freshDb();
    const entry: HttpCacheRow = {
      url: 'https://api.github.com/x',
      etag: 'W/"abc"',
      lastModified: 'Wed, 02 Jun 2026 12:00:00 GMT',
      body: '[{"sha":"1"}]',
      fetchedAt: '2026-06-02T12:00:00.000Z',
    };
    put(db, entry);
    expect(get(db, 'https://api.github.com/x')).toEqual(entry);
  });

  it('put overwrites the existing entry for a url', () => {
    const db = freshDb();
    put(db, {
      url: 'u',
      etag: 'e1',
      lastModified: null,
      body: 'b1',
      fetchedAt: '2026-06-02T12:00:00.000Z',
    });
    put(db, {
      url: 'u',
      etag: 'e2',
      lastModified: null,
      body: 'b2',
      fetchedAt: '2026-06-02T12:05:00.000Z',
    });
    expect(get(db, 'u')).toEqual({
      url: 'u',
      etag: 'e2',
      lastModified: null,
      body: 'b2',
      fetchedAt: '2026-06-02T12:05:00.000Z',
    });
  });

  it('allows null etag/lastModified/body', () => {
    const db = freshDb();
    put(db, { url: 'u2', etag: null, lastModified: null, body: null, fetchedAt: 't' });
    expect(get(db, 'u2')).toEqual({
      url: 'u2',
      etag: null,
      lastModified: null,
      body: null,
      fetchedAt: 't',
    });
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../httpCache.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/httpCache.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/httpCache.ts`**

```ts
import type { Db } from '../connection.js';

export interface HttpCacheRow {
  url: string;
  etag: string | null;
  lastModified: string | null;
  body: string | null;
  fetchedAt: string; // ISO UTC
}

interface DbRow {
  url: string;
  etag: string | null;
  last_modified: string | null;
  body: string | null;
  fetched_at: string;
}

export function get(db: Db, url: string): HttpCacheRow | undefined {
  const row = db.prepare('SELECT * FROM http_cache WHERE url = ?').get(url) as
    | DbRow
    | undefined;
  if (!row) return undefined;
  return {
    url: row.url,
    etag: row.etag,
    lastModified: row.last_modified,
    body: row.body,
    fetchedAt: row.fetched_at,
  };
}

export function put(db: Db, row: HttpCacheRow): void {
  db.prepare(
    `INSERT INTO http_cache (url, etag, last_modified, body, fetched_at)
     VALUES (@url, @etag, @lastModified, @body, @fetchedAt)
     ON CONFLICT(url) DO UPDATE SET
       etag          = excluded.etag,
       last_modified = excluded.last_modified,
       body          = excluded.body,
       fetched_at    = excluded.fetched_at`,
  ).run(row);
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/httpCache.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/httpCache.ts api/test/db/repositories/httpCache.test.ts
git commit -m "feat: add httpCache repository for conditional-request caching"
```

### 6g — pollMeta

- [ ] **Step 1: Write the failing test `api/test/db/repositories/pollMeta.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { getMeta, setMeta } from '../../../src/db/repositories/pollMeta.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('pollMeta repository', () => {
  it('returns undefined for an unknown key', () => {
    const db = freshDb();
    expect(getMeta(db, 'lastPolledAt')).toBeUndefined();
  });

  it('sets and gets a string value', () => {
    const db = freshDb();
    setMeta(db, 'lastPolledAt', '2026-06-02T12:00:00.000Z');
    expect(getMeta(db, 'lastPolledAt')).toBe('2026-06-02T12:00:00.000Z');
  });

  it('setMeta overwrites an existing key', () => {
    const db = freshDb();
    setMeta(db, 'k', 'one');
    setMeta(db, 'k', 'two');
    expect(getMeta(db, 'k')).toBe('two');
  });
});
```

- [ ] **Step 2: Run it — Expected FAIL** (`Cannot find module .../pollMeta.js`)

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/pollMeta.test.ts`

- [ ] **Step 3: Write `api/src/db/repositories/pollMeta.ts`**

```ts
import type { Db } from '../connection.js';

export function getMeta(db: Db, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM poll_meta WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined;
  if (!row || row.value === null) return undefined;
  return row.value;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO poll_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}
```

- [ ] **Step 4: Run it — Expected PASS**

Run: `npm test -w @racingshape/api -- run api/test/db/repositories/pollMeta.test.ts`

- [ ] **Step 5: Commit**

```bash
git add api/src/db/repositories/pollMeta.ts api/test/db/repositories/pollMeta.test.ts
git commit -m "feat: add pollMeta repository (string key/value store)"
```

---

## Task 7: NY race-date logic (PRD-critical risk)

This is the DST/EST day-boundary risk called out in PRD §8 and CLAUDE.md. Key on the
`America/New_York` *calendar date*, never a hardcoded UTC offset. Be thorough.

> 💡 `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })` formats a `Date` in NY local time; `en-CA` yields ISO-style `YYYY-MM-DD`, so the date parts come out already in the format we store as `race_date`.

**Files:**
- Create: `api/src/time/raceDate.ts`
- Test: `api/test/time/raceDate.test.ts`

- [ ] **Step 1: Write the failing test `api/test/time/raceDate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { raceDateFor, nyParts, msUntilNextNyMidnight } from '../../src/time/raceDate.js';

describe('raceDateFor', () => {
  it('keys on the NY calendar date for a daytime UTC instant', () => {
    // 2026-07-15 16:00 UTC = 12:00 EDT same day
    expect(raceDateFor(new Date('2026-07-15T16:00:00.000Z'))).toBe('2026-07-15');
  });

  it('rolls back to the previous NY day for a late-UTC instant that is still "yesterday" in NY', () => {
    // 2026-07-15 03:00 UTC = 2026-07-14 23:00 EDT (UTC-4) -> still the 14th in NY
    expect(raceDateFor(new Date('2026-07-15T03:00:00.000Z'))).toBe('2026-07-14');
  });

  it('handles the instant just before NY midnight (EDT, summer, UTC-4)', () => {
    // 2026-07-16 03:59:59 UTC = 2026-07-15 23:59:59 EDT
    expect(raceDateFor(new Date('2026-07-16T03:59:59.000Z'))).toBe('2026-07-15');
  });

  it('handles the instant at NY midnight (EDT, summer, UTC-4)', () => {
    // 2026-07-16 04:00:00 UTC = 2026-07-16 00:00:00 EDT -> new day
    expect(raceDateFor(new Date('2026-07-16T04:00:00.000Z'))).toBe('2026-07-16');
  });

  it('uses UTC-5 in winter (EST): a January instant rolls correctly', () => {
    // 2026-01-15 04:59:59 UTC = 2026-01-14 23:59:59 EST (UTC-5) -> still the 14th
    expect(raceDateFor(new Date('2026-01-15T04:59:59.000Z'))).toBe('2026-01-14');
    // 2026-01-15 05:00:00 UTC = 2026-01-15 00:00:00 EST -> new day
    expect(raceDateFor(new Date('2026-01-15T05:00:00.000Z'))).toBe('2026-01-15');
  });

  it('proves the offset differs by season (DST vs EST)', () => {
    // Same wall-clock NY midnight maps to a different UTC hour in summer vs winter.
    // Summer (EDT, UTC-4): NY midnight = 04:00 UTC
    expect(raceDateFor(new Date('2026-07-16T04:00:00.000Z'))).toBe('2026-07-16');
    expect(raceDateFor(new Date('2026-07-16T03:59:59.000Z'))).toBe('2026-07-15');
    // Winter (EST, UTC-5): NY midnight = 05:00 UTC
    expect(raceDateFor(new Date('2026-01-16T05:00:00.000Z'))).toBe('2026-01-16');
    expect(raceDateFor(new Date('2026-01-16T04:59:59.000Z'))).toBe('2026-01-15');
  });
});

describe('nyParts', () => {
  it('returns the NY local Y/M/D/H/M/S parts (summer)', () => {
    expect(nyParts(new Date('2026-07-15T16:30:45.000Z'))).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 12,
      minute: 30,
      second: 45,
    });
  });

  it('returns the NY local parts across a day boundary (winter)', () => {
    // 2026-01-15 04:59:59 UTC = 2026-01-14 23:59:59 EST
    expect(nyParts(new Date('2026-01-15T04:59:59.000Z'))).toEqual({
      year: 2026,
      month: 1,
      day: 14,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });
});

describe('msUntilNextNyMidnight', () => {
  it('counts the ms to the next NY midnight (summer)', () => {
    // 2026-07-15 23:00:00 EDT = 2026-07-16 03:00:00 UTC; next NY midnight is 1h later.
    const now = new Date('2026-07-16T03:00:00.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(60 * 60 * 1000);
  });

  it('counts the ms to the next NY midnight (winter)', () => {
    // 2026-01-15 23:30:00 EST = 2026-01-16 04:30:00 UTC; next NY midnight (05:00 UTC) is 30m later.
    const now = new Date('2026-01-16T04:30:00.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(30 * 60 * 1000);
  });

  it('returns a full day just after a NY midnight', () => {
    // 2026-07-16 00:00:00 EDT = 2026-07-16 04:00:00 UTC; one second past -> ~24h minus 1s.
    const now = new Date('2026-07-16T04:00:01.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(24 * 60 * 60 * 1000 - 1000);
  });

  it('always returns a positive value within (0, 24h]', () => {
    const ms = msUntilNextNyMidnight(new Date('2026-03-10T12:00:00.000Z'));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/time/raceDate.test.ts`
Expected: FAIL — cannot resolve `../../src/time/raceDate.js`.

- [ ] **Step 3: Write `api/src/time/raceDate.ts`**

```ts
const NY_TZ = 'America/New_York';

export interface NyParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** The NY-local calendar/clock parts of a UTC instant. */
export function nyParts(date: Date): NyParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * The race_date key (YYYY-MM-DD) for a UTC instant, derived from the NY local
 * calendar date. Correct year-round across the DST/EST flip because it reads the
 * actual NY date rather than applying a fixed offset.
 */
export function raceDateFor(date: Date): string {
  const { year, month, day } = nyParts(date);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Milliseconds from `now` until the next NY midnight (00:00:00 NY local). Returns a
 * value in (0, 24h]: at exactly NY midnight it returns a full day, not 0.
 */
export function msUntilNextNyMidnight(now: Date): number {
  const { hour, minute, second } = nyParts(now);
  const ms = now.getMilliseconds();
  const elapsedToday = ((hour * 60 + minute) * 60 + second) * 1000 + ms;
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = dayMs - elapsedToday;
  return remaining === 0 ? dayMs : remaining;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/time/raceDate.test.ts`
Expected: PASS — every case green, including the summer/winter offset distinction and the around-midnight cases.

- [ ] **Step 5: Commit**

```bash
git add api/src/time/raceDate.ts api/test/time/raceDate.test.ts
git commit -m "feat: add NY race-date keying with DST-safe boundary and midnight countdown"
```

---

## Task 8: Standings engine

Pure function over breakdowns + racers. Sorted desc by score; 1-based position with ties
sharing the lower number, broken by login asc; `gapToLeader`; `isLeader`; and exactly one
`topMover` (the largest positive delta vs `previousScores` — a positive nudge only, never a
shaming signal per roadmap §4).

**Files:**
- Create: `api/src/scoring/standings.ts`
- Test: `api/test/scoring/standings.test.ts`

- [ ] **Step 1: Write the failing test `api/test/scoring/standings.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildStandings } from '../../src/scoring/standings.js';
import type { Racer, ScoreBreakdown, ReactionSummary, Cosmetic } from '@racingshape/shared';

const racer = (login: string): Racer => ({
  login,
  displayName: login.toUpperCase(),
  avatarUrl: `https://a/${login}.png`,
  firstSeen: '2026-06-01T00:00:00.000Z',
});

const bd = (over: Partial<ScoreBreakdown>): ScoreBreakdown => ({
  commit: 0,
  pr_opened: 0,
  pr_merged: 0,
  issue_closed: 0,
  ...over,
});

function racersMap(...logins: string[]): Map<string, Racer> {
  return new Map(logins.map((l) => [l, racer(l)]));
}

describe('buildStandings', () => {
  it('returns an empty array for empty input', () => {
    expect(buildStandings(new Map(), new Map(), {})).toEqual([]);
  });

  it('orders descending by score and assigns 1-based positions', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 3 })], // 3
      ['ben', bd({ pr_merged: 1 })], // 8
      ['cat', bd({ pr_opened: 1 })], // 5
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben', 'cat'), {});
    expect(standings.map((s) => [s.login, s.score, s.position])).toEqual([
      ['ben', 8, 1],
      ['cat', 5, 2],
      ['amy', 3, 3],
    ]);
  });

  it('computes gapToLeader from the top score; leader has gap 0 and isLeader true', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['ben', bd({ pr_merged: 1 })], // 8
      ['amy', bd({ commit: 3 })], // 3
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), {});
    const ben = standings.find((s) => s.login === 'ben')!;
    const amy = standings.find((s) => s.login === 'amy')!;
    expect(ben.isLeader).toBe(true);
    expect(ben.gapToLeader).toBe(0);
    expect(amy.isLeader).toBe(false);
    expect(amy.gapToLeader).toBe(5);
  });

  it('ties share the lower position and break by login asc for ordering', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['zoe', bd({ commit: 5 })], // 5
      ['amy', bd({ commit: 5 })], // 5
      ['ben', bd({ commit: 1 })], // 1
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben', 'zoe'), {});
    // amy and zoe tie at 5 -> both position 1, ordered amy before zoe; ben gets position 3
    expect(standings.map((s) => [s.login, s.position])).toEqual([
      ['amy', 1],
      ['zoe', 1],
      ['ben', 3],
    ]);
    expect(standings.find((s) => s.login === 'amy')!.isLeader).toBe(true);
    expect(standings.find((s) => s.login === 'zoe')!.isLeader).toBe(true);
  });

  it('selects exactly one topMover: the largest positive delta vs previousScores', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 10 })], // now 10
      ['ben', bd({ commit: 4 })], // now 4
    ]);
    const previousScores = new Map<string, number>([
      ['amy', 8], // +2
      ['ben', 0], // +4  <- biggest gain
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), { previousScores });
    expect(standings.find((s) => s.login === 'ben')!.topMover).toBe(true);
    expect(standings.find((s) => s.login === 'amy')!.topMover).toBe(false);
  });

  it('no topMover when there is no prior data', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 5 })]]);
    const standings = buildStandings(breakdowns, racersMap('amy'), {});
    expect(standings.every((s) => s.topMover === false)).toBe(true);
  });

  it('no topMover when no one gained (all deltas <= 0)', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 5 })]]);
    const previousScores = new Map<string, number>([['amy', 5]]); // delta 0
    const standings = buildStandings(breakdowns, racersMap('amy'), { previousScores });
    expect(standings.every((s) => s.topMover === false)).toBe(true);
  });

  it('attaches reactions and cosmetics from opts, defaulting to zero/empty', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 2 })],
      ['ben', bd({ commit: 1 })],
    ]);
    const reactions = new Map<string, ReactionSummary>([
      ['amy', { total: 3, byKind: { '🔥': 2, '⚡': 1, '🏎️': 0 } }],
    ]);
    const cosmetics = new Map<string, Cosmetic[]>([['ben', ['gold_rims']]]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), {
      reactions,
      cosmetics,
    });
    const amy = standings.find((s) => s.login === 'amy')!;
    const ben = standings.find((s) => s.login === 'ben')!;
    expect(amy.reactions).toEqual({ total: 3, byKind: { '🔥': 2, '⚡': 1, '🏎️': 0 } });
    expect(amy.cosmetics).toEqual([]);
    expect(ben.reactions).toEqual({ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } });
    expect(ben.cosmetics).toEqual(['gold_rims']);
  });

  it('carries displayName, avatarUrl, and breakdown through from the racer/breakdown maps', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 2, pr_merged: 1 })]]);
    const standings = buildStandings(breakdowns, racersMap('amy'), {});
    expect(standings[0]).toMatchObject({
      login: 'amy',
      displayName: 'AMY',
      avatarUrl: 'https://a/amy.png',
      score: 10,
      breakdown: { commit: 2, pr_opened: 0, pr_merged: 0, issue_closed: 1 },
    });
  });

  it('falls back to login for display fields when the racer is unknown', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['ghost', bd({ commit: 1 })]]);
    const standings = buildStandings(breakdowns, new Map(), {});
    expect(standings[0]).toMatchObject({
      login: 'ghost',
      displayName: 'ghost',
      avatarUrl: '',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/api -- run api/test/scoring/standings.test.ts`
Expected: FAIL — cannot resolve `../../src/scoring/standings.js`.

- [ ] **Step 3: Write `api/src/scoring/standings.ts`**

```ts
import type {
  Cosmetic,
  Racer,
  RacerStanding,
  ReactionSummary,
  ScoreBreakdown,
} from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';

const ZERO_REACTIONS = (): ReactionSummary => ({
  total: 0,
  byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 },
});

export interface BuildStandingsOpts {
  previousScores?: Map<string, number>;
  reactions?: Map<string, ReactionSummary>;
  cosmetics?: Map<string, Cosmetic[]>;
}

/**
 * Pure standings builder. Sorted desc by score; ties broken by login asc and sharing the
 * lower position number. gapToLeader is points behind P1. Exactly one topMover: the racer
 * with the largest strictly-positive gain vs previousScores (a positive nudge only — none
 * if there is no prior data or nobody gained).
 */
export function buildStandings(
  breakdowns: Map<string, ScoreBreakdown>,
  racers: Map<string, Racer>,
  opts: BuildStandingsOpts,
): RacerStanding[] {
  const entries = Array.from(breakdowns.entries()).map(([login, breakdown]) => ({
    login,
    breakdown,
    score: scoreFromBreakdown(breakdown),
  }));

  if (entries.length === 0) return [];

  entries.sort((a, b) => (b.score - a.score) || a.login.localeCompare(b.login));

  const topScore = entries[0]!.score;

  // Determine the topMover: largest strictly-positive delta vs previousScores.
  let topMoverLogin: string | null = null;
  const prev = opts.previousScores;
  if (prev) {
    let bestDelta = 0;
    for (const e of entries) {
      const before = prev.get(e.login);
      if (before === undefined) continue;
      const delta = e.score - before;
      if (delta > bestDelta) {
        bestDelta = delta;
        topMoverLogin = e.login;
      }
    }
  }

  // Positions: ties share the lower number; next distinct score jumps to its rank index + 1.
  const standings: RacerStanding[] = [];
  let position = 0;
  let lastScore: number | null = null;
  entries.forEach((e, index) => {
    if (lastScore === null || e.score !== lastScore) {
      position = index + 1;
      lastScore = e.score;
    }
    const racer = racers.get(e.login);
    standings.push({
      login: e.login,
      displayName: racer?.displayName ?? e.login,
      avatarUrl: racer?.avatarUrl ?? '',
      score: e.score,
      breakdown: e.breakdown,
      position,
      gapToLeader: topScore - e.score,
      isLeader: e.score === topScore,
      topMover: e.login === topMoverLogin,
      reactions: opts.reactions?.get(e.login) ?? ZERO_REACTIONS(),
      cosmetics: opts.cosmetics?.get(e.login) ?? [],
    });
  });

  return standings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/api -- run api/test/scoring/standings.test.ts`
Expected: PASS — ordering, ties, gap math, leader flag, topMover selection, reactions/cosmetics defaults, and empty input all green.

- [ ] **Step 5: Commit**

```bash
git add api/src/scoring/standings.ts api/test/scoring/standings.test.ts
git commit -m "feat: add standings engine (sort, ties, gap, leader, positive topMover)"
```

---

## Done when

- [ ] `npm test` is green across both workspaces (`shared` + `api`).
- [ ] `npm run build` succeeds for both `@racingshape/shared` and `@racingshape/api` (root `build` script runs both in order).
- [ ] `npm run lint` passes with no errors.
- [ ] The DST/EST race-date tests in `api/test/time/raceDate.test.ts` pass, proving the day key is correct in both summer (UTC-4) and winter (UTC-5) and around NY midnight.
- [ ] Every type/scoring/config/DDL artifact matches the roadmap canonical contract verbatim (only the `.js` import-extension adjustment in `shared/src` deviates, and it is required by NodeNext resolution).
- [ ] All work is committed on a `dev`-based branch (e.g. `feat/backend-core`); nothing on `master`.

**Handoff:** With the core library green and built, proceed to [`2026-06-02-racingshape-02-github-api.md`](2026-06-02-racingshape-02-github-api.md) — the GitHub poller, ingest, snapshotting, services, Express app, REST endpoints, and reset scheduler that turn this core into a running API.
