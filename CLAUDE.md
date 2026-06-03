# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Commands Reference

### Github interaction

- Use the gh bash tool to interact with github for pull requests (PRs), Issues or anything else github related.
- It is ok to use the standard git bash for general git commands if needed.

### Git Commit Guidelines
- Please use Conventional commits formatting for git commits.
- Please use conventional Branch naming (prefix-based branch naming convention)
- Please do not mention yourself (Claude) as a co-author when committing, or include any links to Claude Code.

### Git workflow
Your Git Workflow

  Production Flow:
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  master (production) ◄──── PR merge ◄──── dev           │
  │                                            ▲            │
  │                                            │            │
  │                                       PR merge          │
  │                                            │            │
  │                               feature/fix branches      │
  │                              (branched from dev)        │
  └─────────────────────────────────────────────────────────┘

  Daily Workflow:
  1. Start work: git checkout dev && git pull origin dev
  2. Create feature branch: git checkout -b feature/your-feature-name
  3. Work & commit: Make changes, commit to feature branch
  4. Open PR: Create PR to merge feature/your-feature-name → dev
  5. Review & merge: PR gets reviewed, merged into dev
  6. Validate: Test dev thoroughly
  7. Deploy: Create PR to merge dev → master for production

  Key Points:
  - master = production-ready code only
  - dev = integration branch for development
  - Feature branches = isolated work, branched from dev
  - Never commit directly to master

## Commands

The monorepo uses npm workspaces (`shared`, `api`, `web`). Run from the repo root.

- **Install:** `npm install`
- **Test everything:** `npm test`
- **Test one workspace:** `npm test -w @racingshape/api`
- **Test one file:** `npx vitest run api/test/github/poller.test.ts`
- **Test by name:** append `-t "name substring"`
- **Build everything:** `npm run build`
- **Lint:** `npm run lint`
- **Run the API (dev):** `npm run dev -w @racingshape/api` (needs `GITHUB_TOKEN` in env; see `.env.example`)
- **Build the API:** `npm run build -w @racingshape/api`

> Frontend (`web`) dev/build scripts are added by plan 03.

### Source-of-truth design docs (decisions already approved)

- **`prd.md`** — what to build and why. Scope, scoring rules, data model, API surface, risks, done-definition.
- **`DESIGN.md`** — how it looks and behaves. "F1 broadcast" direction, layout, components, visual tokens, hover-detail spec, states.
- **`mockup-2-f1-broadcast.html`** — the approved visual reference. `docs/archive/` holds the two rejected mockups (arcade, minimal) — do not build from them.
- **`docs/superpowers/plans/`** — the build roadmap + four phase plans driving implementation.

## What RacingShape is

A developer productivity dashboard for the [S2AI/s2shape](https://github.com/S2AI/s2shape)
team. The day's GitHub activity becomes a daily car race: each contributor is a car, position
= their weighted activity score. Race runs midnight→midnight, resets daily, archives past days
for fast-forward replay. Alongside it: an activity chart and a team stats sidebar.

## Intended stack (per PRD)

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** TypeScript API on Node, REST endpoints
- **DB:** SQLite (file on disk)
- **Architecture:** single repo, web + api. The GitHub poller is an **interval job inside the
  API process** — no separate worker. Keep it small.

## Architecture decisions that aren't obvious from code

These are deliberate and easy to get wrong — honor them:

- **The race is a leaderboard visualization, not a simulation.** Car position is just the
  weighted score mapped onto track length. No physics. Track **auto-scales** to the day's top
  score so the leader sits near the front and the whole pack stays on-screen.
- **Scoring weights live in one config constant** (commit 1, PR opened 5, PR merged 8, issue
  closed 3). Tune in one place.
- **Day boundary is keyed on `America/New_York` local date, NOT a hardcoded UTC−4.** The PRD
  says "EDT" but using fixed UTC−4 breaks at the DST/EST flip. Store timestamps in UTC, derive
  the `race_date` key via the NY local date. Test behavior around midnight.
- **GitHub token is server-side only** (env var). It must never reach the browser — the
  frontend talks only to our API, our API talks to GitHub.
- **Poller respects rate limits:** ~60s interval, conditional requests / ETags, back off on
  403 / secondary limits, cache aggressively in SQLite. s2shape is private.
- **Racers are auto-discovered** from event authors and upserted (avatar + username cached).
  There is no roster/admin UI.
- **Replay is driven by archived `race_snapshots`** (periodic score captures), not recomputed
  live. Reactions and earned cosmetics replay with the day.

## Product principles that constrain implementation

- **Encouraging, never punitive.** Leader is highlighted; the back of the pack is never
  dimmed, singled out, or shamed. Stats lean team-aggregate. No individual ranking is ever
  surfaced as judgment or reported upward. This is a hard rule, not a preference.
- **No dead numbers.** Every displayed metric (car/tower score, gap-to-leader, each sidebar
  stat, chart bar, podium step) must reveal its breakdown on hover via one shared tooltip
  engine. See `DESIGN.md` §6 for the full element→tooltip table.
- **Boosts are cosmetic only** — pit-stop reactions never change score.
- **Dark-first**, light theme fully styled and one toggle away (persist via `localStorage`).

## Data model (SQLite, indicative — see prd.md §6)

`racers`, `events` (typed, points, race_date), `race_snapshots` (powers replay),
`daily_stats` (charts/streak), `reactions` (boosts, tied to race_date).

## API surface (indicative)

`GET /api/race/today` · `GET /api/race/:date` · `GET /api/races` · `GET /api/stats?range=14d`

## Scope discipline

v1 is the whole release and ships everything including the delight layer (boosts, daily Grand
Prix recap card, starter-set earned cosmetics, replay). **No phase-2 gate** — see prd.md §7
for the explicit deferred list (multi-repo, configurable weights, Slack auto-post, etc.). Don't
pull deferred items into v1, and don't defer v1 items.
