# Grandstand / Spectators — Design Spec

**Date:** 2026-06-10
**Status:** Approved (brainstorm complete, pending implementation plan)
**Author:** Derek + Claude

## 1. Summary

Add a real-time **spectator layer** to RacingShape. Anyone viewing the page appears as a
fan in a **grandstand** trackside row beneath the race lanes. The live viewer count shows as
a broadcast bug in the header. Fans can optionally set a name and a country flag (auto-detected
from IP, editable), and can **cheer** a specific car — a cosmetic bubble that flies up on that
car. The day's **peak crowd** is persisted and surfaced in three places.

This extends the existing F1-broadcast metaphor (the implied audience becomes visible) without
expanding the deployment footprint: no new service, no new infra. Presence is in-memory and
ephemeral; only the peak count and the cheers (which replay on the cars) are persisted.

## 2. Goals / Non-Goals

**Goals**
- Show live concurrent viewers as a grandstand crowd + a header "N watching · peak M" bug.
- Optional self-set identity (name + flag), persisted per-device in `localStorage`.
- Auto-detect country flag server-side from IP (editable, silently pre-filled).
- Cheer a car: cosmetic, broadcast to all viewers live, **replayed** on archived days.
- Persist and surface the day's peak crowd (Pit Wall tile + sparkline, header bug, recap card).

**Non-Goals (explicit)**
- No spectator leaderboard or "most active viewer" metric. (Violates encouraging-never-punitive.)
- No persisted presence timeline / who-watched-when log. Presence is live-only, ephemeral.
- No cross-device identity. Identity lives in `localStorage` only; no accounts, no server profile.
- No WebSockets. SSE only.
- Cheers never affect score. (Boosts-are-cosmetic-only rule.)

## 3. Product principles compliance

- **Encouraging, never punitive:** anonymous fans always appear (just dimmed), are never named
  or singled out. No ranking of spectators. Cheers are only positive.
- **No dead numbers:** every new metric (viewer count, peak, each fan, the stat tile, the recap
  stat) exposes a breakdown through the existing shared tooltip engine.
- **Boosts cosmetic only:** cheers never write a scoring `event` and never change `score`.
- **Dark-first + light:** all new UI reuses existing CSS theme tokens; no new palette.

## 4. Architecture

### 4.1 Transport — SSE
- New endpoint `GET /api/spectators/stream` (Server-Sent Events). Each client opens one
  `EventSource` on load. The server pushes two event kinds:
  - `presence` — the current grandstand snapshot (count, peak, and the list of fans).
  - `cheer` — a single cheer just sent (target car login, label).
- SSE chosen over WebSocket: server-push only, rides plain HTTP, no upgrade handshake, trivially
  compatible with the existing Express app and the optional `SITE_PASSWORD` basic-auth layer.

### 4.2 Presence — in-memory, ephemeral
- Server holds `Map<sessionId, Presence>` where
  `Presence = { sessionId, name?, flag?, country?, cheerForLogin?, joinedAt, lastSeen }`.
- Client POSTs `POST /api/spectators/heartbeat` every ~20s with its `sessionId` + identity
  (name, flag, cheerForLogin). Server upserts the map entry and refreshes `lastSeen`.
- A **reaper** (runs on the existing interval infrastructure near the poller/scheduler tick)
  drops entries whose `lastSeen` is older than ~45s, and on SSE disconnect. After any change to
  the set, the server broadcasts a fresh `presence` event.
- Nothing in this map is written to SQLite.

### 4.3 Identity — localStorage
- Client generates a `sessionId` (uuid) on first load, stored in `localStorage` following the
  existing pattern (`useTheme.ts`, `REVEAL_SEEN_KEY`) with try/catch.
- Optional `name` and `flag` also persisted in `localStorage`; re-sent on every heartbeat/reconnect.
- Keys: `racingshape-spectator-id`, `racingshape-spectator-name`, `racingshape-spectator-flag`.

### 4.4 Geo — server-side, IP never reaches the browser
- On the first heartbeat from a given IP, the server resolves IP → ISO country code, cached
  in-memory `Map<ip, countryCode>`. The country code maps to a flag emoji.
- Provider: **ip-api.com free tier** — server-side outbound call to
  `http://ip-api.com/json/{ip}?fields=status,countryCode`. Server-side use avoids the
  HTTPS mixed-content problem (the endpoint is HTTP-only). Enabled via an env flag (e.g.
  `GEO_ENABLED=true`); if disabled or the call fails, geo is skipped and fans have no auto flag.
- **Rate limit:** free tier allows ~45 req/min per source IP. The in-memory `Map<ip, countryCode>`
  cache means we only call once per distinct viewer IP, keeping us far under the limit. On HTTP 429
  / `status:"fail"` / timeout, back off and skip gracefully (never block a heartbeat on geo).
- **License:** free tier is non-commercial-only; using it on an internal company tool is an
  accepted risk (decision by Derek).
- The flag is **silently pre-filled** (no upfront modal). Disclosure: hovering your own flag shows
  a tooltip "set from your location · click to change or remove". A client override is stored in
  `localStorage` and suppresses the auto value.
- The raw IP and resolved country are never sent to any client except as *your own* flag.

### 4.5 Cheers — cosmetic, broadcast, replayed
- `POST /api/spectators/cheer { targetLogin }`. Server enforces a ~5s per-session cooldown.
- On accept, the server (a) broadcasts a `cheer` SSE event to all viewers and (b) persists the
  cheer for replay (see §5). Anonymous senders persist/display as "a fan".
- A cheer never creates a scoring `event` and never alters any `score`.

### 4.6 Peak tracking
- The server tracks the current concurrent viewer count. When it exceeds the stored peak for the
  current `race_date`, it upserts `viewer_peaks` (see §5) with the new count and timestamp.

## 5. Data model (SQLite)

Schema lives in `api/src/db/schema.sql.ts`, applied idempotently by `migrate()` on every boot.

### 5.1 New table — `viewer_peaks`
```sql
CREATE TABLE IF NOT EXISTS viewer_peaks (
  race_date   TEXT PRIMARY KEY,   -- YYYY-MM-DD (America/New_York)
  peak_count  INTEGER NOT NULL,
  peak_at     TEXT NOT NULL       -- ISO UTC when the peak was reached
);
```

### 5.2 Cheers reuse the existing `reactions` table
Cheers and pit-stop boosts are the same mechanic (cosmetic, car-attached, replayed). Reuse the
`reactions` table rather than adding a parallel one. Add one discriminator column:

```sql
-- added to the existing reactions DDL:
ALTER-equivalent: add column  source TEXT NOT NULL DEFAULT 'boost'  -- 'boost' | 'cheer'
```
(Implemented by adding `source TEXT NOT NULL DEFAULT 'boost'` to the `CREATE TABLE reactions`
block; the `DEFAULT` keeps existing rows valid. Because `migrate()` only runs `CREATE TABLE IF
NOT EXISTS`, adding a column to a pre-existing DB requires a guarded `ALTER TABLE` in `migrate()` —
check `pragma table_info(reactions)` and add the column if absent.)

A cheer row:
- `kind` = `'🙌'`
- `source` = `'cheer'`
- `reactor` = the voluntary self-set name, or the literal `'a fan'` when anonymous
- `target_racer_login`, `race_date`, `created_at`, `id` as today

**Identity-free:** no `sessionId` and no IP are ever stored on the cheer. `reactor` is just a
label someone chose to wave — not a presence record. This keeps cheers non-surveillant.

**Aggregation rule:** the existing live `ReactionSummary` (boost counts, `byKind` over the three
boost kinds) must **exclude** `source='cheer'` rows so cheers don't inflate boost totals. Cheers
are surfaced separately (live count of recent cheers per car + the flying bubble).

## 6. API surface

New routes, mounted in `createApp()` (`api/src/app.ts`):
- `GET  /api/spectators/stream` — SSE: `presence` and `cheer` events.
- `POST /api/spectators/heartbeat` — body `{ sessionId, name?, flag?, cheerForLogin? }` →
  `{ flag?: string }` (echoes the server-resolved auto-flag on first contact so the client can
  pre-fill if the user hasn't overridden).
- `POST /api/spectators/cheer` — body `{ sessionId, targetLogin }` → `{ ok: true }` or
  `{ ok: false, reason: 'cooldown' }`.

Augmented existing payloads:
- `GET /api/race/today` (`RaceToday`) gains `viewers: { count, peak, peakAt }` for initial render
  before the SSE stream warms up. (`count` is the live concurrent count at request time.)
- `GET /api/race/:date` (`RaceArchive`) — cheers already ride `reactions` replay via `listForDate`
  ordered by `created_at`; the replay engine renders `source='cheer'` rows as car bubbles.
- `GET /api/stats` (`StatsResponse`) gains `crowd: { peakToday, peaks: { date, peak }[] }` for the
  Pit Wall tile + 14-day sparkline.

SSE event payload shapes (shared types, §8):
```ts
type PresenceEvent = {
  type: 'presence';
  count: number;
  peak: number;
  peakAt: string | null;
  fans: SpectatorFan[];           // ordered; named first, then anon
};
type SpectatorFan = {
  id: string;                     // opaque per-session id (not the sessionId secret)
  name: string | null;           // null = anonymous
  flag: string | null;           // emoji
  cheerForLogin: string | null;
  isSelf?: boolean;               // server marks the requester's own entry
  watchingForSec: number;
};
type CheerEvent = {
  type: 'cheer';
  targetLogin: string;
  label: string;                  // name or 'a fan'
};
```

## 7. Frontend components

All under `web/src/components/` unless noted. New metrics use `data-tip={tip(header, body)}`.

| Component | New/changed | Responsibility |
|-----------|-------------|----------------|
| `useSpectators` (hook, `web/src/lib/`) | new | Opens `EventSource`, sends heartbeats, manages identity in `localStorage`, exposes `{ count, peak, peakAt, fans, cheer(login) }`. |
| `BroadcastBug` | new | Header chip `● N WATCHING · PEAK M`, placed next to the LIVE chip in `Header.tsx`. Tooltip: named/anon split + peak time. |
| `Grandstand` | new | Trackside row under the lanes (rendered by `RaceControl`/`Track`). Flag+name fans, anon dimmed, `+N` overflow, "you" outlined. Each fan has a tooltip (name, flag, watching-time, who they cheer). |
| `IdentityControl` | new | Clicking your own fan opens a small name input + flag/emoji picker; writes `localStorage`. Disclosure tooltip on the auto flag. |
| `CheerLayer` / `Car` | changed | Clicking a car sends a cheer; renders the cheer bubble + flag pin on the cheered car + supporter dot on the cheering fan. Reuses the existing boost spark/affirmation animation in `Car.tsx`/`BoostButton.tsx`. |
| `PitWall` | changed | New "Biggest crowd" stat tile + 14-day peaks sparkline, following the existing `border-b` stat block pattern. Tooltip: peak count, peak time, vs-average. |
| `Recap` / `GrandPrixReveal` | changed | New "Biggest crowd" super-stat (peak + time) in the midnight recap. |
| Replay engine (`App.tsx`) | changed | Renders `source='cheer'` reactions as car bubbles during archived-day replay. Does **not** reconstruct presence (live-only). |

Cheering UX: anyone may cheer (even anonymous → "a fan is cheering dev-r"); ~5s client+server
cooldown. Cheers fly on the car immediately and broadcast to all viewers.

## 8. Shared types

Add to `shared/src/types.ts` (re-exported via `shared/src/index.ts`):
- `SpectatorFan`, `PresenceEvent`, `CheerEvent` (§6).
- `HeartbeatBody = { sessionId: string; name?: string; flag?: string; cheerForLogin?: string }`.
- `CheerBody = { sessionId: string; targetLogin: string }`.
- Extend `RaceToday` with `viewers: { count: number; peak: number; peakAt: string | null }`.
- Extend `StatsResponse` with `crowd: { peakToday: number; peaks: { date: string; peak: number }[] }`.
- Extend the reactions row/`ReactionKind` handling so `'🙌'` + `source` are representable; ensure
  `ReactionSummary` aggregation excludes cheers.

## 9. Replay scope (confirmed)

- **Presence (the stand): live-only, never stored.** Archived/replayed days show the recorded
  peak number, not a reconstructed crowd.
- **Peak count: persisted** in `viewer_peaks`.
- **Cheers: persisted + replayed** via the existing `reactions` replay path, identity-free.

Storage cost is negligible (cheers ~25 KB/day; peaks one row/day). The decision to keep presence
live-only is driven by privacy (no who-watched-when log) and complexity, not bytes.

## 10. Recommended build order (all ship this release)

1. **Broadcast bug live count** — SSE stream + in-memory counter + `BroadcastBug` chip. Smallest
   delightful slice; validates that people actually dwell on the page.
2. **Full grandstand** — `Grandstand` row, `useSpectators`, identity (`IdentityControl` +
   localStorage), server-side geo flag, cheers + `CheerLayer`.
3. **Peak persistence + surfaces** — `viewer_peaks`, Pit Wall tile + sparkline, recap super-stat,
   and cheer replay on archived days.

## 11. Risks / open questions

- **Geo provider/license:** ip-api.com free tier (decided). Non-commercial license is an accepted
  risk. Operational risks: outbound HTTP dependency (handle failure by skipping), the 45 req/min
  rate limit (mitigated by per-IP in-memory cache), and HTTP-only (mitigated by server-side calls).
  If usage outgrows the free tier or the license becomes a concern, swap to a local GeoLite2 DB
  behind the same `country = lookup(ip)` interface.
- **SSE + basic auth:** confirm the optional `SITE_PASSWORD` middleware passes through `EventSource`
  requests (browsers send the auth header on same-origin SSE; verify during implementation).
- **SSE behind any future proxy/buffering:** ensure `Cache-Control: no-cache`, `Connection:
  keep-alive`, and periodic comment-ping keepalives so intermediaries don't buffer the stream.
- **Reaper cadence vs. heartbeat:** 20s heartbeat / 45s stale window tolerates one missed beat;
  tune if counts feel laggy.
- **Cheer abuse:** 5s cooldown is cosmetic-only mitigation; no auth on who cheers (by design).
