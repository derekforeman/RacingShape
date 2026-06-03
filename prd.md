# RacingShape — Product Requirements Document

**Owner:** Derek Foreman
**Status:** Approved for build
**Last updated:** 2026-06-02
**Tagline:** *Ship code. Race cars. Win the day.*

---

## 1. Summary

RacingShape is a developer productivity dashboard for the team working on
[S2AI/s2shape](https://github.com/S2AI/s2shape). It turns the day's GitHub
activity into a daily car race: every contributor gets a car driven by their
work. The race runs once per day, resets at midnight, and stores past races for
replay. Alongside the track sits a clean stats dashboard — activity charts,
streaks, completion rate.

The point is team momentum and encouragement. It should feel like a scoreboard
the team *wants* to glance at, not a metrics tool imposed from above — individual
rankings are never reported upward. Elegance is in simplicity: one screen, one
race, instantly readable.

---

## 2. Goals & Non-Goals

### Goals
- Make daily progress on s2shape visible and fun.
- Give the team a friendly, low-pressure sense of momentum and friendly competition.
- Be glanceable: someone sees who's "in the lead" in under three seconds.
- Ship fast — one focused release, no multi-phase rollout.

### Non-Goals
- Not a performance-review or management-reporting tool. No ranking sent upward.
- Not a project-management replacement (no kanban, sprints, or task assignment UI).
- Not multi-repo (v1 tracks s2shape only).
- No real-time sub-second updates; near-real-time polling is enough.

### Success signals
- The team opens it voluntarily (daily active glances).
- People react to it in chat ("nice, I passed you").
- It runs unattended for a week with no manual intervention.

---

## 3. Users

- **The s2shape dev team.** Small group (≈3–10 people). Everyone is both a racer
  and a viewer. No role hierarchy in the app — all contributors are equal cars.
- **Identification:** racers are discovered automatically. Anyone who commits,
  opens a PR, or is assigned/closes an issue on s2shape that day appears as a car.
  Their GitHub avatar becomes the driver; their GitHub username names the car.
  Zero manual roster setup.

---

## 4. Core Concept: The Daily Race

### The mechanic
Each contributor drives one car. A car's position along the track is its
**activity score** for the current day. The car furthest along leads the race.

> 💡 The race is a live visualization of a leaderboard — position on the track is
> just each person's score mapped onto track length. No physics, no driving sim.

### Scoring (weighted activity)
Points accrue per GitHub event during the race window:

| Event | Points |
|-------|--------|
| Commit pushed | 1 |
| Pull request opened | 5 |
| Pull request merged | 8 |
| Issue closed | 3 |

Weights live in a single config constant so they're trivial to tune. The highest
realistic daily total maps to the finish line; the track auto-scales so the
leader is always near the front and the pack stays visible (no car pinned at the
start, none off-screen). Ties render as cars side by side.

### Race lifecycle
- **Window:** 12:00:00 AM → 11:59:59 PM **EDT**, daily.
- **Reset:** at midnight EDT a new race begins; all cars return to the start line.
- **Archive:** the completed race (per-racer score timeline) is persisted before reset.
- **Replay:** any past race can be replayed as a fast-forward animation — cars
  advancing through the day's events in compressed time (e.g. full day in ~15s).
  This is the "fun" payoff for finished days.

### Live behavior
- Backend polls GitHub on an interval (default 60s) and recomputes scores.
- Frontend animates cars smoothly to their new positions between updates
  (tween, not teleport).
- An empty day (no activity yet) shows all cars idling at the start line.

---

## 5. Features

### 5.1 Race Track (primary view)
- Horizontal track with one lane per racer.
- Each car: GitHub avatar as the driver, username as a label.
- Live position by activity score; smooth animation between polls.
- Leader subtly highlighted (e.g. a small crown / glow). No shaming of the back.
- Date selector to switch between today (live) and archived races (replay).
- Replay controls for archived days: play, pause, speed.

### 5.2 Activity Chart
- Coding activity over time: commits per day, PRs opened, issues assigned/closed.
- Each plotted series links out to the relevant GitHub view (commits list, PRs,
  issues) for the repo so a click goes straight to the source.
- Sensible default range (e.g. last 14 days).

### 5.3 Productivity Sidebar
- **Total tasks** (issues + PRs touched, configurable definition).
- **Completion rate** (closed/merged ÷ opened over the range).
- **Streak** — consecutive days the team (or the viewer) had activity.
- Stats are friendly and aggregate-leaning; never framed as individual judgment.

### 5.4 Dark Mode
- Toggle in the header. Persists across sessions (localStorage).
- Both themes fully styled; dark is a strong default for a dev tool.

### 5.5 Polish & visual direction
- **Direction: F1 broadcast.** A dark telemetry UI with a timing tower, pod-style
  cars on a gridded track, and an end-of-day podium — glanceable on a shared
  monitor, rewarding up close. Full spec in [`DESIGN.md`](DESIGN.md).
- Clean UI. Generous dark space, one race-red accent, readable type.
- Responsive enough to look good on a wall-mounted/shared monitor.

### 5.6 Detail on hover
- Every element that displays a number or a derived label exposes its breakdown
  on hover: car/tower score = events × weights, gap-to-leader, each sidebar
  stat's derivation, and per-day chart counts. **No dead numbers** — the team can
  always see how a figure was computed. (Touch displays surface this as
  tap-to-reveal.)

### 5.7 Delight Features

The fun layer. Each tagged with build status so v1 scope stays honest.

**Pit-stop boosts — `[v1]`**
Anyone can click a teammate's car and drop a reaction (🔥 / ⚡ / 🏎️). The
reaction sprays a short nitro/particle burst on that car, bumps a visible
reaction count, and shows a brief "cheer" affirmation (e.g. *Cheered devon-r!*).
**Cosmetic only — never changes score.** Turns a solo glance into team banter
inside the app. The small, friendly affirmation is deliberate — it makes the
interaction read as encouragement, not a metric. Reactions are tied to the
current `race_date` so a day's hype is archived and replays with it.

**Daily Grand Prix recap — `[v1]`**
At EDT midnight, before reset, auto-generate a recap card for the finished day:
winner, podium (top 3), and a couple of playful superlatives drawn from the
data — e.g. *Most commits in one hour*, *Comeback of the Day* (biggest
late-day climb), *Midnight Grinder* (latest activity). Rendered as a
copy/share-ready image (PNG) with a link to the replay. Gives the day a finish
line instead of a silent reset. Built entirely on the archive snapshots already
in the data model.

**Earned car cosmetics — `[v1: starter set; more deferred]`**
Cosmetics unlocked by real behavior, never bought or configured:
- Streak ≥ 5 days → flame trail.
- First merge of the day → gold rims.
- Most-improved vs yesterday → Rookie-of-the-Day decal.

Gives quiet contributors something to chase that isn't raw output volume, and
rewards consistency. All triggers derive from stats already computed; this is a
sprite/CSS layer over the existing car. v1 ships the three above; additional
unlocks are deferred (see §7).

---

## 6. Technical Design

### Stack
- **Frontend:** React + TypeScript + Tailwind CSS.
- **Backend:** TypeScript API (Node). REST endpoints consumed by the frontend.
- **Database:** SQLite.
- **Source data:** GitHub REST/GraphQL API for S2AI/s2shape (private repo).

### GitHub integration
- Backend authenticates with a GitHub token (PAT or GitHub App) stored
  server-side as an env var — **never** exposed to the browser.
- A poller runs on an interval, fetches the day's commits, PRs, and issues,
  computes per-racer scores, and writes them to SQLite.
- Respect rate limits: poll on interval (default 60s), use conditional requests /
  ETags where possible, back off on 403/secondary limits.
- New contributors are discovered from event authors and upserted automatically
  (avatar URL + username cached).

### Data model (SQLite, indicative)
- `racers` — github_login (pk), display_name, avatar_url, first_seen.
- `events` — id, racer_login, type (commit/pr_opened/pr_merged/issue_closed),
  points, occurred_at (UTC), race_date (EDT day key).
- `race_snapshots` — race_date, racer_login, score, captured_at — periodic
  snapshots so a replay can animate the day's progression.
- `daily_stats` — race_date, aggregate counts for charts/streak.
- `reactions` — id, race_date, target_racer_login, kind (🔥/⚡/🏎️), reactor, created_at — powers pit-stop boosts; archived/replayed with the race.

### Time handling
- Race day boundary is **EDT** regardless of server timezone. Store timestamps in
  UTC; derive the `race_date` key by converting to EDT. (Note: EDT is fixed UTC−4;
  document explicitly whether DST/EST transitions matter — for v1 we treat the
  day key as America/New_York local date to stay correct year-round.)

> 💡 EDT is daylight time (UTC−4); the same zone is EST (UTC−5) in winter. Keying
> off the `America/New_York` *date* avoids a day-boundary bug when the US flips DST.

### API surface (indicative)
- `GET /api/race/today` — live racers + current scores.
- `GET /api/race/:date` — archived race with snapshot timeline for replay.
- `GET /api/races` — list of available archived dates.
- `GET /api/stats?range=14d` — chart series + sidebar stats.

### Architecture
Single repo, two apps (web + api) or one server serving both. SQLite file on
disk. The poller is an interval job inside the API process (no separate worker
needed at this scale). Keep it boring and small.

---

## 7. Scope & Cut Lines

### In scope (v1 — the whole release)
Race track (live + replay), weighted scoring, auto-discovered racers, activity
chart with GitHub links, productivity sidebar, dark mode, daily reset + archive.
Plus delight features (§5.7): pit-stop boosts, daily Grand Prix recap card, and
the starter set of earned cosmetics.

### Explicitly deferred (only if v1 lands and the team wants more)
Multi-repo support, configurable per-user scoring weights, sound effects,
seasonal/all-time leaderboards, Slack notifications, mobile-native layout,
expanded cosmetic unlocks beyond the starter set, direct Slack auto-post of the
recap card. None of these block v1. **No phase 2 gate on shipping v1.**

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| GitHub rate limits during polling | Interval polling + ETags + backoff; cache aggressively in SQLite. |
| Race feels like pressure or monitoring | Aggregate-friendly framing, no back-of-pack shaming, no upward reporting. Stated as a hard product principle. |
| EDT/DST day-boundary bugs | Key on America/New_York local date, store UTC. Test around midnight. |
| Token leakage | Token server-side only; frontend never sees it. |
| Empty/quiet days feel dead | Idle-at-start state + replay of past lively days keeps it fun. |
| Few contributors on a given day | Track auto-scales; even one car animating is satisfying. |

---

## 9. Done Definition

- Live race renders today's contributors as avatar-driven, username-labeled cars,
  positioned by weighted score, animating between 60s polls.
- Race resets at EDT midnight; prior day archived and replayable at speed.
- Activity chart shows commits/PRs/issues with working links to s2shape on GitHub.
- Sidebar shows total tasks, completion rate, streak.
- Dark mode toggles and persists.
- Runs unattended for a week against the private repo without manual fixes.
- UI is clean and glanceable on a shared monitor, in the F1 broadcast direction.
- Every displayed metric (car/tower scores, gap-to-leader, sidebar stats, chart
  bars) reveals its breakdown on hover.
