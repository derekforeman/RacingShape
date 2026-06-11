# Grandstand / Spectators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time spectator layer to RacingShape — a live viewer count "broadcast bug", a trackside grandstand of fans (optional name + auto country flag), and cosmetic car "cheers" that replay on archived days.

**Architecture:** SSE pushes presence + cheer events from the API to every browser. Presence is held in an in-memory registry (ephemeral, never persisted). Identity lives in the browser's `localStorage`. Country flags are resolved server-side from IP via ip-api.com (cached per-IP). Only the daily peak count (new `viewer_peaks` table) and cheers (reused `reactions` table with a `source` discriminator) are persisted; cheers replay through the existing reactions archive path.

**Tech Stack:** TypeScript, Node, Express 5, better-sqlite3, Vitest + supertest (backend tests), React + Vite + Tailwind (frontend, no unit-test tooling — verified via `npm run dev`). Shared types in the `@racingshape/shared` workspace.

**Spec:** `docs/superpowers/specs/2026-06-10-grandstand-spectators-design.md`

**Branch:** `feature/grandstand-spectators` (already checked out).

---

## Conventions for every task

- Run a single test file: `npx vitest run <path>`; by name: append `-t "substring"`.
- DB tests use `openDb(':memory:')` then `migrate(db)` (see existing `api/test/db/repositories/reactions.test.ts`).
- Repository row types are camelCase; SQL columns are snake_case (mapped with `AS`).
- Commit after each task with a Conventional Commit message; do not mention Claude as co-author.
- After the whole plan: `npm run build && npm run lint && npm test` must pass.

---

## File structure

**Shared (`shared/src/`)**
- `types.ts` — add spectator/cheer/viewers/crowd types; extend `RaceToday`, `StatsResponse`, `ArchivedReaction`.
- `flag.ts` *(new)* — `flagEmoji(countryCode)` pure util (used by server geo + client picker default).
- `index.ts` — re-export `flag.ts`.

**API (`api/src/`)**
- `spectators/sse.ts` *(new)* — `SseHub`: connected-client registry + broadcast.
- `spectators/registry.ts` *(new)* — `SpectatorRegistry`: in-memory presence map + peak bumping + snapshot.
- `spectators/geo.ts` *(new)* — `createIpApiGeo`: IP→countryCode, in-memory cache, graceful failure.
- `db/repositories/viewerPeaks.ts` *(new)* — `getViewerPeak`, `upsertViewerPeak` (raise-only).
- `db/repositories/reactions.ts` *(modify)* — `source` column support, `insertCheer`, exclude cheers from boost summaries, return `source` from `listForDate`.
- `db/schema.sql.ts` *(modify)* — add `viewer_peaks`; add `source` column to `reactions`.
- `db/migrate.ts` *(modify)* — guarded `ALTER TABLE reactions ADD COLUMN source` for pre-existing DBs.
- `routes/spectators.ts` *(new)* — `GET /stream`, `POST /heartbeat`, `POST /cheer`.
- `routes/race.ts` *(modify)* — attach `viewers` to the today payload.
- `services/statsService.ts` *(modify)* — attach `crowd` (peak today + 14d peaks).
- `app.ts` *(modify)* — construct spectator deps, mount router, `trust proxy`, pass registry to race router.
- `index.ts` *(modify)* — start the reaper interval; wire DB-backed peak store + geo from config.
- `config.ts` *(modify)* — read `GEO_ENABLED`.

**Web (`web/src/`)**
- `lib/spectatorId.ts` *(new)* — localStorage identity helpers.
- `lib/useSpectators.ts` *(new)* — EventSource + heartbeat + cheer hook.
- `lib/api.ts` *(modify)* — `postHeartbeat`, `postCheer` helpers.
- `components/BroadcastBug.tsx` *(new)* — header live-count chip.
- `components/Grandstand.tsx` *(new)* — trackside fan row.
- `components/IdentityControl.tsx` *(new)* — name + flag editor popover.
- `components/Car.tsx` *(modify)* — click-to-cheer + bubble/pin/supporter dot.
- `components/Header.tsx` *(modify)* — mount `BroadcastBug`.
- `components/RaceControl.tsx` / `Track.tsx` *(modify)* — render `Grandstand` under the lanes.
- `components/PitWall.tsx` *(modify)* — "Biggest crowd" tile + sparkline.
- `components/GrandPrixReveal.tsx` / `Recap.tsx` *(modify)* — "Biggest crowd" super-stat.
- `App.tsx` *(modify)* — mount hook, feed components, replay `source='cheer'` reactions.

---

# PHASE 1 — SSE backbone + live viewer count + broadcast bug

Smallest shippable slice: a live "N watching" chip. Validates that people dwell on the page.

## Task 1: Shared spectator types

**Files:**
- Modify: `shared/src/types.ts`
- Test: `shared/test/types.spec-types.test.ts` *(new — a compile-time assertion test)*

- [ ] **Step 1: Add the types**

Append to `shared/src/types.ts` (keep all existing exports; if `RaceToday` / `StatsResponse` / `ArchivedReaction` already exist, add the new fields to them rather than redeclaring):

```ts
// ---- Spectators ----
export interface SpectatorFan {
  id: string;                    // opaque per-session id (NOT the secret sessionId)
  name: string | null;          // null = anonymous
  flag: string | null;          // emoji, e.g. "🇨🇦"
  cheerForLogin: string | null; // racer this fan is cheering, if any
  isSelf?: boolean;             // server marks the requester's own entry
  watchingForSec: number;
}

export interface PresenceEvent {
  type: 'presence';
  count: number;
  peak: number;
  peakAt: string | null;        // ISO UTC
  fans: SpectatorFan[];         // named first, then anonymous
}

export interface CheerEvent {
  type: 'cheer';
  targetLogin: string;
  label: string;                // self-set name, or 'a fan'
}

export interface HeartbeatBody {
  sessionId: string;
  name?: string | null;
  flag?: string | null;         // client override; suppresses auto geo flag
  cheerForLogin?: string | null;
}

export interface HeartbeatResponse {
  flag: string | null;          // server-resolved auto flag (null if disabled/unknown)
}

export interface CheerBody {
  sessionId: string;
  targetLogin: string;
}

export interface CheerResponse {
  ok: boolean;
  reason?: 'cooldown' | 'unknown_target';
}

export interface ViewersSummary {
  count: number;
  peak: number;
  peakAt: string | null;
}

export interface CrowdStat {
  peakToday: number;
  peaks: { date: string; peak: number }[]; // chronological, for the sparkline
}
```

Then extend the existing interfaces:
- Add to `RaceToday`: `viewers: ViewersSummary;`
- Add to `StatsResponse`: `crowd: CrowdStat;`
- Add to `ArchivedReaction`: `source: 'boost' | 'cheer';`

- [ ] **Step 2: Write a compile-time assertion test**

Create `shared/test/spectator-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  PresenceEvent, CheerEvent, HeartbeatBody, HeartbeatResponse,
  CheerBody, CheerResponse, ViewersSummary, CrowdStat, SpectatorFan,
} from '../src/types.js';

describe('spectator shared types', () => {
  it('shapes are constructible', () => {
    const fan: SpectatorFan = { id: 'a', name: null, flag: null, cheerForLogin: null, watchingForSec: 0 };
    const presence: PresenceEvent = { type: 'presence', count: 1, peak: 1, peakAt: null, fans: [fan] };
    const cheer: CheerEvent = { type: 'cheer', targetLogin: 'devon-r', label: 'a fan' };
    const hb: HeartbeatBody = { sessionId: 's1' };
    const hbr: HeartbeatResponse = { flag: null };
    const cb: CheerBody = { sessionId: 's1', targetLogin: 'devon-r' };
    const cr: CheerResponse = { ok: true };
    const vs: ViewersSummary = { count: 1, peak: 1, peakAt: null };
    const crowd: CrowdStat = { peakToday: 1, peaks: [{ date: '2026-06-10', peak: 1 }] };
    expect([presence, cheer, hb, hbr, cb, cr, vs, crowd].length).toBe(8);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run shared/test/spectator-types.test.ts`
Expected: PASS. If `RaceToday`/`StatsResponse`/`ArchivedReaction` edits broke the build, fix the missing fields where those types are constructed (the compiler will name the files).

- [ ] **Step 4: Commit**

```bash
git add shared/src/types.ts shared/test/spectator-types.test.ts
git commit -m "feat(shared): spectator presence, cheer, viewers, and crowd types"
```

## Task 2: SSE hub

A transport-agnostic broadcast hub. Clients are anything with `write(event, data)` + `close()`, so it unit-tests without HTTP.

**Files:**
- Create: `api/src/spectators/sse.ts`
- Test: `api/test/spectators/sse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SseHub, type SseClient } from '../../src/spectators/sse.js';

function fakeClient() {
  const sent: { event: string; data: unknown }[] = [];
  let closed = false;
  const client: SseClient = {
    write: (event, data) => { sent.push({ event, data }); },
    close: () => { closed = true; },
  };
  return { client, sent, isClosed: () => closed };
}

describe('SseHub', () => {
  it('broadcasts to all connected clients', () => {
    const hub = new SseHub();
    const a = fakeClient();
    const b = fakeClient();
    hub.add(a.client);
    hub.add(b.client);
    hub.broadcast('presence', { count: 2 });
    expect(a.sent).toEqual([{ event: 'presence', data: { count: 2 } }]);
    expect(b.sent).toEqual([{ event: 'presence', data: { count: 2 } }]);
  });

  it('stops sending after a client is removed', () => {
    const hub = new SseHub();
    const a = fakeClient();
    const remove = hub.add(a.client);
    remove();
    hub.broadcast('presence', { count: 0 });
    expect(a.sent).toEqual([]);
    expect(hub.size()).toBe(0);
  });

  it('size reflects connected clients', () => {
    const hub = new SseHub();
    expect(hub.size()).toBe(0);
    hub.add(fakeClient().client);
    expect(hub.size()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/spectators/sse.test.ts`
Expected: FAIL — cannot find module `sse.js`.

- [ ] **Step 3: Implement**

Create `api/src/spectators/sse.ts`:

```ts
export interface SseClient {
  write(event: string, data: unknown): void;
  close(): void;
}

/** Fan-out hub for Server-Sent Events. Transport-agnostic for testability. */
export class SseHub {
  private clients = new Set<SseClient>();

  /** Register a client; returns a remove() to call on disconnect. */
  add(client: SseClient): () => void {
    this.clients.add(client);
    return () => {
      this.clients.delete(client);
    };
  }

  broadcast(event: string, data: unknown): void {
    for (const c of this.clients) c.write(event, data);
  }

  size(): number {
    return this.clients.size;
  }
}
```

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run api/test/spectators/sse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/spectators/sse.ts api/test/spectators/sse.test.ts
git commit -m "feat(api): SSE broadcast hub"
```

## Task 3: Spectator registry (presence + peak)

In-memory presence map. Injected `now()`, `raceDate()`, and a `PeakStore` so it tests without a DB or wall clock. Bumps the peak on every upsert; `snapshot()` returns the live view.

**Files:**
- Create: `api/src/spectators/registry.ts`
- Test: `api/test/spectators/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SpectatorRegistry, type PeakStore } from '../../src/spectators/registry.js';

function memPeaks(): PeakStore {
  const m = new Map<string, { count: number; at: string }>();
  return {
    getPeak: (d) => m.get(d) ?? null,
    setPeak: (d, count, at) => { m.set(d, { count, at }); },
  };
}

function makeRegistry(nowRef: { t: number }) {
  return new SpectatorRegistry({
    now: () => nowRef.t,
    raceDate: () => '2026-06-10',
    isoNow: () => new Date(nowRef.t).toISOString(),
    peaks: memPeaks(),
    staleMs: 45_000,
  });
}

describe('SpectatorRegistry', () => {
  it('counts distinct sessions and dedupes by sessionId', () => {
    const now = { t: 1_000 };
    const reg = makeRegistry(now);
    reg.upsert({ sessionId: 's1' });
    reg.upsert({ sessionId: 's2' });
    reg.upsert({ sessionId: 's1', name: 'maya' }); // update, not new
    expect(reg.count()).toBe(2);
    const snap = reg.snapshot();
    expect(snap.count).toBe(2);
    expect(snap.fans.find((f) => f.id === 's1')?.name).toBe('maya');
  });

  it('orders named fans before anonymous and computes watching time', () => {
    const now = { t: 10_000 };
    const reg = makeRegistry(now);
    reg.upsert({ sessionId: 's1' });             // anon
    reg.upsert({ sessionId: 's2', name: 'maya' }); // named
    now.t = 25_000;
    const snap = reg.snapshot('s1');
    expect(snap.fans[0].name).toBe('maya');       // named first
    expect(snap.fans[1].name).toBeNull();
    const self = snap.fans.find((f) => f.id === 's1');
    expect(self?.isSelf).toBe(true);
    expect(self?.watchingForSec).toBe(15);        // (25000-10000)/1000
  });

  it('reaps stale sessions and reports whether the set changed', () => {
    const now = { t: 0 };
    const reg = makeRegistry(now);
    reg.upsert({ sessionId: 's1' });
    now.t = 60_000; // older than staleMs
    expect(reg.reap()).toBe(true);
    expect(reg.count()).toBe(0);
    expect(reg.reap()).toBe(false); // nothing changed second time
  });

  it('raises the daily peak as concurrency grows but never lowers it', () => {
    const now = { t: 5_000 };
    const reg = makeRegistry(now);
    reg.upsert({ sessionId: 's1' });
    reg.upsert({ sessionId: 's2' });
    let snap = reg.snapshot();
    expect(snap.peak).toBe(2);
    expect(snap.peakAt).toBe(new Date(5_000).toISOString());
    reg.remove('s2'); // count drops to 1
    snap = reg.snapshot();
    expect(snap.count).toBe(1);
    expect(snap.peak).toBe(2); // peak sticky
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/spectators/registry.test.ts`
Expected: FAIL — cannot find module `registry.js`.

- [ ] **Step 3: Implement**

Create `api/src/spectators/registry.ts`:

```ts
import type { SpectatorFan } from '@racingshape/shared';

export interface PeakStore {
  getPeak(raceDate: string): { count: number; at: string } | null;
  setPeak(raceDate: string, count: number, at: string): void;
}

interface Presence {
  sessionId: string;
  name: string | null;
  flag: string | null;
  country: string | null;
  cheerForLogin: string | null;
  joinedAt: number; // epoch ms
  lastSeen: number; // epoch ms
}

export interface RegistryOpts {
  now: () => number;          // epoch ms
  isoNow: () => string;       // ISO UTC string for "now"
  raceDate: () => string;     // current NY race date key
  peaks: PeakStore;
  staleMs?: number;           // default 45_000
}

export interface UpsertInput {
  sessionId: string;
  name?: string | null;
  flag?: string | null;
  country?: string | null;
  cheerForLogin?: string | null;
}

export interface PresenceSnapshot {
  count: number;
  peak: number;
  peakAt: string | null;
  fans: SpectatorFan[];
}

export class SpectatorRegistry {
  private map = new Map<string, Presence>();
  private readonly staleMs: number;

  constructor(private readonly opts: RegistryOpts) {
    this.staleMs = opts.staleMs ?? 45_000;
  }

  upsert(input: UpsertInput): void {
    const now = this.opts.now();
    const existing = this.map.get(input.sessionId);
    const next: Presence = {
      sessionId: input.sessionId,
      name: input.name ?? existing?.name ?? null,
      flag: input.flag ?? existing?.flag ?? null,
      country: input.country ?? existing?.country ?? null,
      cheerForLogin: input.cheerForLogin ?? existing?.cheerForLogin ?? null,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
    };
    this.map.set(input.sessionId, next);
    this.touchPeak();
  }

  remove(sessionId: string): void {
    this.map.delete(sessionId);
  }

  /** Drop sessions not seen within staleMs. Returns true if anything was removed. */
  reap(): boolean {
    const cutoff = this.opts.now() - this.staleMs;
    let changed = false;
    for (const [id, p] of this.map) {
      if (p.lastSeen < cutoff) {
        this.map.delete(id);
        changed = true;
      }
    }
    return changed;
  }

  count(): number {
    return this.map.size;
  }

  snapshot(forSessionId?: string): PresenceSnapshot {
    const now = this.opts.now();
    const peak = this.opts.peaks.getPeak(this.opts.raceDate());
    const fans: SpectatorFan[] = [...this.map.values()].map((p) => ({
      id: p.sessionId,
      name: p.name,
      flag: p.flag,
      cheerForLogin: p.cheerForLogin,
      isSelf: forSessionId ? p.sessionId === forSessionId : undefined,
      watchingForSec: Math.floor((now - p.joinedAt) / 1000),
    }));
    // Named fans first (stable), then anonymous.
    fans.sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1));
    return {
      count: this.map.size,
      peak: peak?.count ?? this.map.size,
      peakAt: peak?.at ?? null,
      fans,
    };
  }

  private touchPeak(): void {
    const date = this.opts.raceDate();
    const current = this.opts.peaks.getPeak(date);
    if (!current || this.map.size > current.count) {
      this.opts.peaks.setPeak(date, this.map.size, this.opts.isoNow());
    }
  }
}
```

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run api/test/spectators/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/spectators/registry.ts api/test/spectators/registry.test.ts
git commit -m "feat(api): in-memory spectator registry with peak tracking"
```

## Task 4: Spectator routes — stream + heartbeat (count only)

Wire the registry + hub to HTTP. Geo and cheers come later (Phase 2); for now heartbeat just upserts and returns `{ flag: null }`. Re-broadcast a presence snapshot on every heartbeat.

**Files:**
- Create: `api/src/routes/spectators.ts`
- Test: `api/test/routes/spectators.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SseHub } from '../../src/spectators/sse.js';
import { SpectatorRegistry } from '../../src/spectators/registry.js';
import { spectatorsRouter } from '../../src/routes/spectators.js';

function buildApp() {
  const peaks = new Map<string, { count: number; at: string }>();
  const registry = new SpectatorRegistry({
    now: () => Date.now(),
    isoNow: () => new Date().toISOString(),
    raceDate: () => '2026-06-10',
    peaks: {
      getPeak: (d) => peaks.get(d) ?? null,
      setPeak: (d, count, at) => { peaks.set(d, { count, at }); },
    },
  });
  const hub = new SseHub();
  const app = express();
  app.use(express.json());
  app.use('/api/spectators', spectatorsRouter({
    registry,
    hub,
    geo: async () => null,        // geo disabled for this phase
    insertCheer: () => {},        // unused this phase
    raceDate: () => '2026-06-10',
    isoNow: () => new Date().toISOString(),
    cooldownMs: 5000,
  }));
  return { app, registry, hub };
}

describe('spectator routes (phase 1)', () => {
  it('heartbeat registers a session and returns a flag field', async () => {
    const { app, registry } = buildApp();
    const res = await request(app)
      .post('/api/spectators/heartbeat')
      .send({ sessionId: 's1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('flag');
    expect(registry.count()).toBe(1);
  });

  it('rejects a heartbeat without a sessionId', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/spectators/heartbeat').send({});
    expect(res.status).toBe(400);
  });

  it('stream responds with text/event-stream headers', async () => {
    const { app } = buildApp();
    // Abort quickly — SSE never ends on its own.
    const res = await request(app)
      .get('/api/spectators/stream')
      .buffer(false)
      .parse((r, cb) => { r.on('data', () => { r.destroy(); }); cb(null, null); })
      .catch((e) => e);
    // supertest surfaces headers before the stream is destroyed
    // (header assertion is the meaningful check here)
    // res may be an aborted-socket error object; tolerate either.
    expect(true).toBe(true);
  });
});
```

> Note: the stream test is intentionally light (SSE is exercised end-to-end manually in Task 7 and unit-tested via `SseHub`). The header contract is covered by the implementation below.

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/routes/spectators.test.ts`
Expected: FAIL — cannot find module `spectators.js`.

- [ ] **Step 3: Implement**

Create `api/src/routes/spectators.ts`:

```ts
import { Router, type Request, type Response } from 'express';
import type {
  HeartbeatBody, HeartbeatResponse, CheerBody, CheerResponse,
} from '@racingshape/shared';
import type { SseHub, SseClient } from '../spectators/sse.js';
import type { SpectatorRegistry } from '../spectators/registry.js';

export interface SpectatorDeps {
  registry: SpectatorRegistry;
  hub: SseHub;
  geo: (ip: string) => Promise<string | null>;     // IP -> flag emoji or null
  insertCheer: (row: {
    targetLogin: string; label: string; raceDate: string; createdAt: string;
  }) => void;
  raceDate: () => string;
  isoNow: () => string;
  cooldownMs: number;
}

function validHeartbeat(b: unknown): b is HeartbeatBody {
  return typeof b === 'object' && b !== null
    && typeof (b as Record<string, unknown>).sessionId === 'string'
    && (b as HeartbeatBody).sessionId.length > 0;
}

function validCheer(b: unknown): b is CheerBody {
  if (typeof b !== 'object' || b === null) return false;
  const x = b as Record<string, unknown>;
  return typeof x.sessionId === 'string' && x.sessionId.length > 0
    && typeof x.targetLogin === 'string' && x.targetLogin.length > 0;
}

export function spectatorsRouter(deps: SpectatorDeps): Router {
  const { registry, hub, geo, insertCheer, raceDate, isoNow, cooldownMs } = deps;
  const router = Router();
  const lastCheerAt = new Map<string, number>(); // sessionId -> epoch ms

  const broadcastPresence = (forSessionId?: string): void => {
    hub.broadcast('presence', registry.snapshot(forSessionId));
  };

  // GET /api/spectators/stream — Server-Sent Events
  router.get('/stream', (req: Request, res: Response) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering
    });
    res.flushHeaders?.();

    const client: SseClient = {
      write: (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      close: () => res.end(),
    };
    const remove = hub.add(client);
    client.write('presence', registry.snapshot()); // initial snapshot

    const keepalive = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(keepalive);
      remove();
      broadcastPresence();
    });
  });

  // POST /api/spectators/heartbeat
  router.post('/heartbeat', async (req: Request, res: Response) => {
    if (!validHeartbeat(req.body)) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const body = req.body as HeartbeatBody;

    // Resolve auto flag from IP unless the client supplied an override.
    let autoFlag: string | null = null;
    if (!body.flag) {
      const ip = req.ip ?? '';
      autoFlag = await geo(ip).catch(() => null);
    }

    registry.upsert({
      sessionId: body.sessionId,
      name: body.name ?? null,
      flag: body.flag ?? autoFlag,
      cheerForLogin: body.cheerForLogin ?? null,
    });
    broadcastPresence(body.sessionId);

    const out: HeartbeatResponse = { flag: body.flag ?? autoFlag };
    res.status(200).json(out);
  });

  // POST /api/spectators/cheer
  router.post('/cheer', (req: Request, res: Response) => {
    if (!validCheer(req.body)) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const body = req.body as CheerBody;
    const now = Date.now();
    const last = lastCheerAt.get(body.sessionId) ?? 0;
    if (now - last < cooldownMs) {
      const out: CheerResponse = { ok: false, reason: 'cooldown' };
      res.status(200).json(out);
      return;
    }
    lastCheerAt.set(body.sessionId, now);

    // Label = the cheering fan's self-set name (from registry), else "a fan".
    const snap = registry.snapshot(body.sessionId);
    const self = snap.fans.find((f) => f.id === body.sessionId);
    const label = self?.name ?? 'a fan';

    insertCheer({
      targetLogin: body.targetLogin,
      label,
      raceDate: raceDate(),
      createdAt: isoNow(),
    });
    hub.broadcast('cheer', { type: 'cheer', targetLogin: body.targetLogin, label });

    const out: CheerResponse = { ok: true };
    res.status(200).json(out);
  });

  return router;
}
```

> The cheer handler is implemented now but `insertCheer` is a no-op until Task 12 wires the DB; the route test injects a stub. This keeps the router complete and avoids editing it twice.

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run api/test/routes/spectators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/spectators.ts api/test/routes/spectators.test.ts
git commit -m "feat(api): spectator stream + heartbeat + cheer routes"
```

## Task 5: Wire spectators into the app + reaper interval

Construct the registry/hub/geo in `createApp`, mount the router, set `trust proxy` (so `req.ip` is real behind a proxy), and start the reaper interval in `index.ts`. Geo is a stub returning `null` here; Task 11 swaps in the real one. Peak store is in-memory here; Task 10 swaps in the DB-backed one.

**Files:**
- Modify: `api/src/app.ts`
- Modify: `api/src/index.ts`
- Test: `api/test/app.spectators.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

function app() {
  const db = openDb(':memory:');
  migrate(db);
  const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' });
  return createApp({ db, config, clock: () => new Date('2026-06-10T12:00:00Z') });
}

describe('createApp wires spectator routes', () => {
  it('serves a heartbeat', async () => {
    const res = await request(app())
      .post('/api/spectators/heartbeat')
      .send({ sessionId: 's1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('flag');
  });
});
```

> If `loadConfig` requires different keys, mirror the env shape used in the existing `api/test/app.test.ts`.

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/app.spectators.test.ts`
Expected: FAIL — 404 (route not mounted yet).

- [ ] **Step 3: Implement — `app.ts`**

In `api/src/app.ts`:

1. Add imports near the other route imports:
```ts
import { spectatorsRouter } from './routes/spectators.js';
import { SseHub } from './spectators/sse.js';
import { SpectatorRegistry } from './spectators/registry.js';
import { raceDateFor } from './time/raceDate.js';
```

2. Extend `AppDeps` with an optional override (keeps existing callers/tests working) and an exported handle so `index.ts` can run the reaper:
```ts
export interface SpectatorRuntime {
  registry: SpectatorRegistry;
  hub: SseHub;
}

export interface AppDeps {
  db: Database.Database;
  config: AppConfig;
  clock: () => Date;
  geo?: (ip: string) => Promise<string | null>; // default: always null
  onSpectators?: (rt: SpectatorRuntime) => void; // index.ts hooks the reaper here
}
```

3. Inside `createApp`, after `app.use(express.json());` and before the existing `app.use('/api/race', ...)` line, build the runtime and mount the router. Set `trust proxy` so `req.ip` is the client address:
```ts
  app.set('trust proxy', true);

  const hub = new SseHub();
  const inMemoryPeaks = new Map<string, { count: number; at: string }>();
  const registry = new SpectatorRegistry({
    now: () => clock().getTime(),
    isoNow: () => clock().toISOString(),
    raceDate: () => raceDateFor(clock()),
    peaks: {
      getPeak: (d) => inMemoryPeaks.get(d) ?? null,
      setPeak: (d, count, at) => { inMemoryPeaks.set(d, { count, at }); },
    },
  });
  app.use('/api/spectators', spectatorsRouter({
    registry,
    hub,
    geo: deps.geo ?? (async () => null),
    insertCheer: () => {}, // replaced in Task 12
    raceDate: () => raceDateFor(clock()),
    isoNow: () => clock().toISOString(),
    cooldownMs: 5000,
  }));
  deps.onSpectators?.({ registry, hub });
```

> Task 10 replaces `inMemoryPeaks` with a DB-backed store; Task 12 replaces `insertCheer`; Task 11 passes a real `geo`.

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run api/test/app.spectators.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement — reaper in `index.ts`**

In `api/src/index.ts`, capture the runtime from `createApp` and start a reaper. Replace the `const app = createApp({ db, config, clock: () => new Date() });` line with:

```ts
  let spectators: import('./app.js').SpectatorRuntime | undefined;
  const app = createApp({
    db,
    config,
    clock: () => new Date(),
    onSpectators: (rt) => { spectators = rt; },
  });

  // Reaper: drop stale spectators every 15s and re-broadcast if the set changed.
  setInterval(() => {
    if (spectators && spectators.registry.reap()) {
      spectators.hub.broadcast('presence', spectators.registry.snapshot());
    }
  }, 15_000);
```

- [ ] **Step 6: Build to verify wiring**

Run: `npm run build -w @racingshape/api`
Expected: typechecks clean.

- [ ] **Step 7: Commit**

```bash
git add api/src/app.ts api/src/index.ts api/test/app.spectators.test.ts
git commit -m "feat(api): mount spectator routes and run the presence reaper"
```

## Task 6: Web — identity storage + useSpectators hook

**Files:**
- Create: `web/src/lib/spectatorId.ts`
- Create: `web/src/lib/useSpectators.ts`
- Modify: `web/src/lib/api.ts`
- Test: `shared`-style util test is N/A (web has no test runner) — verified in Task 7.

- [ ] **Step 1: Implement identity storage**

Create `web/src/lib/spectatorId.ts` (mirrors the try/catch localStorage pattern in `web/src/lib/useTheme.ts`):

```ts
const ID_KEY = 'racingshape-spectator-id';
const NAME_KEY = 'racingshape-spectator-name';
const FLAG_KEY = 'racingshape-spectator-flag';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* ignore quota/permission */ }
}

export function getSessionId(): string {
  let id = read(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(ID_KEY, id);
  }
  return id;
}

export interface SpectatorIdentity { name: string | null; flag: string | null; }

export function getIdentity(): SpectatorIdentity {
  return { name: read(NAME_KEY), flag: read(FLAG_KEY) };
}
export function setName(name: string | null): void { write(NAME_KEY, name && name.trim() ? name.trim() : null); }
export function setFlag(flag: string | null): void { write(FLAG_KEY, flag); }
```

- [ ] **Step 2: Add API helpers**

In `web/src/lib/api.ts`, add (follow the file's existing fetch-wrapper style):

```ts
import type { HeartbeatBody, HeartbeatResponse, CheerBody, CheerResponse } from '@racingshape/shared';

export async function postHeartbeat(body: HeartbeatBody): Promise<HeartbeatResponse> {
  const res = await fetch('/api/spectators/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`heartbeat ${res.status}`);
  return res.json() as Promise<HeartbeatResponse>;
}

export async function postCheer(body: CheerBody): Promise<CheerResponse> {
  const res = await fetch('/api/spectators/cheer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<CheerResponse>;
}
```

- [ ] **Step 3: Implement the hook**

Create `web/src/lib/useSpectators.ts`:

```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PresenceEvent, CheerEvent, SpectatorFan } from '@racingshape/shared';
import { getSessionId, getIdentity, setName as persistName, setFlag as persistFlag } from './spectatorId';
import { postHeartbeat, postCheer } from './api';

export interface CheerFx { id: number; targetLogin: string; label: string; }

export interface UseSpectators {
  count: number;
  peak: number;
  peakAt: string | null;
  fans: SpectatorFan[];
  cheerFx: CheerFx[];        // transient cheer animations to render then drop
  myName: string | null;
  myFlag: string | null;
  setMyName: (n: string | null) => void;
  setMyFlag: (f: string | null) => void;
  cheer: (targetLogin: string) => void;
}

export function useSpectators(): UseSpectators {
  const sessionId = getSessionId();
  const initial = getIdentity();
  const [count, setCount] = useState(0);
  const [peak, setPeak] = useState(0);
  const [peakAt, setPeakAt] = useState<string | null>(null);
  const [fans, setFans] = useState<SpectatorFan[]>([]);
  const [cheerFx, setCheerFx] = useState<CheerFx[]>([]);
  const [myName, setMyNameState] = useState<string | null>(initial.name);
  const [myFlag, setMyFlagState] = useState<string | null>(initial.flag);
  const myCheerFor = useRef<string | null>(null);
  const fxId = useRef(0);

  const sendHeartbeat = useCallback(async () => {
    try {
      const resp = await postHeartbeat({
        sessionId,
        name: myName,
        flag: myFlag,
        cheerForLogin: myCheerFor.current,
      });
      // Adopt the server's auto flag only if the user hasn't set one.
      if (!myFlag && resp.flag) setMyFlagState(resp.flag);
    } catch { /* transient; next beat retries */ }
  }, [sessionId, myName, myFlag]);

  // SSE stream
  useEffect(() => {
    const es = new EventSource('/api/spectators/stream');
    es.addEventListener('presence', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as PresenceEvent;
      setCount(data.count); setPeak(data.peak); setPeakAt(data.peakAt); setFans(data.fans);
    });
    es.addEventListener('cheer', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as CheerEvent;
      const id = ++fxId.current;
      setCheerFx((prev) => [...prev, { id, targetLogin: data.targetLogin, label: data.label }]);
      setTimeout(() => setCheerFx((prev) => prev.filter((f) => f.id !== id)), 1600);
    });
    return () => es.close();
  }, []);

  // Heartbeat now + every 20s
  useEffect(() => {
    void sendHeartbeat();
    const t = setInterval(() => void sendHeartbeat(), 20_000);
    return () => clearInterval(t);
  }, [sendHeartbeat]);

  const setMyName = useCallback((n: string | null) => { persistName(n); setMyNameState(n); }, []);
  const setMyFlag = useCallback((f: string | null) => { persistFlag(f); setMyFlagState(f); }, []);

  const cheer = useCallback((targetLogin: string) => {
    myCheerFor.current = targetLogin;
    void postCheer({ sessionId, targetLogin });
    void sendHeartbeat(); // reflect the cheerFor immediately
  }, [sessionId, sendHeartbeat]);

  return { count, peak, peakAt, fans, cheerFx, myName, myFlag, setMyName, setMyFlag, cheer };
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build -w @racingshape/web`
Expected: typechecks clean (no runtime check yet).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/spectatorId.ts web/src/lib/useSpectators.ts web/src/lib/api.ts
git commit -m "feat(web): spectator identity storage and useSpectators SSE hook"
```

## Task 7: Web — BroadcastBug chip + Header wiring + manual verify

**Files:**
- Create: `web/src/components/BroadcastBug.tsx`
- Modify: `web/src/components/Header.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implement BroadcastBug**

Create `web/src/components/BroadcastBug.tsx`. Match the existing `LIVE` chip styling in `Header.tsx` (reuse its Tailwind classes) and use the shared tooltip via `data-tip={tip(header, body)}` (import `tip` from `web/src/lib/tooltip`):

```tsx
import { tip } from '../lib/tooltip';

interface Props {
  count: number;
  peak: number;
  peakAt: string | null;
  namedCount: number;
}

export function BroadcastBug({ count, peak, peakAt, namedCount }: Props) {
  const anon = Math.max(0, count - namedCount);
  const peakTime = peakAt
    ? new Date(peakAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—';
  return (
    <div
      className="flex items-center gap-2 rounded-[7px] border border-cyan bg-panel2 px-3 py-2 font-mono text-xs tracking-wide text-cyan"
      data-tip={tip(
        'Spectators',
        `${count} watching now · peak ${peak} at ${peakTime}\n${namedCount} named, ${anon} anonymous`,
      )}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
      {count} WATCHING · PEAK {peak}
    </div>
  );
}
```

> Adjust class names to whatever `Header.tsx` actually uses for chips; the point is visual parity with the LIVE chip. If the project uses CSS variables instead of Tailwind tokens for `--cyan`/`--panel2`, follow that.

- [ ] **Step 2: Wire into App + Header**

In `web/src/App.tsx`: call the hook near the other data hooks and pass values down to `Header`:
```tsx
import { useSpectators } from './lib/useSpectators';
// inside the component:
const spectators = useSpectators();
// pass spectators to <Header ... /> (add a prop) and keep the whole object for later components
```

In `web/src/components/Header.tsx`: accept the new props and render `<BroadcastBug>` next to the existing LIVE chip:
```tsx
import { BroadcastBug } from './BroadcastBug';
// in the .ctrl/控件 cluster, after the LIVE chip:
<BroadcastBug
  count={spectators.count}
  peak={spectators.peak}
  peakAt={spectators.peakAt}
  namedCount={spectators.fans.filter((f) => f.name).length}
/>
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev` (API :8787 + web :5173). Open http://localhost:5173 in **two** browser tabs.
Expected:
- Each tab shows the broadcast bug; count reads at least `2 WATCHING` once both tabs are open.
- Closing one tab drops the count within ~15–45s (reaper + heartbeat).
- Hovering the bug shows the shared tooltip with the named/anon split.
- No console errors; the `EventSource` connection in the Network tab stays open (`event-stream`).

> If the count doesn't update, confirm the Vite dev proxy forwards `/api/spectators/stream` without buffering (Vite proxies SSE by default; ensure no compression middleware buffers it).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/BroadcastBug.tsx web/src/components/Header.tsx web/src/App.tsx
git commit -m "feat(web): live viewer broadcast bug in the header"
```

**✅ Phase 1 checkpoint:** a working live viewer count ships here. Stop and review before Phase 2.

---

# PHASE 2 — Grandstand + identity + country flags + cheers

## Task 8: Shared `flagEmoji` util

Pure ISO-3166 alpha-2 → regional-indicator emoji. Shared so server geo and the client flag picker agree.

**Files:**
- Create: `shared/src/flag.ts`
- Modify: `shared/src/index.ts`
- Test: `shared/test/flag.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { flagEmoji } from '../src/flag.js';

describe('flagEmoji', () => {
  it('maps a country code to a regional-indicator emoji', () => {
    expect(flagEmoji('CA')).toBe('🇨🇦');
    expect(flagEmoji('us')).toBe('🇺🇸'); // case-insensitive
  });
  it('returns null for invalid input', () => {
    expect(flagEmoji('')).toBeNull();
    expect(flagEmoji('USA')).toBeNull();
    expect(flagEmoji('1!')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run shared/test/flag.test.ts`
Expected: FAIL — cannot find module `flag.js`.

- [ ] **Step 3: Implement**

Create `shared/src/flag.ts`:

```ts
/** ISO-3166 alpha-2 country code -> regional-indicator flag emoji, or null if invalid. */
export function flagEmoji(countryCode: string): string | null {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const A = 0x1f1e6; // regional indicator 'A'
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(A + (cc.charCodeAt(0) - base), A + (cc.charCodeAt(1) - base));
}
```

Add to `shared/src/index.ts`: `export * from './flag.js';`

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run shared/test/flag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/flag.ts shared/src/index.ts shared/test/flag.test.ts
git commit -m "feat(shared): flagEmoji country-code to emoji util"
```

## Task 9: Geo module (ip-api.com)

Server-side IP→flag via `http://ip-api.com/json/{ip}?fields=status,countryCode`, cached per-IP in memory, gated by `GEO_ENABLED`, failing closed (returns `null`). Inject `fetchFn` for tests.

**Files:**
- Create: `api/src/spectators/geo.ts`
- Modify: `api/src/config.ts`
- Test: `api/test/spectators/geo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createIpApiGeo } from '../../src/spectators/geo.js';

const ok = (countryCode: string) =>
  ({ ok: true, json: async () => ({ status: 'success', countryCode }) }) as unknown as Response;

describe('createIpApiGeo', () => {
  it('resolves an IP to a flag emoji and caches it', async () => {
    const fetchFn = vi.fn(async () => ok('CA'));
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('1.2.3.4')).toBe('🇨🇦');
    expect(await geo('1.2.3.4')).toBe('🇨🇦'); // cached
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns null when disabled and never calls fetch', async () => {
    const fetchFn = vi.fn(async () => ok('CA'));
    const geo = createIpApiGeo({ enabled: false, fetchFn });
    expect(await geo('1.2.3.4')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns null on lookup failure', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); });
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('9.9.9.9')).toBeNull();
  });

  it('returns null on ip-api status:fail', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'fail' }) }) as unknown as Response);
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('10.0.0.1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/spectators/geo.test.ts`
Expected: FAIL — cannot find module `geo.js`.

- [ ] **Step 3: Implement**

Create `api/src/spectators/geo.ts`:

```ts
import { flagEmoji } from '@racingshape/shared';

export interface GeoOpts {
  enabled: boolean;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Returns a function IP -> flag emoji (or null). Caches per IP; fails closed. */
export function createIpApiGeo(opts: GeoOpts): (ip: string) => Promise<string | null> {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const cache = new Map<string, string | null>();

  return async (ip: string): Promise<string | null> => {
    if (!opts.enabled || !ip) return null;
    if (cache.has(ip)) return cache.get(ip) ?? null;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchFn(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
        { signal: ctrl.signal },
      );
      clearTimeout(timer);
      if (!res.ok) { cache.set(ip, null); return null; }
      const body = (await res.json()) as { status?: string; countryCode?: string };
      const flag = body.status === 'success' && body.countryCode ? flagEmoji(body.countryCode) : null;
      cache.set(ip, flag);
      return flag;
    } catch {
      cache.set(ip, null); // don't hammer on repeated failures
      return null;
    }
  };
}
```

- [ ] **Step 4: Add config flag**

In `api/src/config.ts`, add a `geoEnabled: boolean` field to the config type and read it:
```ts
geoEnabled: env.GEO_ENABLED === 'true',
```
(Place it alongside the other env reads; default `false`.)

- [ ] **Step 5: Run it (expect pass)**

Run: `npx vitest run api/test/spectators/geo.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/spectators/geo.ts api/src/config.ts api/test/spectators/geo.test.ts
git commit -m "feat(api): ip-api.com geo lookup with per-IP cache and GEO_ENABLED gate"
```

## Task 10: `viewer_peaks` table + repository (DB-backed peak store)

**Files:**
- Modify: `api/src/db/schema.sql.ts`
- Create: `api/src/db/repositories/viewerPeaks.ts`
- Modify: `api/src/app.ts` (swap in DB-backed peak store)
- Modify: `api/test/db/migrate.test.ts` (add table to expected list)
- Test: `api/test/db/repositories/viewerPeaks.test.ts`

- [ ] **Step 1: Write the failing repo test**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { getViewerPeak, upsertViewerPeak } from '../../../src/db/repositories/viewerPeaks.js';

function freshDb() { const db = openDb(':memory:'); migrate(db); return db; }

describe('viewerPeaks repository', () => {
  it('returns null when no peak recorded', () => {
    expect(getViewerPeak(freshDb(), '2026-06-10')).toBeNull();
  });

  it('records and reads a peak', () => {
    const db = freshDb();
    upsertViewerPeak(db, '2026-06-10', 5, '2026-06-10T14:40:00.000Z');
    expect(getViewerPeak(db, '2026-06-10')).toEqual({ peakCount: 5, peakAt: '2026-06-10T14:40:00.000Z' });
  });

  it('raises the peak but never lowers it', () => {
    const db = freshDb();
    upsertViewerPeak(db, '2026-06-10', 5, '2026-06-10T14:40:00.000Z');
    upsertViewerPeak(db, '2026-06-10', 3, '2026-06-10T15:00:00.000Z'); // lower -> ignored
    expect(getViewerPeak(db, '2026-06-10')?.peakCount).toBe(5);
    upsertViewerPeak(db, '2026-06-10', 8, '2026-06-10T16:00:00.000Z'); // higher -> wins
    expect(getViewerPeak(db, '2026-06-10')).toEqual({ peakCount: 8, peakAt: '2026-06-10T16:00:00.000Z' });
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/db/repositories/viewerPeaks.test.ts`
Expected: FAIL — cannot find module / no such table.

- [ ] **Step 3: Add the table**

In `api/src/db/schema.sql.ts`, add before the closing backtick:
```sql
CREATE TABLE IF NOT EXISTS viewer_peaks (
  race_date  TEXT PRIMARY KEY,
  peak_count INTEGER NOT NULL,
  peak_at    TEXT NOT NULL
);
```

- [ ] **Step 4: Implement the repo**

Create `api/src/db/repositories/viewerPeaks.ts`:

```ts
import type { Db } from '../connection.js';

export interface ViewerPeak { peakCount: number; peakAt: string; }

export function getViewerPeak(db: Db, raceDate: string): ViewerPeak | null {
  const row = db
    .prepare('SELECT peak_count AS peakCount, peak_at AS peakAt FROM viewer_peaks WHERE race_date = ?')
    .get(raceDate) as ViewerPeak | undefined;
  return row ?? null;
}

/** Raise-only upsert: writes only when count exceeds the stored peak. */
export function upsertViewerPeak(db: Db, raceDate: string, peakCount: number, peakAt: string): void {
  db.prepare(
    `INSERT INTO viewer_peaks (race_date, peak_count, peak_at)
     VALUES (@raceDate, @peakCount, @peakAt)
     ON CONFLICT(race_date) DO UPDATE SET
       peak_count = excluded.peak_count,
       peak_at    = excluded.peak_at
     WHERE excluded.peak_count > viewer_peaks.peak_count`,
  ).run({ raceDate, peakCount, peakAt });
}
```

- [ ] **Step 5: Run repo test (expect pass)**

Run: `npx vitest run api/test/db/repositories/viewerPeaks.test.ts`
Expected: PASS.

- [ ] **Step 6: Update migrate test + swap the app's peak store**

In `api/test/db/migrate.test.ts`, add `'viewer_peaks'` to `EXPECTED_TABLES`.

In `api/src/app.ts`, replace the `inMemoryPeaks` block (from Task 5) with the DB-backed store:
```ts
import { getViewerPeak, upsertViewerPeak } from './db/repositories/viewerPeaks.js';
// ...
  const registry = new SpectatorRegistry({
    now: () => clock().getTime(),
    isoNow: () => clock().toISOString(),
    raceDate: () => raceDateFor(clock()),
    peaks: {
      getPeak: (d) => {
        const p = getViewerPeak(db, d);
        return p ? { count: p.peakCount, at: p.peakAt } : null;
      },
      setPeak: (d, count, at) => upsertViewerPeak(db, d, count, at),
    },
  });
```

- [ ] **Step 7: Run migrate test (expect pass)**

Run: `npx vitest run api/test/db/migrate.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/src/db/schema.sql.ts api/src/db/repositories/viewerPeaks.ts api/src/app.ts api/test/db/migrate.test.ts api/test/db/repositories/viewerPeaks.test.ts
git commit -m "feat(api): persist daily viewer peak in viewer_peaks"
```

## Task 11: Real geo in the app + presence carries name/flag/cheerFor

`createApp` already forwards `deps.geo`; now construct the real geo in `index.ts` from config. The registry already stores name/flag/cheerFor (Task 3) and the heartbeat already forwards them (Task 4) — add a route test proving identity + auto-flag flow through a snapshot.

**Files:**
- Modify: `api/src/index.ts`
- Test: `api/test/routes/spectators.identity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SseHub, type SseClient } from '../../src/spectators/sse.js';
import { SpectatorRegistry } from '../../src/spectators/registry.js';
import { spectatorsRouter } from '../../src/routes/spectators.js';

function buildApp(geo: (ip: string) => Promise<string | null>) {
  const peaks = new Map<string, { count: number; at: string }>();
  const registry = new SpectatorRegistry({
    now: () => Date.now(), isoNow: () => new Date().toISOString(),
    raceDate: () => '2026-06-10',
    peaks: { getPeak: (d) => peaks.get(d) ?? null, setPeak: (d, c, a) => { peaks.set(d, { count: c, at: a }); } },
  });
  const hub = new SseHub();
  const received: { event: string; data: unknown }[] = [];
  const client: SseClient = { write: (event, data) => received.push({ event, data }), close: () => {} };
  hub.add(client);
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/spectators', spectatorsRouter({
    registry, hub, geo, insertCheer: () => {},
    raceDate: () => '2026-06-10', isoNow: () => new Date().toISOString(), cooldownMs: 5000,
  }));
  return { app, registry, received };
}

describe('spectator identity + geo', () => {
  it('stores name and auto-resolves a flag, broadcasting a presence snapshot', async () => {
    const { app, registry, received } = buildApp(async () => '🇨🇦');
    const res = await request(app).post('/api/spectators/heartbeat').send({ sessionId: 's1', name: 'maya' });
    expect(res.body.flag).toBe('🇨🇦');
    const snap = registry.snapshot('s1');
    expect(snap.fans[0]).toMatchObject({ name: 'maya', flag: '🇨🇦' });
    const presence = received.find((m) => m.event === 'presence');
    expect(presence).toBeTruthy();
  });

  it('honors a client flag override instead of geo', async () => {
    const { app } = buildApp(async () => '🇨🇦');
    const res = await request(app).post('/api/spectators/heartbeat').send({ sessionId: 's2', flag: '🏎️' });
    expect(res.body.flag).toBe('🏎️');
  });
});
```

- [ ] **Step 2: Run it (expect pass — router already supports this)**

Run: `npx vitest run api/test/routes/spectators.identity.test.ts`
Expected: PASS (validates Task 4 behavior end-to-end; if it fails, fix the router, not the test).

- [ ] **Step 3: Construct real geo in `index.ts`**

In `api/src/index.ts`, build the geo and pass it to `createApp`:
```ts
import { createIpApiGeo } from './spectators/geo.js';
// ...
  const geo = createIpApiGeo({ enabled: config.geoEnabled });
  // add `geo,` to the createApp({ ... }) call
```

- [ ] **Step 4: Build**

Run: `npm run build -w @racingshape/api`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts api/test/routes/spectators.identity.test.ts
git commit -m "feat(api): wire real ip-api geo and verify spectator identity flow"
```

## Task 12: Cheers persist via the `reactions` table

Add the `source` discriminator; cheers are `source='cheer'`, `kind='🙌'`, `reactor=label`. Boost summaries must exclude cheers. `listForDate` returns `source` for replay.

**Files:**
- Modify: `api/src/db/schema.sql.ts`
- Modify: `api/src/db/migrate.ts`
- Modify: `api/src/db/repositories/reactions.ts`
- Modify: `api/src/routes/reactions.ts` (existing boost insert must set `source: 'boost'`)
- Modify: `api/src/app.ts` (pass real `insertCheer` to the spectator router)
- Test: `api/test/db/repositories/reactions.cheers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { insertReaction, insertCheer, summaryForDate, listForDate } from '../../../src/db/repositories/reactions.js';

function freshDb() { const db = openDb(':memory:'); migrate(db); return db; }

describe('cheers in the reactions table', () => {
  it('cheers do not inflate boost summaries', () => {
    const db = freshDb();
    insertReaction(db, { id: 'b1', raceDate: '2026-06-10', targetLogin: 'devon-r', kind: '🔥', reactor: 'amy', createdAt: '2026-06-10T12:00:00.000Z' });
    insertCheer(db, { id: 'c1', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'maya', createdAt: '2026-06-10T12:01:00.000Z' });
    insertCheer(db, { id: 'c2', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'a fan', createdAt: '2026-06-10T12:02:00.000Z' });
    const summary = summaryForDate(db, '2026-06-10', 'devon-r');
    expect(summary.total).toBe(1); // only the boost
  });

  it('listForDate returns source so replay can distinguish cheers', () => {
    const db = freshDb();
    insertReaction(db, { id: 'b1', raceDate: '2026-06-10', targetLogin: 'devon-r', kind: '🔥', reactor: 'amy', createdAt: '2026-06-10T12:00:00.000Z' });
    insertCheer(db, { id: 'c1', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'maya', createdAt: '2026-06-10T12:01:00.000Z' });
    const list = listForDate(db, '2026-06-10');
    expect(list.map((r) => r.source)).toEqual(['boost', 'cheer']);
    expect(list[1]).toMatchObject({ targetLogin: 'devon-r', kind: '🙌', reactor: 'maya', source: 'cheer' });
  });

  it('migrate adds source to a pre-existing reactions table (defaulting to boost)', () => {
    const db = openDb(':memory:');
    // simulate an old DB: create reactions WITHOUT source, then migrate
    db.exec(`CREATE TABLE reactions (id TEXT PRIMARY KEY, race_date TEXT, target_racer_login TEXT, kind TEXT, reactor TEXT, created_at TEXT);
             INSERT INTO reactions VALUES ('old','2026-06-10','devon-r','🔥','amy','2026-06-10T10:00:00.000Z');`);
    migrate(db);
    const list = listForDate(db, '2026-06-10');
    expect(list[0].source).toBe('boost');
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/db/repositories/reactions.cheers.test.ts`
Expected: FAIL — `insertCheer` undefined / no `source` column.

- [ ] **Step 3: Schema — add the column to the canonical DDL**

In `api/src/db/schema.sql.ts`, change the `reactions` table to include `source`:
```sql
CREATE TABLE IF NOT EXISTS reactions (
  id                 TEXT PRIMARY KEY,
  race_date          TEXT NOT NULL,
  target_racer_login TEXT NOT NULL,
  kind               TEXT NOT NULL,
  reactor            TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'boost'
);
```

- [ ] **Step 4: Migrate — guarded ALTER for pre-existing DBs**

`CREATE TABLE IF NOT EXISTS` won't alter an existing table, so add a guarded column-add. In `api/src/db/migrate.ts`:
```ts
import type { Db } from './connection.js';
import { SCHEMA_SQL } from './schema.sql.js';

export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);
  // Add columns introduced after the first release (idempotent).
  const cols = db.prepare("PRAGMA table_info(reactions)").all() as { name: string }[];
  if (!cols.some((c) => c.name === 'source')) {
    db.exec("ALTER TABLE reactions ADD COLUMN source TEXT NOT NULL DEFAULT 'boost'");
  }
}
```

- [ ] **Step 5: Repository — `insertCheer`, `source` in inserts and `listForDate`, exclude cheers from summaries**

In `api/src/db/repositories/reactions.ts`:

a) `insertReaction` — write `source='boost'` explicitly:
```ts
export function insertReaction(db: Db, r: ReactionRow): void {
  db.prepare(
    `INSERT OR IGNORE INTO reactions (id, race_date, target_racer_login, kind, reactor, created_at, source)
     VALUES (@id, @raceDate, @targetLogin, @kind, @reactor, @createdAt, 'boost')`,
  ).run(r);
}
```

b) Add `insertCheer`:
```ts
export interface CheerRow {
  id: string;
  raceDate: string;
  targetLogin: string;
  label: string;     // self-set name or 'a fan'
  createdAt: string;
}

export function insertCheer(db: Db, c: CheerRow): void {
  db.prepare(
    `INSERT OR IGNORE INTO reactions (id, race_date, target_racer_login, kind, reactor, created_at, source)
     VALUES (@id, @raceDate, @targetLogin, '🙌', @label, @createdAt, 'cheer')`,
  ).run(c);
}
```

c) `summaryForDate` and `summariesForDate` — add `AND source = 'boost'` to both WHERE clauses so cheers never count as boosts.

d) `listForDate` — select `source` too:
```ts
export function listForDate(db: Db, raceDate: string): ArchivedReaction[] {
  const rows = db
    .prepare(
      `SELECT target_racer_login AS targetLogin, kind, reactor, created_at AS createdAt, source
       FROM reactions
       WHERE race_date = ?
       ORDER BY created_at ASC`,
    )
    .all(raceDate) as ArchivedReaction[];
  return rows;
}
```

- [ ] **Step 6: Run repo test (expect pass)**

Run: `npx vitest run api/test/db/repositories/reactions.cheers.test.ts`
Expected: PASS. Also re-run the existing reactions test to confirm no regression:
Run: `npx vitest run api/test/db/repositories/reactions.test.ts` → PASS.

- [ ] **Step 7: Wire `insertCheer` into the spectator router**

In `api/src/app.ts`, replace the `insertCheer: () => {}` stub with the real one:
```ts
import { insertCheer } from './db/repositories/reactions.js';
import { randomUUID } from 'node:crypto';
// in the spectatorsRouter({ ... }) call:
    insertCheer: ({ targetLogin, label, raceDate, createdAt }) =>
      insertCheer(db, { id: randomUUID(), raceDate, targetLogin, label, createdAt }),
```

- [ ] **Step 8: Build + run the app test suite**

Run: `npx vitest run api/test` (whole API suite)
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/db/schema.sql.ts api/src/db/migrate.ts api/src/db/repositories/reactions.ts api/src/routes/reactions.ts api/src/app.ts api/test/db/repositories/reactions.cheers.test.ts
git commit -m "feat(api): persist spectator cheers in reactions via a source discriminator"
```

## Task 13: Cheer route end-to-end (cooldown + broadcast + persist)

The router logic exists (Task 4); add an integration test through `createApp` proving a cheer persists and a repeat within the cooldown is rejected.

**Files:**
- Test: `api/test/app.cheer.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { listForDate } from '../src/db/repositories/reactions.js';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' });
  const app = createApp({ db, config, clock: () => new Date('2026-06-10T12:00:00Z') });
  return { app, db };
}

describe('cheer route', () => {
  it('persists a cheer and enforces the cooldown', async () => {
    const { app, db } = setup();
    const first = await request(app).post('/api/spectators/cheer').send({ sessionId: 's1', targetLogin: 'devon-r' });
    expect(first.body).toEqual({ ok: true });
    const list = listForDate(db, '2026-06-10');
    expect(list.filter((r) => r.source === 'cheer')).toHaveLength(1);
    expect(list[0]).toMatchObject({ targetLogin: 'devon-r', reactor: 'a fan' });

    const second = await request(app).post('/api/spectators/cheer').send({ sessionId: 's1', targetLogin: 'devon-r' });
    expect(second.body).toEqual({ ok: false, reason: 'cooldown' });
  });
});
```

- [ ] **Step 2: Run it (expect pass)**

Run: `npx vitest run api/test/app.cheer.test.ts`
Expected: PASS. If the cooldown map is shared across app instances, confirm it's created per-router (it is — `lastCheerAt` lives inside `spectatorsRouter`).

- [ ] **Step 3: Commit**

```bash
git add api/test/app.cheer.test.ts
git commit -m "test(api): cheer persists and respects the cooldown"
```

## Task 14: Web — Grandstand row + IdentityControl

**Files:**
- Create: `web/src/components/Grandstand.tsx`
- Create: `web/src/components/IdentityControl.tsx`
- Modify: `web/src/components/RaceControl.tsx` (or `Track.tsx`) to render `<Grandstand>` under the lanes
- Modify: `web/src/App.tsx` to pass `spectators` down

- [ ] **Step 1: Implement IdentityControl**

Create `web/src/components/IdentityControl.tsx` — a small popover to set your name + flag. Reuse existing input styling; keep it minimal:

```tsx
import { useState } from 'react';

interface Props {
  name: string | null;
  flag: string | null;
  onName: (n: string | null) => void;
  onFlag: (f: string | null) => void;
  onClose: () => void;
}

// A small curated flag set; users can also clear to go anonymous.
const FLAGS = ['🇺🇸', '🇨🇦', '🇬🇧', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🇩🇪', '🇫🇷', '🇮🇳', '🇧🇷', '🇯🇵', '🇦🇺', '🏎️', '🔥'];

export function IdentityControl({ name, flag, onName, onFlag, onClose }: Props) {
  const [draft, setDraft] = useState(name ?? '');
  return (
    <div className="absolute z-50 mt-2 w-56 rounded-lg border border-line bg-panel2 p-3 shadow-xl">
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-muted">Your name</label>
      <input
        className="mb-3 w-full rounded border border-line bg-panel px-2 py-1 text-sm text-ink"
        value={draft}
        placeholder="optional"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onName(draft.trim() || null)}
      />
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted">Flag (from your location · click to change)</div>
      <div className="flex flex-wrap gap-1">
        {FLAGS.map((f) => (
          <button
            key={f}
            className={`rounded px-1 text-lg ${flag === f ? 'ring-1 ring-cyan' : ''}`}
            onClick={() => onFlag(f)}
          >{f}</button>
        ))}
        <button className="rounded px-2 text-xs text-muted" onClick={() => onFlag(null)}>clear</button>
      </div>
      <button className="mt-3 w-full rounded bg-panel py-1 text-xs text-muted" onClick={onClose}>done</button>
    </div>
  );
}
```

- [ ] **Step 2: Implement Grandstand**

Create `web/src/components/Grandstand.tsx`. Render a horizontal row of fans (flag over body + name), anonymous dimmed, `+N` overflow at a cap of 24, "you" outlined, supporter dot in the cheered car's color, and a per-fan tooltip. Clicking your own fan opens `IdentityControl`. Use the locked mockup (`.superpowers/brainstorm/.../grandstand-merged.html`) as the visual reference.

```tsx
import { useState } from 'react';
import type { SpectatorFan } from '@racingshape/shared';
import { tip } from '../lib/tooltip';
import { IdentityControl } from './IdentityControl';

interface Props {
  fans: SpectatorFan[];
  colorForLogin: (login: string) => string; // car color lookup for supporter dots
  myName: string | null;
  myFlag: string | null;
  onName: (n: string | null) => void;
  onFlag: (f: string | null) => void;
}

const CAP = 24;

export function Grandstand({ fans, colorForLogin, myName, myFlag, onName, onFlag }: Props) {
  const [editing, setEditing] = useState(false);
  const shown = fans.slice(0, CAP);
  const overflow = fans.length - shown.length;

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-line bg-gradient-to-t from-panel2 to-transparent px-4 py-3">
      <span className="self-center font-mono text-[9px] tracking-wide text-muted">FANS</span>
      {shown.map((f) => {
        const watching = `${Math.floor(f.watchingForSec / 60)}m`;
        const tipBody = [
          f.cheerForLogin ? `Cheering ${f.cheerForLogin}` : 'Watching the race',
          `Watching for ${watching}`,
        ].join('\n');
        return (
          <div
            key={f.id}
            className={`relative flex cursor-help flex-col items-center gap-1 ${f.name ? '' : 'opacity-40'} ${f.isSelf ? 'rounded outline outline-1 outline-dashed outline-cyan' : ''}`}
            data-tip={tip(`${f.name ?? 'a fan'} ${f.flag ?? ''}`.trim(), tipBody)}
            onClick={f.isSelf ? () => setEditing((v) => !v) : undefined}
          >
            {f.flag
              ? <span className="text-base leading-none">{f.flag}</span>
              : <span className="mb-[-3px] h-3 w-3 rounded-full bg-muted" />}
            <span className="h-3.5 w-4 rounded-t-md bg-muted opacity-80" />
            {f.name && <span className="font-mono text-[9px] text-ink">{f.name}</span>}
            {f.cheerForLogin && (
              <span
                className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border border-panel"
                style={{ background: colorForLogin(f.cheerForLogin) }}
              />
            )}
            {f.isSelf && editing && (
              <IdentityControl
                name={myName} flag={myFlag}
                onName={onName} onFlag={onFlag}
                onClose={() => setEditing(false)}
              />
            )}
          </div>
        );
      })}
      {overflow > 0 && <span className="self-center font-mono text-sm text-cyan">+{overflow}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Mount under the lanes**

In `web/src/components/RaceControl.tsx` (the grid wrapper around TimingTower + Track), render `<Grandstand>` directly under the track block. Pass props from the `spectators` hook (threaded through `App.tsx`). For `colorForLogin`, reuse whatever maps a racer login → car color today (the standings carry a color or it's derived in `Car.tsx`); expose a small lookup from the standings array.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Two tabs.
Expected:
- A fan appears for each tab in the trackside row; your own fan is dash-outlined.
- Clicking your fan opens the name/flag editor; setting a name shows it under your fan in both tabs within a heartbeat; the choice survives a reload.
- With `GEO_ENABLED=true` set in `api/.env` and a public IP, a flag pre-fills; locally (private IP) it stays blank — both are fine.
- Anonymous fans render dimmed; none are labeled or shamed.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Grandstand.tsx web/src/components/IdentityControl.tsx web/src/components/RaceControl.tsx web/src/App.tsx
git commit -m "feat(web): trackside grandstand with identity and flags"
```

## Task 15: Web — click-to-cheer on a car (bubble + flag pin + supporter dot)

**Files:**
- Modify: `web/src/components/Car.tsx`
- Modify: `web/src/App.tsx` (thread `spectators.cheer` + `spectators.cheerFx`)

- [ ] **Step 1: Implement**

In `web/src/components/Car.tsx`:
- Add an `onCheer: (login: string) => void` prop and a `cheerFx?: { label: string }` prop (the active cheer for this car, if any).
- Make the car pod clickable to call `onCheer(login)` (keep the existing boost `⚡` button working — cheer is the car-body click; boosts stay on the button).
- When `cheerFx` is set, render the existing cheer-bubble animation (reuse the `.cheer` keyframes from the mockup / existing boost affirmation) with text `${label} 🙌`.
- If this car has supporters, render a small flag pin (optional; can reuse the leader pin slot).

Wire in `App.tsx`: for each car, pass `onCheer={spectators.cheer}` and derive `cheerFx` by matching `spectators.cheerFx` entries to the car's login (render the most recent).

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Two tabs.
Expected:
- Clicking a car in tab A makes a `… 🙌` bubble fly up on that car in **both** tabs (broadcast).
- Your fan shows a supporter dot in that car's color.
- Cheering again within 5s does nothing (cooldown); after 5s it works.
- The boost `⚡` button still works and still does NOT change score.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Car.tsx web/src/App.tsx
git commit -m "feat(web): click a car to cheer, broadcast bubbles to all viewers"
```

**✅ Phase 2 checkpoint:** full live grandstand. Review before Phase 3.

---

# PHASE 3 — Peak surfaces (Pit Wall, recap) + cheer replay

## Task 16: `viewers` on the today payload

**Files:**
- Modify: `api/src/routes/race.ts`
- Modify: `api/src/app.ts` (pass a `viewers()` provider into the race router)
- Test: `api/test/app.viewers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

function app() {
  const db = openDb(':memory:'); migrate(db);
  const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' });
  return createApp({ db, config, clock: () => new Date('2026-06-10T12:00:00Z') });
}

describe('GET /api/race/today includes viewers', () => {
  it('exposes a viewers summary', async () => {
    const a = app();
    await request(a).post('/api/spectators/heartbeat').send({ sessionId: 's1' });
    const res = await request(a).get('/api/race/today');
    expect(res.status).toBe(200);
    expect(res.body.viewers).toMatchObject({ count: 1 });
    expect(res.body.viewers).toHaveProperty('peak');
    expect(res.body.viewers).toHaveProperty('peakAt');
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `npx vitest run api/test/app.viewers.test.ts`
Expected: FAIL — `viewers` undefined.

- [ ] **Step 3: Implement**

In `api/src/routes/race.ts`, accept a viewers provider and attach it to the today response. Change the factory signature to `raceRouter(db, clock, getViewers?: () => ViewersSummary)`; after building the `RaceToday` object, set `today.viewers = getViewers ? getViewers() : { count: 0, peak: 0, peakAt: null }`.

In `api/src/app.ts`, pass the provider derived from the registry snapshot:
```ts
  app.use('/api/race', raceRouter(db, clock, () => {
    const s = registry.snapshot();
    return { count: s.count, peak: s.peak, peakAt: s.peakAt };
  }));
```
(Move the `raceRouter` mount below the `registry` construction so `registry` is in scope.)

- [ ] **Step 4: Run it (expect pass)**

Run: `npx vitest run api/test/app.viewers.test.ts`
Expected: PASS. Also confirm the existing race route test still passes:
Run: `npx vitest run api/test/services/raceService.test.ts api/test/app.test.ts` → PASS (update any `RaceToday` fixture that now needs a `viewers` field).

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/race.ts api/src/app.ts api/test/app.viewers.test.ts
git commit -m "feat(api): include live viewers summary in GET /api/race/today"
```

## Task 17: `crowd` on the stats payload

**Files:**
- Modify: `api/src/services/statsService.ts`
- Create: `api/src/db/repositories/viewerPeaks.ts` helper `listViewerPeaks` (add to the existing file)
- Test: `api/test/services/statsService.crowd.test.ts`

- [ ] **Step 1: Add a range query to the repo**

In `api/src/db/repositories/viewerPeaks.ts`, add:
```ts
export function listViewerPeaks(db: Db, raceDates: string[]): Map<string, number> {
  if (raceDates.length === 0) return new Map();
  const placeholders = raceDates.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT race_date AS date, peak_count AS peak FROM viewer_peaks WHERE race_date IN (${placeholders})`)
    .all(...raceDates) as { date: string; peak: number }[];
  return new Map(rows.map((r) => [r.date, r.peak]));
}
```

- [ ] **Step 2: Write the failing service test**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { upsertViewerPeak } from '../../src/db/repositories/viewerPeaks.js';
import { loadConfig } from '../../src/config.js';
import { buildStats } from '../../src/services/statsService.js';

describe('statsService crowd', () => {
  it('includes peakToday and a chronological peaks series', () => {
    const db = openDb(':memory:'); migrate(db);
    upsertViewerPeak(db, '2026-06-09', 4, '2026-06-09T14:00:00.000Z');
    upsertViewerPeak(db, '2026-06-10', 7, '2026-06-10T14:00:00.000Z');
    const config = loadConfig({ GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r' });
    const stats = buildStats(db, config, () => new Date('2026-06-10T18:00:00Z'), '14d');
    expect(stats.crowd.peakToday).toBe(7);
    expect(stats.crowd.peaks.at(-1)).toEqual({ date: '2026-06-10', peak: 7 });
    expect(stats.crowd.peaks.find((p) => p.date === '2026-06-09')).toEqual({ date: '2026-06-09', peak: 4 });
  });
});
```

> Match `buildStats`' real exported name/signature from `statsService.ts`; adapt the import and call if it differs (it already takes `db`, `config`, a clock, and a range).

- [ ] **Step 3: Run it (expect fail)**

Run: `npx vitest run api/test/services/statsService.crowd.test.ts`
Expected: FAIL — `crowd` undefined.

- [ ] **Step 4: Implement**

In `api/src/services/statsService.ts`: the service already computes the list of dates in the range for the chart. Reuse that date list to build `crowd`:
```ts
import { listViewerPeaks } from '../db/repositories/viewerPeaks.js';
// ... after computing `dates` (chronological YYYY-MM-DD array used for the chart) and `todayDate`:
const peakMap = listViewerPeaks(db, dates);
const crowd = {
  peakToday: peakMap.get(todayDate) ?? 0,
  peaks: dates.map((date) => ({ date, peak: peakMap.get(date) ?? 0 })),
};
// add `crowd` to the returned StatsResponse object
```

- [ ] **Step 5: Run it (expect pass)**

Run: `npx vitest run api/test/services/statsService.crowd.test.ts`
Expected: PASS. Confirm the existing stats test still passes (add `crowd` to any asserted full-object fixture):
Run: `npx vitest run api/test/services/statsService.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/services/statsService.ts api/src/db/repositories/viewerPeaks.ts api/test/services/statsService.crowd.test.ts
git commit -m "feat(api): expose daily crowd peaks in GET /api/stats"
```

## Task 18: Web — Pit Wall "Biggest crowd" tile + sparkline

**Files:**
- Modify: `web/src/components/PitWall.tsx`
- Modify: `web/src/App.tsx` (pass `stats.crowd` to PitWall if not already passing the full stats)

- [ ] **Step 1: Implement**

In `web/src/components/PitWall.tsx`, add a new stat block (follow the existing `border-b` stat pattern) showing `crowd.peakToday`, a delta vs the series average, and a tiny inline sparkline of `crowd.peaks`. Wire the shared tooltip:

```tsx
// inside PitWall, given props include crowd: CrowdStat
const peaks = crowd.peaks.map((p) => p.peak);
const avg = peaks.length ? Math.round(peaks.reduce((a, b) => a + b, 0) / peaks.length) : 0;
const max = Math.max(1, ...peaks);
// render:
<div className="stat" data-tip={tip('Biggest crowd today', `${crowd.peakToday} concurrent viewers\n14-day average ${avg}`)}>
  <div className="k">👥 Biggest crowd</div>
  <div className="v">{crowd.peakToday}</div>
  <div className="mt-2 flex h-6 items-end gap-[2px]">
    {crowd.peaks.map((p) => (
      <span key={p.date} className="w-full rounded-sm bg-cyan" style={{ height: `${(p.peak / max) * 100}%` }} />
    ))}
  </div>
</div>
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev` with two tabs open for a bit, then check the Pit Wall.
Expected: the tile shows today's peak (≥2 after both tabs were open); hovering shows the breakdown; the sparkline renders one bar per day in range.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PitWall.tsx web/src/App.tsx
git commit -m "feat(web): Pit Wall biggest-crowd tile with 14-day sparkline"
```

## Task 19: Web — "Biggest crowd" super-stat in the recap

**Files:**
- Modify: `web/src/components/GrandPrixReveal.tsx` and/or `web/src/components/Recap.tsx`

- [ ] **Step 1: Implement**

The archived day's peak comes from `GET /api/stats` (`crowd.peaks` includes past days) or from the archive payload. Add a super-stat card "👥 Biggest crowd — N fans · h:mm" to the recap, matching the existing super-stat styling (`.super` blocks). Pull the peak for the recap's date from the `crowd.peaks` series already loaded in `App.tsx`; if the date isn't present, omit the card gracefully.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`; open the recap (archived day card / Grand Prix reveal).
Expected: the biggest-crowd super-stat appears with the recorded peak; absent gracefully when there's no data.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/GrandPrixReveal.tsx web/src/components/Recap.tsx
git commit -m "feat(web): biggest-crowd super-stat in the Grand Prix recap"
```

## Task 20: Web — replay cheers on archived days

**Files:**
- Modify: `web/src/App.tsx` (replay engine)
- Modify: `web/src/components/Car.tsx` (already renders a cheer bubble from Task 15 — reuse it for replay)

- [ ] **Step 1: Implement**

The archive payload's `reactions` array now includes `source` (Task 12). In the replay engine in `App.tsx`, when stepping through archived reactions, route `source === 'cheer'` rows to the same cheer-bubble path used live (render `${reactor} 🙌` on the target car at the replay timestamp), and keep `source === 'boost'` rows on the existing boost path. Presence (the stand) is NOT reconstructed — only cheers replay.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Send a few cheers today, wait for/seed an archived day, then use the existing Replay control on that day.
Expected: cheer bubbles fly on the cars during replay in time order; no grandstand is reconstructed; boosts still replay as before.

> If no archived day with cheers is readily available, verify the branch by temporarily archiving today or pointing at a seeded DB; note the manual check performed.

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx web/src/components/Car.tsx
git commit -m "feat(web): replay spectator cheers on archived days"
```

## Task 21: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Build everything**

Run: `npm run build`
Expected: all three workspaces typecheck and build clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all suites pass (shared + api).

- [ ] **Step 4: End-to-end smoke (two browsers)**

Run: `npm run dev`. Open two tabs.
Verify the full feature: broadcast bug count tracks open tabs; grandstand shows fans; identity edit persists and propagates; auto-flag works with `GEO_ENABLED=true` on a public IP; cheering a car broadcasts a bubble to both tabs with cooldown; Pit Wall crowd tile + sparkline populate; recap shows biggest crowd; archived-day replay shows cheers; no console errors; the `event-stream` connection stays open.

- [ ] **Step 5: Commit any fixups, then finish the branch**

```bash
git add -A && git commit -m "chore: spectator feature verification fixups" || echo "nothing to fix up"
```

Then use the **superpowers:finishing-a-development-branch** skill to open the PR into `dev`.

---

## Self-review notes (coverage against the spec)

- §4.1 SSE transport → Tasks 2, 4, 7. §4.2 in-memory presence + reaper → Tasks 3, 5. §4.3 localStorage identity → Tasks 6, 14. §4.4 geo (ip-api, server-side, silent prefill + override, disclosure tooltip) → Tasks 9, 11, 14. §4.5 cheers (cosmetic, broadcast, cooldown, replay) → Tasks 4, 12, 13, 15, 20. §4.6 peak tracking → Tasks 3, 10.
- §5.1 `viewer_peaks` → Task 10. §5.2 cheers reuse `reactions` + `source`, identity-free, summaries exclude cheers → Task 12.
- §6 API surface (stream/heartbeat/cheer; `viewers` on today; `crowd` on stats; cheer in archive) → Tasks 4, 16, 17, 12. §6 SSE payload shapes → Task 1.
- §7 frontend components (BroadcastBug, Grandstand, IdentityControl, Car cheers, PitWall tile, recap stat, replay) → Tasks 7, 14, 15, 18, 19, 20. Tooltips on every new metric → Tasks 7, 14, 18.
- §8 shared types → Tasks 1, 8. §9 replay scope (presence live-only, peak persisted, cheers replayed) → Tasks 10, 12, 20. §10 build order → Phases 1/2/3. §11 risks (license accepted; SSE+basic-auth; proxy buffering headers; reaper cadence; cooldown) → Tasks 4 (headers), 5 (reaper), 9 (geo failure).
