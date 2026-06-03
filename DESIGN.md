# RacingShape — Design Document

**Direction:** Sleek F1 Broadcast
**Owner:** Derek Foreman
**Status:** Approved direction — ready to build
**Last updated:** 2026-06-02
**Companion files:** [`prd.md`](prd.md) · [`mockup-2-f1-broadcast.html`](mockup-2-f1-broadcast.html)

---

## 1. Direction in one line

RacingShape looks like a live motorsport broadcast for the s2shape repo: a dark
telemetry UI with a race-stripe accent, a timing tower, pod-shaped cars on a
gridded track, and an end-of-day podium. It is glanceable from across the room on
a shared monitor and rewarding up close, where every number reveals its story on
hover. Delight comes from broadcast polish and motion, not from noise.

---

## 2. Design principles

1. **Glanceable in three seconds.** Leader, order, and momentum read instantly
   from the timing tower and car positions — no reading required.
2. **Detail on demand.** Nothing on screen is a dead number. Every score, gap,
   stat, podium step, and chart bar exposes its breakdown on hover (see §6).
3. **Encouraging, never punitive.** The leader is highlighted; the back of the
   pack is never singled out, dimmed, or shamed. Stats lean aggregate/team.
4. **Broadcast restraint.** One red accent, motorsport-blue and amber as signal
   colors, generous dark space. Motion is smooth tweening, never teleporting.
5. **Dark-first.** Dark is the default for a wall-mounted dev tool; light is fully
   styled and one toggle away.

---

## 3. Layout

A single screen, three stacked regions inside a 1320px max-width column.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER  🏁 RACINGSHAPE   tagline      LIVE  [date▾] ▶Replay 🌙 │
├───────────────────────────────────────────┬──────────────────┤
│ RACE CONTROL — TODAY                       │ PIT WALL         │
│ ┌─────────────┬───────────────────────────┐│  Tasks touched   │
│ │ TIMING TOWER│  TRACK (lane per racer)   ││  Completion rate │
│ │ P1 …gap     │  ▮▮ cars → finish line    ││  Team streak     │
│ └─────────────┴───────────────────────────┘│                  │
├───────────────────────────────────────────┴──────────────────┤
│ TELEMETRY — 14 DAY ACTIVITY (stacked bars, links to GitHub)   │
├───────────────────────────────────────────────────────────────┤
│ GRAND PRIX RESULT — podium + three superlatives (recap card)  │
└───────────────────────────────────────────────────────────────┘
```

On narrow widths the sidebar drops below the main column and the timing tower
stacks above the track.

---

## 4. Components

### 4.1 Header
Race-stripe left border in accent red, logo mark, wordmark in Rajdhani, and the
control cluster: a pulsing **LIVE** chip, a **date selector** (today + archived
days), a **Replay** button, and the **theme toggle**. Every control carries a
hover tooltip explaining what it does.

### 4.2 Race Control (primary view)
Two coupled panels sharing one frame:

- **Timing tower** (left, 230px). One row per racer, sorted by score: position
  number, avatar tile, username, points, and gap-to-leader (`LDR` for P1, `+n`
  otherwise). P1 gets an amber left-border and tint. This is the F1 signature —
  the at-a-glance leaderboard.
- **Track** (right). One lane per racer on a faint vertical grid, a dim start
  line at left and a checkered finish strip at right. Each car is a colored "pod"
  with the driver's initials, an avatar badge, and a username label. Position maps
  the racer's weighted score onto lane length; the track **auto-scales** to the
  day's top score so the leader sits near the front and the whole pack stays
  on-screen. Cars **tween** smoothly between 60s polls. The leader's avatar gets
  an amber ring + glow. A small **DRS** tag marks whoever gained the most on the
  latest poll (a positive nudge for the back of the pack, never a callout of the
  slowest).

### 4.3 Telemetry chart
Stacked daily bars over a 14-day default range: commits (cyan), PRs opened (red),
issues closed (amber), on dashed gridlines. Hover a bar for that day's exact
counts; the panel's **↗ GITHUB** badge and each series link through to the
matching view on `S2AI/s2shape`.

### 4.4 Pit Wall (sidebar)
Three stat blocks — **total tasks touched**, **completion rate** (with a gauge
bar), and **team streak**. Framed as team aggregates, never individual judgment.
Each value reveals its derivation on hover.

### 4.5 Grand Prix recap card
The finish-line moment for a completed day (see §5.2): a three-step **podium**
(P1 raised and amber-tinted) plus three **superlative** tiles. Auto-generated at
midnight from the archive snapshot and exportable as a share-ready PNG with a
replay link.

---

## 5. Delight features — coverage

All four PRD delight mechanics (§5.6) are designed in. Nothing was dropped.

### 5.1 Pit-stop boosts — `[v1]`  ✅ designed
Every car label carries a **⚡ boost button** and a live **reaction count**.
Clicking sprays a short particle burst (⚡/🔥/💨) over the car, increments the
count, **and floats a brief friendly "cheer" affirmation** (e.g. *Nice! 🎉
devon-r*, *Send it! 🏎️ mira-k*). That little affirmation is the point: it makes
the action read as encouragement of a teammate, not the logging of a metric.
**Cosmetic only — never changes score**, stated in the button's own tooltip.
Counts are tied to `race_date` so a day's hype archives and replays with it. In
the mockup, click any car's ⚡ to see the burst + cheer.

### 5.2 Daily Grand Prix recap — `[v1]`  ✅ designed
The recap card (§4.5): winner, full **podium (top 3)**, and three playful
**superlatives** drawn from the data — *Fastest hour* (most points in any 60-min
window), *Comeback of the day* (biggest second-half climb), *Midnight grinder*
(latest activity). Built entirely from archive snapshots, rendered as a PNG with
a replay link. Gives the day a finish line instead of a silent reset.

### 5.3 Earned car cosmetics — `[v1 starter set]`  ✅ designed
Cosmetics are unlocked by real behavior, never bought:

| Trigger | Cosmetic | Where it shows |
|---|---|---|
| Streak ≥ 5 days | Flame trail behind the pod | Track + recap |
| First merge of the day | Gold rims / gold pod accent | Track + recap |
| Most-improved vs yesterday | Rookie-of-the-Day decal | Track + recap |

Rendered as a CSS/sprite layer over the existing pod. The recap card lists which
cosmetics were earned that day so quiet contributors have something to chase that
isn't raw output volume.

### 5.4 Replay — `[v1]`  ✅ designed
Any archived day replays as a ~15s fast-forward: cars advance through the day's
events in compressed time, reactions and earned cosmetics replaying with them.
Driven by the date selector + Replay control in the header.

> The "fun layer" is the point of this direction, not an afterthought — the
> broadcast framing exists specifically to make boosts, the podium, and replays
> feel like event television rather than a metrics readout.

---

## 6. Hover-detail specification

**Rule:** any element that displays a number or a derived label must expose its
breakdown on hover. Implemented as a single lightweight tooltip engine
(`[data-tip]` → floating card, format `HEADER||body`, body supports multi-line).

| Element | Hover reveals |
|---|---|
| Timing-tower row | Full score breakdown (events × weight = points) + gap to leader |
| Car pod / label | Same score breakdown |
| Reaction count | Total boosts + emoji breakdown + "never affects score" |
| Boost button | "Cosmetic hype only" |
| DRS tag | "Gained the most points on the latest poll" |
| Chart bar | That day's date + exact commits / PRs / issues |
| Pit Wall — tasks | Issues + PRs composition |
| Pit Wall — completion | `n / m closed or merged` |
| Pit Wall — streak | Run start date + best this month |
| Podium step | Per-racer event breakdown for that day |
| Superlative tile | Definition of the award |
| Finish line | "Auto-scaled to the day's top score" |
| LIVE / date / replay / theme | What the control does |

Tooltips follow the cursor, flip to stay on-screen near edges, and never block
clicks. On touch devices these surface as tap-to-reveal (build note).

---

## 7. Visual tokens

**Type.** Rajdhani (headings/labels, condensed sporty), Chakra Petch (numerals,
monospaced telemetry feel), Inter (body).

**Color — dark (default).**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07090d` | Page |
| `--panel` / `--panel2` | `#11151c` / `#161b24` | Cards, headers |
| `--ink` / `--muted` | `#eef2f7` / `#8a94a6` | Text |
| `--line` | `#222a36` | Borders, grid |
| `--accent` | `#e10600` | Race red — stripe, PRs, primary |
| `--cyan` | `#15d6e0` | Commits, links, tooltip rule |
| `--amber` | `#ffb300` | Leader, issues, podium gold |
| `--green` | `#34d399` | Positive deltas |

**Color — light.** Same hues, lifted surfaces (`--bg #eef1f5`, `--panel #fff`),
darkened signal colors for contrast. Toggle persists via `localStorage`.

**Motion.** Car position `transform/left` over ~1s on
`cubic-bezier(.4,.8,.3,1)`; bars grow on load; tooltip 120ms fade; LIVE dot
pulse. Replay compresses a full day to ~15s. No teleporting, no sub-second jitter.

---

## 8. States

- **Live day** — LIVE chip pulsing, cars tween on each 60s poll, boosts enabled.
- **Empty / quiet day** — all cars idle on the start line; copy invites the first
  commit rather than showing a dead screen.
- **Archived day** — date selected in the past; Replay enabled; boosts shown
  read-only as they occurred.
- **Single contributor** — one car still animates and the track auto-scales, so a
  quiet day is still satisfying.
- **Light theme** — full restyle, identical layout.

---

## 9. Mapping to PRD

| PRD §  | Requirement | Design home |
|---|---|---|
| 5.1 | Race track, lanes, avatars, leader highlight, date/replay | §4.2, §4.1 |
| 5.2 | Activity chart, GitHub links, 14d default | §4.3 |
| 5.3 | Total tasks, completion rate, streak | §4.4 |
| 5.4 | Dark mode toggle + persistence | §4.1, §7 |
| 5.5 | Clean, glanceable, shared-monitor polish | §2, §3 |
| 5.6 | Pit-stop boosts, recap, cosmetics | §5.1–5.3 |
| 4 | Replay as fast-forward | §5.4 |

---

## 10. Open build notes

- **Avatars.** Mockup uses initials tiles; production swaps in GitHub avatar
  images, which will add visual weight — verify pod/label spacing with real
  images, especially in the timing tower.
- **Touch.** Define tap-to-reveal behavior for tooltips on shared touch displays.
- **PNG export.** Recap card → PNG needs a server-side or canvas render path.
- **Auto-scale edge cases.** Confirm track scaling when one racer dominates
  (e.g. 1 car at 80 pts, rest near 0) keeps the pack readable.
