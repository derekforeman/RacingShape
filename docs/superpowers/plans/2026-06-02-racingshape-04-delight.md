# RacingShape — Delight Layer (Plan 04) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full RacingShape delight layer on top of the live dashboard — pit-stop boosts (particle burst + friendly "cheer" affirmation, cosmetic-only), the three earned car cosmetics rendered over the pod, the Grand Prix recap card with PNG export + a copyable replay link, a date selector, and a deterministic ~15s replay engine that drives archived days read-only — completing v1.

**Architecture:** Pure-presentational React components fed by the canonical shared types the API already returns. `BoostButton` POSTs a `CreateReactionBody` through a new named `postReaction` export added to `api.ts`, optimistically bumps the local count, and sprays a particle burst + a floating "cheer" badge (animations ported from the mockup into global CSS in `index.css`, like plan 03's pulse animation). `Cosmetics` paints a layer over the existing pod from `RacerStanding.cosmetics` with Tailwind utilities + inline styles. `useReplay` is a framework-free frame stepper over `RaceArchive.frames`: it maps the day's wall-clock span onto ~15s and exposes interpolated per-racer scores at the current replay time, with all timing driven by `setInterval` so tests use fake timers — no real clocks. `App` chooses live (poll `getRaceToday`) vs archived (fetch `getArchive`, drive `Track` from `useReplay` scores, show reactions/cosmetics read-only, render `Recap`, disable boosting) based on the selected date. PNG export renders the recap DOM node via `html-to-image` (mocked in tests).

**Tech Stack:** TypeScript, React 18, Vite, Tailwind CSS (token-mapped utilities) + inline styles + token CSS vars, Vitest + @testing-library/react + @testing-library/user-event with `jsdom`, `html-to-image` (mocked in tests), and the already-built `@racingshape/shared` types. Consumes the running `@racingshape/api` from plan 02 and the dashboard shell from plan 03.

---

**Roadmap / contract:** [`2026-06-02-racingshape-roadmap.md`](2026-06-02-racingshape-roadmap.md) is the canonical source for shared type names (§6), file paths (§3), conventions (§4), design tokens (§9), the track auto-scale rule (§10), and tooltip coverage (§11). If anything here disagrees with the roadmap, the roadmap wins — fix this plan.

**Depends on Plan 02 and Plan 03.**

Plan 02 (`...-02-github-api.md`) gives us a running API that already serves everything this plan consumes:
- `POST /api/race/today/reactions` accepts a `CreateReactionBody` and returns `CreateReactionResponse` (`{ ok: true, reactions: ReactionSummary }`).
- `GET /api/race/:date` returns a `RaceArchive` with `frames` (ordered `SnapshotFrame[]`), `reactions` (`ArchivedReaction[]`), and a computed `recap` (`Recap`).
- `GET /api/races` returns `RaceListItem[]`.
- The standings builder already populates `RacerStanding.cosmetics` and `RacerStanding.reactions` (a `ReactionSummary`).

Plan 03 (`...-03-frontend-race.md`) gives us the Vite + React + Tailwind shell with design tokens, the **single tooltip engine** (`web/src/lib/tooltip.tsx`), the typed `web/src/lib/api.ts` client (named exports `getRaceToday`, `getStats`, `getRaces`, `getArchive`), the `usePolling` hook, `useTheme`, the `Header`, `RaceControl`, `TimingTower`, `Track`, `Car`, `TelemetryChart`, `PitWall`, and `App`. **Do not recreate these — import and use them.**

### Seams plan 03 left for THIS plan to fill

Plan 03 deliberately stubbed the delight surfaces so the live dashboard ships first. Plan 03's stubs are *real, compiling code that renders nothing harmful* — this plan replaces each with the real thing:

1. **`web/src/components/cosmetics/Cosmetics.tsx`** — plan 03 created an inert stub (`return <span data-testid="cosmetics-slot" data-count={cosmetics.length} hidden />;`) imported by `Car`. Task 3 replaces it with the real cosmetic layer (keeping a `cosmetics-slot` test id so plan-03's `Car.test.tsx` still passes).
2. **`web/src/components/Car.tsx`** — plan 03's `Car` (signature `{ standing, topScore }`) renders the pod (`data-testid="car-pod"`), avatar (`car-avatar`/`car-avatar-fallback`), username label (`.clabel`), DRS tag (`drs-tag`), a **read-only** reaction count (`reaction-count`), and mounts the `Cosmetics` stub. Tasks 1–3 extend it (additively) with the boost button, an optimistic reaction count, and the real cosmetic layer.
3. **`web/src/components/Header.tsx`** — plan 03's `Header` takes **no props** and renders its own LIVE chip (`live-chip`), a **disabled** date-selector `<select>` (`date-selector`), a **disabled** Replay button (`replay-btn`), and the theme toggle (`theme-btn`). Tasks 6, 8, and 9 turn `Header` into a props-driven component that mounts the real `DateSelector` and `ReplayControls`.
4. **`web/src/components/DateSelector.tsx`** and **`web/src/components/ReplayControls.tsx`** — these do **not** exist after plan 03 (plan 03 inlined disabled stubs directly in `Header`). This plan **creates** them (roadmap §3 lists them as plan-04 files) and wires them into `Header`.
5. **`web/src/App.tsx`** — plan 03's `App` polls `getRaceToday`/`getStats` and renders the dashboard, with a commented recap mount-point (`{/* PLAN 04: <Recap /> mounts here for completed/archived days. */}`) after the stats grid. Tasks 4 and 9 mount the `Recap` card and add archived/replay mode with a `selectedDate` state.

This plan adds the delight-only files from roadmap §3: `BoostButton.tsx`, `ReactionCount.tsx`, `Recap.tsx`, `DateSelector.tsx`, `ReplayControls.tsx`, `replay/useReplay.ts`, `lib/exportPng.ts`; adds the `postReaction` named export (and a test for the existing `getRaces`) to `api.ts`; adds a `reactionSummaryBody` helper to `format.ts`; adds the `.spark`/`.cheer` keyframes to `index.css`; and modifies `cosmetics/Cosmetics.tsx`, `Car.tsx`, `Track.tsx`, `RaceControl.tsx`, `Header.tsx`, and `App.tsx`.

### Plan-03 surface this plan imports (exact names — verified against the final plan 03)

Use these exact symbols — they exist and are green from plan 03.

```ts
// @racingshape/shared (re-exported via web/src/lib/types.ts)
import type {
  Cosmetic, ReactionKind, ReactionSummary, RacerStanding, ScoreBreakdown,
  RaceToday, RaceArchive, RaceListItem, SnapshotFrame, ArchivedReaction,
  Recap, PodiumStep, Superlative, CreateReactionBody, CreateReactionResponse,
} from '@racingshape/shared';

// web/src/lib/api.ts  (plan 03 — NAMED exports, no `api` object)
export function getRaceToday(): Promise<RaceToday>;
export function getStats(range: string): Promise<StatsResponse>;
export function getRaces(): Promise<RaceListItem[]>;
export function getArchive(date: string): Promise<RaceArchive>;
// Task 1 ADDS:  export function postReaction(body: CreateReactionBody): Promise<CreateReactionResponse>;

// web/src/lib/tooltip.tsx  (plan 03 — the ONE tooltip engine)
export function TooltipProvider(props: { children: React.ReactNode }): JSX.Element;
export function tip(header: string, body: string): string;   // returns "HEADER||body"
export function useTip(): null;                                // context value (unused by callers)
// Tooltips are applied by putting a `data-tip={tip('Header','Body')}` ATTRIBUTE on a real element.
// The provider's global mouseover/mousemove/mouseout listeners render the floating #tip card.
// There is NO <Tip> component and NO tipProps().

// web/src/lib/format.ts (plan 03)
export function breakdownBody(b: ScoreBreakdown): string;   // "10 commits ×1 = 10\n2 PRs opened ×5 = 10" (mockup bkText)
export function standingTip(s: RacerStanding): string;
export function gapText(s: RacerStanding): string;
export function completionText(c: CompletionStat): string;
export function streakText(s: StreakStat): string;
export function chartDayBody(d: ChartDay): string;
// Task 2 ADDS:  export function reactionSummaryBody(r: ReactionSummary): string;

// web/src/lib/usePolling.ts (plan 03)
export function usePolling<T>(fn: () => Promise<T>, intervalMs: number, deps: unknown[]):
  { data: T | null; error: Error | null; loading: boolean; refetch: () => Promise<void> };
// Note: 3rd arg is a deps array (re-arms the interval), NOT an enabled flag.

// web/src/components/TimingTower.tsx (plan 03)
export function colorFor(login: string): string;     // deterministic per-login pod/tile color
export function initialsFor(login: string): string;

// web/src/components/Car.tsx (plan 03)
export function carPct(score: number, topScore: number): number;   // roadmap §10 auto-scale
```

**Test command form (roadmap §4, matching plan 03):** tests live under `web/src/test/...` mirroring source; one file is run with
`npm test -w @racingshape/web -- run src/test/<path>`. Append `-t "name substring"` to run one test by name. The whole workspace is `npm test -w @racingshape/web`. All tests use Vitest + Testing Library with `jsdom`; `fetch`, timers, and `html-to-image` are mocked — never real network, real clocks, or real pixels. Test imports are relative: from `web/src/test/foo.test.tsx` use `../lib/...` / `../components/...`; from a nested dir like `web/src/test/cosmetics/` use `../../lib/...` / `../../components/...`.

**Tokens (roadmap §9):** all styling uses plan 03's conventions — Tailwind token-mapped utilities (`text-ink bg-panel border-line text-accent text-amber text-cyan font-head .mono`) plus inline `style={{}}` for gradients/transitions, referencing the token CSS vars (`var(--accent)`, `var(--amber)`, `var(--cyan)`, `var(--panel2)`, `var(--line)`, `var(--ink)`, `var(--muted)`, `var(--green)`) from `web/src/index.css`. There are **no CSS modules** anywhere in the web workspace. The two keyframe animations the boost needs (`spark`, `cheer`) are added as **global CSS in `web/src/index.css`** (Task 1), exactly where plan 03 keeps base styles and the `.mono` helper.

---

## Task 1: BoostButton — POST a reaction, optimistic count, particle burst + cheer

> 💡 **Optimistic update:** we bump the visible count immediately on click for instant feedback, then reconcile with the server's authoritative `reactions` total when the POST resolves — so the UI never feels laggy even if the network is slow.

**Files:**
- Modify: `web/src/lib/api.ts` (add the `postReaction` named export)
- Modify: `web/src/index.css` (add `.spark`/`.cheer` classes + `@keyframes spark`/`@keyframes cheer`)
- Create: `web/src/components/BoostButton.tsx`
- Test: `web/src/test/api.postReaction.test.ts`
- Test: `web/src/test/BoostButton.test.tsx`

- [ ] **Step 1: Write the failing test for `postReaction`**

```ts
// web/src/test/api.postReaction.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postReaction } from '../lib/api';
import type { CreateReactionResponse } from '../lib/types';

describe('postReaction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs the body to /api/race/today/reactions and returns the parsed response', async () => {
    const payload: CreateReactionResponse = {
      ok: true,
      reactions: { total: 8, byKind: { '🔥': 5, '⚡': 2, '🏎️': 1 } },
    };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const res = await postReaction({ targetLogin: 'devon-r', kind: '⚡', reactor: 'mira-k' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/race/today/reactions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ targetLogin: 'devon-r', kind: '⚡', reactor: 'mira-k' });
    expect(res).toEqual(payload);
  });

  it('throws on a non-ok response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    await expect(
      postReaction({ targetLogin: 'devon-r', kind: '🔥', reactor: 'me' }),
    ).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/api.postReaction.test.ts`
Expected: FAIL — `postReaction` is not exported from `../lib/api`.

- [ ] **Step 3: Add the `postReaction` named export to `api.ts`**

Plan 03's `api.ts` is named exports with a private `getJson<T>` helper. Add a sibling `postReaction` export and widen the type import. Open `web/src/lib/api.ts` and (a) extend the top type import:

```ts
// web/src/lib/api.ts — replace the existing `import type { … } from './types';`
import type {
  RaceToday,
  StatsResponse,
  RaceListItem,
  RaceArchive,
  CreateReactionBody,
  CreateReactionResponse,
} from './types';
```

and (b) append this function at the end of the file:

```ts
// web/src/lib/api.ts — append
export async function postReaction(
  body: CreateReactionBody,
): Promise<CreateReactionResponse> {
  const res = await fetch('/api/race/today/reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to /api/race/today/reactions failed: ${res.status}`);
  }
  return (await res.json()) as CreateReactionResponse;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/api.postReaction.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/test/api.postReaction.test.ts
git commit -m "feat(web): add postReaction api client function"
```

- [ ] **Step 6: Add the `.spark`/`.cheer` keyframes to `index.css`**

Plan 03 keeps base styles and `.mono` in `web/src/index.css`. Append the boost animations there (ported verbatim from `mockup-2-f1-broadcast.html` `.spark`/`.cheer` + `@keyframes sp`/`@keyframes cheer`, renamed `sp` → `spark`):

```css
/* web/src/index.css — append (ported from mockup .spark/.cheer) */

.spark {
  position: absolute;
  font-size: 14px;
  pointer-events: none;
  animation: spark 0.8s ease-out forwards;
}
@keyframes spark {
  to {
    opacity: 0;
    transform: translate(var(--spark-x), var(--spark-y));
  }
}

.cheer {
  position: absolute;
  top: -14px;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--amber);
  background: var(--panel2);
  border: 1px solid var(--amber);
  border-radius: 20px;
  padding: 2px 9px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  animation: cheer 1.4s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
@keyframes cheer {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.8);
  }
  18% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  78% {
    opacity: 1;
    transform: translateY(-10px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-22px) scale(0.95);
  }
}
```

- [ ] **Step 7: Write the failing test for `BoostButton`**

```tsx
// web/src/test/BoostButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { BoostButton } from '../components/BoostButton';
import * as api from '../lib/api';

function renderButton(props: Partial<React.ComponentProps<typeof BoostButton>> = {}) {
  const onBoosted = vi.fn();
  const onClickOptimistic = vi.fn();
  const utils = render(
    <TooltipProvider>
      <BoostButton
        targetLogin="devon-r"
        reactor="tester"
        live={true}
        onClickOptimistic={onClickOptimistic}
        onBoosted={onBoosted}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...utils, onBoosted, onClickOptimistic };
}

describe('BoostButton', () => {
  beforeEach(() => {
    vi.spyOn(api, 'postReaction').mockResolvedValue({
      ok: true,
      reactions: { total: 9, byKind: { '🔥': 6, '⚡': 2, '🏎️': 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic cheer + spark offsets
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a ⚡ control with the cosmetic-only tooltip attribute', () => {
    renderButton();
    const btn = screen.getByRole('button', { name: /boost devon-r/i });
    expect(btn.textContent).toContain('⚡');
    expect(btn.getAttribute('data-tip') ?? '').toMatch(/Cosmetic hype only — never changes score\./);
  });

  it('clicking POSTs a CreateReactionBody and reports the server total via onBoosted', async () => {
    const { onBoosted } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    await waitFor(() => expect(api.postReaction).toHaveBeenCalledTimes(1));
    expect(api.postReaction).toHaveBeenCalledWith({
      targetLogin: 'devon-r',
      kind: '⚡',
      reactor: 'tester',
    });
    await waitFor(() =>
      expect(onBoosted).toHaveBeenCalledWith({ total: 9, byKind: { '🔥': 6, '⚡': 2, '🏎️': 1 } }),
    );
  });

  it('fires onClickOptimistic synchronously on click', async () => {
    const { onClickOptimistic } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    expect(onClickOptimistic).toHaveBeenCalledTimes(1);
  });

  it('floats a friendly cheer affirmation naming the target on click', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    const cheer = await screen.findByTestId('cheer');
    expect(cheer.textContent).toContain('devon-r');
    expect(cheer.textContent).toMatch(/Nice! 🎉|Boosted! ⚡|Send it! 🏎️|Let’s go! 🔥|Respect 🙌|On fire! 🔥/);
  });

  it('sprays a particle burst of five ⚡/🔥/💨 glyphs on click', async () => {
    const { container } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    const sparks = container.querySelectorAll('[data-testid="spark"]');
    expect(sparks.length).toBe(5);
    expect([...sparks].every((s) => ['⚡', '🔥', '💨'].includes(s.textContent ?? ''))).toBe(true);
  });

  it('is disabled and does not POST when not live (archived/replay)', async () => {
    renderButton({ live: false });
    const btn = screen.getByRole('button', { name: /boost devon-r/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(api.postReaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/BoostButton.test.tsx`
Expected: FAIL — cannot resolve `../components/BoostButton`.

- [ ] **Step 9: Write the BoostButton component (ports the mockup's `boost()`; Tailwind + inline styles + global `.spark`/`.cheer`)**

```tsx
// web/src/components/BoostButton.tsx
import { useState, useCallback } from 'react';
import type { ReactionKind, ReactionSummary } from '../lib/types';
import { postReaction } from '../lib/api';
import { tip } from '../lib/tooltip';

/** Friendly affirmations — ported verbatim from the mockup's CHEERS array. */
const CHEERS = ['Nice! 🎉', 'Boosted! ⚡', 'Send it! 🏎️', 'Let’s go! 🔥', 'Respect 🙌', 'On fire! 🔥'];
const SPARK_GLYPHS = ['⚡', '🔥', '💨'] as const;
const BOOST_KIND: ReactionKind = '⚡';

interface Particle {
  id: number;
  glyph: string;
  x: number;
  y: number;
}

export interface BoostButtonProps {
  targetLogin: string;
  reactor: string;
  live: boolean;
  /** Fired synchronously on click for an instant optimistic UI bump. */
  onClickOptimistic?: () => void;
  /** Fired when the POST resolves with the server's authoritative summary. */
  onBoosted?: (reactions: ReactionSummary) => void;
}

export function BoostButton({ targetLogin, reactor, live, onClickOptimistic, onBoosted }: BoostButtonProps) {
  const [sparks, setSparks] = useState<Particle[]>([]);
  const [cheer, setCheer] = useState<{ id: number; text: string } | null>(null);

  const onClick = useCallback(() => {
    if (!live) return;
    onClickOptimistic?.();

    // Particle burst — 5 sparks, glyphs cycling ⚡/🔥/💨, random scatter (mockup parity).
    const base = Date.now();
    const next: Particle[] = [];
    for (let k = 0; k < 5; k++) {
      next.push({
        id: base + k,
        glyph: SPARK_GLYPHS[k % SPARK_GLYPHS.length],
        x: Math.random() * 50 - 25,
        y: -Math.random() * 40 - 10,
      });
    }
    setSparks(next);
    window.setTimeout(() => setSparks([]), 800);

    // Friendly "cheer" affirmation naming the teammate.
    const phrase = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    const cheerId = base;
    setCheer({ id: cheerId, text: `${phrase} ${targetLogin}` });
    window.setTimeout(() => setCheer((c) => (c && c.id === cheerId ? null : c)), 1400);

    // Fire-and-forget POST; reconcile the count with the server's authoritative total.
    void postReaction({ targetLogin, kind: BOOST_KIND, reactor })
      .then((res) => onBoosted?.(res.reactions))
      .catch(() => {
        /* network hiccup: optimistic UI already showed the burst; count reconciles next poll */
      });
  }, [live, targetLogin, reactor, onClickOptimistic, onBoosted]);

  return (
    <>
      <button
        type="button"
        aria-label={`Boost ${targetLogin}`}
        disabled={!live}
        onClick={onClick}
        data-tip={tip('Drop a boost', 'Cosmetic hype only — never changes score.')}
        className="ml-[5px] cursor-pointer border-none bg-transparent p-0 text-[12px] leading-none opacity-[.55] transition-[.15s] hover:scale-[1.3] hover:opacity-100 disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100"
      >
        ⚡
      </button>
      {sparks.map((s) => (
        <span
          key={s.id}
          data-testid="spark"
          className="spark"
          style={{ ['--spark-x' as string]: `${s.x}px`, ['--spark-y' as string]: `${s.y}px`, top: '6px' }}
        >
          {s.glyph}
        </span>
      ))}
      {cheer && (
        <span data-testid="cheer" className="cheer">
          {cheer.text}
        </span>
      )}
    </>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/BoostButton.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 11: Commit**

```bash
git add web/src/index.css web/src/components/BoostButton.tsx web/src/test/BoostButton.test.tsx
git commit -m "feat(web): pit-stop boost button with particle burst and cheer affirmation"
```

---

## Task 2: ReactionCount + format helper, wired into Car

**Files:**
- Modify: `web/src/lib/format.ts` (add `reactionSummaryBody`)
- Create: `web/src/components/ReactionCount.tsx`
- Modify: `web/src/components/Car.tsx` (swap plan-03's read-only reaction count for `ReactionCount` + an optimistic count, and add `BoostButton`)
- Test: `web/src/test/format.reaction.test.ts`
- Test: `web/src/test/ReactionCount.test.tsx`
- Test: `web/src/test/Car.reactions.test.tsx`

- [ ] **Step 1: Write the failing test for `reactionSummaryBody`**

```ts
// web/src/test/format.reaction.test.ts
import { describe, it, expect } from 'vitest';
import { reactionSummaryBody } from '../lib/format';

describe('reactionSummaryBody', () => {
  it('lists non-zero kinds and the never-affects-score note', () => {
    expect(reactionSummaryBody({ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } })).toBe(
      '7 cosmetic reactions from teammates · 🔥 4 · ⚡ 2 · 🏎️ 1. Never affects score.',
    );
  });

  it('omits zero-count kinds', () => {
    expect(reactionSummaryBody({ total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } })).toBe(
      '4 cosmetic reactions from teammates · 🔥 2 · ⚡ 2. Never affects score.',
    );
  });

  it('reads "No boosts yet" when empty', () => {
    expect(reactionSummaryBody({ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } })).toBe(
      '0 cosmetic reactions from teammates · No boosts yet. Never affects score.',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/format.reaction.test.ts`
Expected: FAIL — `reactionSummaryBody` is not exported from `../lib/format`.

- [ ] **Step 3: Add `reactionSummaryBody` to `format.ts`**

Open `web/src/lib/format.ts` and add the import + function (the file already imports from `./types` and `./tooltip`):

```ts
// web/src/lib/format.ts — add ReactionKind/ReactionSummary to the existing `./types` import,
// then append:
import type { ReactionKind, ReactionSummary } from './types';

const REACTION_KIND_ORDER: ReactionKind[] = ['🔥', '⚡', '🏎️'];

/** Body for the reaction-count tooltip: total + per-kind breakdown + the cosmetic-only note. */
export function reactionSummaryBody(r: ReactionSummary): string {
  const parts = REACTION_KIND_ORDER.filter((k) => r.byKind[k] > 0).map((k) => `${k} ${r.byKind[k]}`);
  const line = parts.length ? parts.join(' · ') : 'No boosts yet';
  return `${r.total} cosmetic reactions from teammates · ${line}. Never affects score.`;
}
```

> If `ReactionKind`/`ReactionSummary` are already in `format.ts`'s `./types` import, just append the constant + function. Do not duplicate the `import` line.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/format.reaction.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/format.ts web/src/test/format.reaction.test.ts
git commit -m "feat(web): add reactionSummaryBody tooltip formatter"
```

- [ ] **Step 6: Write the failing test for `ReactionCount`**

```tsx
// web/src/test/ReactionCount.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { ReactionCount } from '../components/ReactionCount';

describe('ReactionCount', () => {
  it('renders the total followed by a 🔥 glyph', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
  });

  it('exposes a tooltip with the per-kind breakdown and the never-affects-score note', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }} />
      </TooltipProvider>,
    );
    const tipStr = screen.getByTestId('reaction-count').getAttribute('data-tip') ?? '';
    expect(tipStr).toMatch(/Pit-stop boosts\|\|/);
    expect(tipStr).toMatch(/🔥 4/);
    expect(tipStr).toMatch(/⚡ 2/);
    expect(tipStr).toMatch(/🏎️ 1/);
    expect(tipStr).toMatch(/Never affects score\./);
  });

  it('reads "No boosts yet" when empty', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } }} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count').textContent).toBe('0🔥');
    expect(screen.getByTestId('reaction-count').getAttribute('data-tip') ?? '').toMatch(/No boosts yet/);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/ReactionCount.test.tsx`
Expected: FAIL — cannot resolve `../components/ReactionCount`.

- [ ] **Step 8: Write the ReactionCount component (matches plan-03's read-only count styling: `.mono`, accent2, text id `reaction-count`)**

```tsx
// web/src/components/ReactionCount.tsx
import type { ReactionSummary } from '../lib/types';
import { reactionSummaryBody } from '../lib/format';
import { tip } from '../lib/tooltip';

export function ReactionCount({ reactions }: { reactions: ReactionSummary }) {
  return (
    <span
      data-testid="reaction-count"
      data-tip={tip('Pit-stop boosts', reactionSummaryBody(reactions))}
      className="mono cursor-help text-[10px] font-bold text-accent2"
    >
      {reactions.total}🔥
    </span>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/ReactionCount.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 10: Commit**

```bash
git add web/src/components/ReactionCount.tsx web/src/test/ReactionCount.test.tsx
git commit -m "feat(web): reaction-count component with boost-breakdown tooltip"
```

- [ ] **Step 11: Write the failing Car integration test**

```tsx
// web/src/test/Car.reactions.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { Car } from '../components/Car';
import * as api from '../lib/api';
import type { RacerStanding } from '../lib/types';

const STANDING: RacerStanding = {
  login: 'devon-r',
  displayName: 'devon-r',
  avatarUrl: '',
  score: 44,
  breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
  position: 1,
  gapToLeader: 0,
  isLeader: true,
  topMover: true,
  reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } },
  cosmetics: [],
};

function renderCar(live: boolean) {
  return render(
    <TooltipProvider>
      <Car standing={STANDING} topScore={44} live={live} reactor="tester" />
    </TooltipProvider>,
  );
}

describe('Car reactions wiring', () => {
  beforeEach(() => {
    vi.spyOn(api, 'postReaction').mockResolvedValue({
      ok: true,
      reactions: { total: 8, byKind: { '🔥': 4, '⚡': 3, '🏎️': 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the reaction count and an enabled boost button on a live day', () => {
    renderCar(true);
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeEnabled();
  });

  it('clicking boost optimistically increments the displayed count immediately', async () => {
    renderCar(true);
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    expect(screen.getByTestId('reaction-count').textContent).toBe('8🔥');
  });

  it('omits the boost button when live is undefined (plan-03 read-only mode preserved)', () => {
    render(
      <TooltipProvider>
        <Car standing={STANDING} topScore={44} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /boost devon-r/i })).toBeNull();
  });

  it('disables boosting on an archived/replay day (live=false)', () => {
    renderCar(false);
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeDisabled();
  });
});
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/Car.reactions.test.tsx`
Expected: FAIL — plan-03's `Car` renders a static reaction count and no boost button; the optimistic-increment and disabled-button assertions fail.

- [ ] **Step 13: Modify plan-03's `Car.tsx` in place — swap the static count for `ReactionCount` + add `BoostButton`**

Plan 03's `Car` is Tailwind/inline with `colorFor`/`initialsFor` from `TimingTower`, exports `carPct`, and renders the label span (class `clabel …`) whose last child is the read-only `reaction-count` span. Make these **additive** edits, leaving everything else (pod, avatar, DRS, `data-testid="car"`, `carPct`) untouched:

a) extend the imports at the top of `web/src/components/Car.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { RacerStanding, ReactionSummary } from '../lib/types';
import { ReactionCount } from './ReactionCount';
import { BoostButton } from './BoostButton';
```

b) widen the signature (props are optional so plan-03 call sites `<Car standing topScore />` still compile and stay read-only):

```tsx
export function Car({
  standing,
  topScore,
  live,
  reactor,
  displayScore,
}: {
  standing: RacerStanding;
  topScore: number;
  /** When true the boost button is enabled; false = archived read-only; undefined = no boost button. */
  live?: boolean;
  reactor?: string;
  /** Replay/archived: overrides the standing score for car positioning (interpolated). */
  displayScore?: number;
}) {
```

c) inside the component body, derive the optimistic reactions state and use `displayScore` for the `left` position. Replace the existing `const left = …` line and add state right after it:

```tsx
  const left = `${carPct(displayScore ?? standing.score, topScore)}%`;

  // Optimistic reaction summary, re-synced whenever the server-supplied standing changes.
  const [reactions, setReactions] = useState<ReactionSummary>(standing.reactions);
  useEffect(() => setReactions(standing.reactions), [standing.reactions]);

  const bumpLocal = () =>
    setReactions((r) => ({
      total: r.total + 1,
      byKind: { ...r.byKind, '⚡': r.byKind['⚡'] + 1 },
    }));
```

d) in the `.clabel` label span, replace the plan-03 read-only `reaction-count` span:

```tsx
          {/* plan 03 had:  <span data-testid="reaction-count" …>{standing.reactions.total}🔥</span> */}
          <span className="ml-[5px] inline-flex items-center gap-[4px]">
            <ReactionCount reactions={reactions} />
            {live !== undefined && (
              <BoostButton
                targetLogin={standing.login}
                reactor={reactor ?? 'you'}
                live={live}
                onClickOptimistic={bumpLocal}
                onBoosted={(s) => setReactions(s)}
              />
            )}
          </span>
```

> The `reaction-count` test id now lives inside `ReactionCount` (Task 2 Step 8), so plan-03's `Car.test.tsx` (`expect(screen.getByTestId('reaction-count')).toHaveTextContent('7')`) still passes because the initial `reactions` state equals `standing.reactions`.

- [ ] **Step 14: Run the Car tests (new + plan-03's) to verify they pass**

Run: `npm test -w @racingshape/web -- run src/test/Car.reactions.test.tsx`
Expected: PASS (4 passing).
Run: `npm test -w @racingshape/web -- run src/test/Car.test.tsx`
Expected: PASS — plan-03's Car tests still green (props are optional; read-only count preserved).

- [ ] **Step 15: Commit**

```bash
git add web/src/components/Car.tsx web/src/test/Car.reactions.test.tsx
git commit -m "feat(web): wire boost button + optimistic reaction count into Car"
```

---

## Task 3: Cosmetics — earned car cosmetic layer over the pod (replace the stub)

**Files:**
- Modify (replace stub): `web/src/components/cosmetics/Cosmetics.tsx`
- Test: `web/src/test/cosmetics/Cosmetics.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/test/cosmetics/Cosmetics.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../../lib/tooltip';
import { Cosmetics } from '../../components/cosmetics/Cosmetics';
import type { Cosmetic } from '../../lib/types';

function renderCosmetics(cosmetics: Cosmetic[]) {
  return render(
    <TooltipProvider>
      <Cosmetics cosmetics={cosmetics} />
    </TooltipProvider>,
  );
}

describe('Cosmetics', () => {
  it('keeps the inert cosmetics-slot test id so plan-03 Car tests still pass', () => {
    renderCosmetics([]);
    expect(screen.getByTestId('cosmetics-slot')).toBeInTheDocument();
  });

  it('renders no cosmetic sprites when none are present', () => {
    renderCosmetics([]);
    expect(screen.queryByTestId('cosmetic-flame_trail')).toBeNull();
    expect(screen.queryByTestId('cosmetic-gold_rims')).toBeNull();
    expect(screen.queryByTestId('cosmetic-rookie_decal')).toBeNull();
  });

  it('renders a flame trail with an earned-by tooltip', () => {
    renderCosmetics(['flame_trail']);
    const el = screen.getByTestId('cosmetic-flame_trail');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Flame trail/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/streak of 5\+/i);
  });

  it('renders gold rims with an earned-by tooltip', () => {
    renderCosmetics(['gold_rims']);
    const el = screen.getByTestId('cosmetic-gold_rims');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Gold rims/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/first merge of the day/i);
  });

  it('renders the rookie decal with an earned-by tooltip', () => {
    renderCosmetics(['rookie_decal']);
    const el = screen.getByTestId('cosmetic-rookie_decal');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Rookie of the Day/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/most-improved vs yesterday/i);
  });

  it('renders all three together', () => {
    renderCosmetics(['flame_trail', 'gold_rims', 'rookie_decal']);
    expect(screen.getByTestId('cosmetic-flame_trail')).toBeInTheDocument();
    expect(screen.getByTestId('cosmetic-gold_rims')).toBeInTheDocument();
    expect(screen.getByTestId('cosmetic-rookie_decal')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/cosmetics/Cosmetics.test.tsx`
Expected: FAIL — the plan-03 stub renders only the inert `cosmetics-slot`, so the `cosmetic-flame_trail` etc. sprites are not found.

- [ ] **Step 3: Replace the stub with the real Cosmetics layer (Tailwind + inline styles + token vars; keeps `cosmetics-slot`)**

```tsx
// web/src/components/cosmetics/Cosmetics.tsx
import type { Cosmetic } from '../../lib/types';
import { tip } from '../../lib/tooltip';

const TOOLTIPS: Record<Cosmetic, [string, string]> = {
  flame_trail: ['Flame trail', 'Earned by a streak of 5+ consecutive active days. Cosmetic only.'],
  gold_rims: ['Gold rims', 'Earned for the first merge of the day. Cosmetic only.'],
  rookie_decal: ['Rookie of the Day', 'Earned for being most-improved vs yesterday. Cosmetic only.'],
};

/** A presentational layer painted over the existing pod (mockup pod is 50×22, rounded). */
export function Cosmetics({ cosmetics }: { cosmetics: Cosmetic[] }) {
  const has = (c: Cosmetic) => cosmetics.includes(c);

  return (
    <span
      data-testid="cosmetics-slot"
      data-count={cosmetics.length}
      className="pointer-events-none absolute left-0 top-0 z-[1] h-[22px] w-[50px]"
    >
      {has('flame_trail') && (
        <span
          data-testid="cosmetic-flame_trail"
          data-tip={tip(...TOOLTIPS.flame_trail)}
          className="pointer-events-auto absolute right-full top-1/2 mr-[2px] h-[14px] w-[26px] -translate-y-1/2 cursor-help rounded-[50%_0_0_50%] opacity-[.85]"
          style={{ background: 'linear-gradient(270deg, var(--amber), var(--accent), transparent)' }}
        />
      )}
      {has('gold_rims') && (
        <span
          data-testid="cosmetic-gold_rims"
          data-tip={tip(...TOOLTIPS.gold_rims)}
          className="pointer-events-auto absolute inset-[-2px] cursor-help rounded-[4px_11px_11px_4px] border-2 border-amber"
          style={{ boxShadow: '0 0 8px var(--amber)' }}
        />
      )}
      {has('rookie_decal') && (
        <span
          data-testid="cosmetic-rookie_decal"
          data-tip={tip(...TOOLTIPS.rookie_decal)}
          className="mono pointer-events-auto absolute left-[2px] top-[-7px] cursor-help rounded-[4px] bg-green px-[4px] py-[1px] text-[8px] font-bold tracking-[.5px] text-white"
        >
          ROOKIE
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/cosmetics/Cosmetics.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Verify plan-03's Car test still passes (it asserts a `cosmetics-slot` exists)**

Run: `npm test -w @racingshape/web -- run src/test/Car.test.tsx`
Expected: PASS — `cosmetics-slot` is still rendered.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/cosmetics/Cosmetics.tsx web/src/test/cosmetics/Cosmetics.test.tsx
git commit -m "feat(web): earned car cosmetics layer (flame trail, gold rims, rookie decal)"
```

---

## Task 4: Recap — Grand Prix recap card (podium + superlatives)

**Files:**
- Create: `web/src/components/Recap.tsx`
- Test: `web/src/test/Recap.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/test/Recap.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { Recap } from '../components/Recap';
import type { Recap as RecapType, Cosmetic } from '../lib/types';

const RECAP: RecapType = {
  raceDate: '2026-06-01',
  podium: [
    { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
    { position: 2, login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 } },
    { position: 3, login: 'sasha-p', displayName: 'sasha-p', avatarUrl: '', score: 27, breakdown: { commit: 7, pr_opened: 0, pr_merged: 3, issue_closed: 0 } },
  ],
  superlatives: [
    { key: 'fastest_hour', title: 'Fastest hour', login: 'devon-r', detail: '9 commits · 2–3pm' },
    { key: 'comeback', title: 'Comeback of the day', login: 'mira-k', detail: '+22 after 6pm' },
    { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'no late activity' },
  ],
};

const COSMETICS: Record<string, Cosmetic[]> = {
  'devon-r': ['gold_rims'],
  'mira-k': ['flame_trail'],
};

function renderRecap(recap = RECAP, earned = COSMETICS) {
  return render(
    <TooltipProvider>
      <Recap recap={recap} cosmeticsByLogin={earned} onExportPng={() => {}} replayLink="http://x/race/2026-06-01" />
    </TooltipProvider>,
  );
}

describe('Recap', () => {
  it('renders the three podium steps in P2, P1, P3 visual order with P1 raised', () => {
    renderRecap();
    const steps = screen.getAllByTestId(/^podium-step-/);
    expect(steps.map((s) => s.getAttribute('data-testid'))).toEqual([
      'podium-step-2',
      'podium-step-1',
      'podium-step-3',
    ]);
    const p1 = screen.getByTestId('podium-step-1');
    expect(p1.className).toMatch(/raised/);
    expect(within(p1).getByText('devon-r')).toBeInTheDocument();
    expect(within(p1).getByText(/44 PTS/)).toBeInTheDocument();
  });

  it('gives each podium step a per-racer breakdown tooltip', () => {
    renderRecap();
    const pil = within(screen.getByTestId('podium-step-1')).getByTestId('podium-pil-1');
    const tipStr = pil.getAttribute('data-tip') ?? '';
    expect(tipStr).toMatch(/P1 · devon-r/);
    expect(tipStr).toMatch(/commits/);
  });

  it('renders three superlative tiles with definition tooltips', () => {
    renderRecap();
    expect(screen.getAllByTestId(/^super-/)).toHaveLength(3);
    const fastest = screen.getByTestId('super-fastest_hour');
    expect(fastest.textContent).toMatch(/Fastest hour/);
    expect(fastest.textContent).toMatch(/devon-r/);
    expect(fastest.getAttribute('data-tip') ?? '').toMatch(/Most points scored in any single 60-min window/);
  });

  it('renders an em-dash placeholder for a null-login superlative', () => {
    renderRecap();
    expect(screen.getByTestId('super-midnight_grinder').textContent).toMatch(/—/);
  });

  it('lists the cosmetics earned that day', () => {
    renderRecap();
    const earned = screen.getByTestId('recap-cosmetics');
    expect(earned.textContent).toMatch(/devon-r/);
    expect(earned.textContent).toMatch(/Gold rims/);
    expect(earned.textContent).toMatch(/mira-k/);
    expect(earned.textContent).toMatch(/Flame trail/);
  });

  it('renders nothing when there is no podium (empty day)', () => {
    const { container } = renderRecap({ ...RECAP, podium: [] }, {});
    expect(container.querySelector('[data-testid="recap-card"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/Recap.test.tsx`
Expected: FAIL — cannot resolve `../components/Recap`.

- [ ] **Step 3: Write the Recap component (markup ported from the mockup `.recap/.podium/.step/.supers/.super`; Tailwind utilities + inline styles for the podium-step gradients/heights; `data-tip` attributes; `id="recap-card"` for PNG export)**

```tsx
// web/src/components/Recap.tsx
import type { Recap as RecapType, PodiumStep, Superlative, Cosmetic } from '../lib/types';
import { breakdownBody } from '../lib/format';
import { tip } from '../lib/tooltip';

const MEDAL: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };
const SUPER_EMOJI: Record<Superlative['key'], string> = {
  fastest_hour: '⚡',
  comeback: '📈',
  midnight_grinder: '🌙',
};
const SUPER_DEF: Record<Superlative['key'], string> = {
  fastest_hour: 'Most points scored in any single 60-min window of the day.',
  comeback: 'Biggest climb in standings during the second half of the day.',
  midnight_grinder: 'Latest tracked activity before the day closed.',
};
const COSMETIC_LABEL: Record<Cosmetic, string> = {
  flame_trail: 'Flame trail',
  gold_rims: 'Gold rims',
  rookie_decal: 'Rookie of the Day',
};

/** Visual podium order: silver (P2) · gold (P1, raised) · bronze (P3) — mockup layout. */
function visualOrder(podium: PodiumStep[]): PodiumStep[] {
  const byPos = new Map(podium.map((p) => [p.position, p]));
  return [byPos.get(2), byPos.get(1), byPos.get(3)].filter((p): p is PodiumStep => Boolean(p));
}

/** Mockup .pil heights: P1 104, P2 78, P3 58. P1 gets the amber tint/border. */
function pilStyle(position: number): React.CSSProperties {
  const height = position === 1 ? 104 : position === 2 ? 78 : 58;
  return position === 1
    ? { height, borderColor: 'var(--amber)', background: 'linear-gradient(180deg, rgba(255,179,0,.25), var(--panel))' }
    : { height, background: 'linear-gradient(180deg, var(--panel2), var(--panel))' };
}

function podiumTip(step: PodiumStep): string {
  return tip(`P${step.position} · ${step.login} — ${step.score} pts`, breakdownBody(step.breakdown));
}

export interface RecapProps {
  recap: RecapType;
  cosmeticsByLogin: Record<string, Cosmetic[]>;
  onExportPng: () => void;
  replayLink: string;
}

export function Recap({ recap, cosmeticsByLogin, onExportPng, replayLink }: RecapProps) {
  if (!recap.podium || recap.podium.length === 0) return null;

  const earned = Object.entries(cosmeticsByLogin).flatMap(([login, cs]) =>
    cs.map((c) => ({ login, c })),
  );

  return (
    <div
      data-testid="recap-card"
      id="recap-card"
      className="mt-[16px] overflow-hidden rounded-[10px] border border-line bg-panel"
      style={{ borderTop: '4px solid var(--accent)' }}
    >
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">🏆</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">GRAND PRIX RESULT — {recap.raceDate}</h2>
        <div className="ml-auto flex items-center gap-[9px]">
          <span
            data-tip={tip('Recap', "Auto-generated at midnight from the day's archive snapshot.")}
            className="mono cursor-help rounded-[5px] border border-amber px-[8px] py-[3px] text-[10px] tracking-[1px] text-amber"
          >
            PODIUM
          </span>
          <button
            type="button"
            data-testid="export-png"
            onClick={onExportPng}
            data-tip={tip('Export PNG', 'Render this recap card to a share-ready PNG.')}
            className="rounded-[7px] border border-line bg-panel2 px-[10px] py-[6px] font-head text-[12px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
          >
            ⬇ EXPORT PNG
          </button>
          <button
            type="button"
            data-testid="copy-replay-link"
            onClick={() => void navigator.clipboard?.writeText(replayLink)}
            data-tip={tip('Replay link', "Copy a link to this day's ~15s replay.")}
            className="rounded-[7px] border border-line bg-panel2 px-[10px] py-[6px] font-head text-[12px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
          >
            🔗 REPLAY LINK
          </button>
        </div>
      </div>

      <div className="flex items-end justify-center gap-[14px] px-[16px] pb-[10px] pt-[20px]">
        {visualOrder(recap.podium).map((step) => (
          <div
            key={step.position}
            data-testid={`podium-step-${step.position}`}
            className={`text-center ${step.position === 1 ? 'raised' : ''}`}
          >
            <div
              data-testid={`podium-pil-${step.position}`}
              data-tip={podiumTip(step)}
              className="flex w-[78px] cursor-help items-start justify-center rounded-[6px_6px_0_0] border border-line pt-[8px] text-[22px]"
              style={pilStyle(step.position)}
            >
              {MEDAL[step.position]}
            </div>
            <div className="mt-[7px] font-head text-[14px] font-bold tracking-[1px]">{step.login}</div>
            <div className="mono text-[11px] text-cyan">{step.score} PTS</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line">
        {recap.superlatives.map((s) => (
          <div
            key={s.key}
            data-testid={`super-${s.key}`}
            data-tip={tip(s.title, SUPER_DEF[s.key])}
            className="cursor-help bg-panel px-[14px] py-[13px]"
          >
            <div className="font-head text-[10px] font-bold uppercase tracking-[1px] text-amber">
              {SUPER_EMOJI[s.key]} {s.title}
            </div>
            <div className="mono mt-[4px] text-[15px] font-bold">{s.login ?? '—'}</div>
            <div className="text-[11px] text-muted">{s.detail}</div>
          </div>
        ))}
      </div>

      {earned.length > 0 && (
        <div
          data-testid="recap-cosmetics"
          className="flex flex-wrap gap-[8px] border-t border-line px-[16px] py-[12px] font-head text-[11px] font-semibold tracking-[.5px] text-muted"
        >
          <span>Cosmetics earned:</span>
          {earned.map(({ login, c }) => (
            <span key={`${login}-${c}`} className="rounded-[20px] border border-line px-[9px] py-[3px] text-ink">
              {login} · {COSMETIC_LABEL[c]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/Recap.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Recap.tsx web/src/test/Recap.test.tsx
git commit -m "feat(web): grand prix recap card with podium, superlatives, and earned cosmetics"
```

---

## Task 5: PNG export + copyable replay link wiring

> 💡 **`html-to-image`** rasterizes a live DOM node to a data-URL on the client canvas — no server render path. We mock it in tests and assert it was called with the recap node, not the resulting pixels.

**Files:**
- Modify: `web/package.json` (add `html-to-image` dependency)
- Create: `web/src/lib/exportPng.ts`
- Test: `web/src/test/exportPng.test.ts`

- [ ] **Step 1: Add the dependency**

Run: `npm install -w @racingshape/web html-to-image`
Expected: `html-to-image` appears under `dependencies` in `web/package.json`.

- [ ] **Step 2: Write the failing test (html-to-image mocked)**

```ts
// web/src/test/exportPng.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,ZZZ'),
}));

import { toPng } from 'html-to-image';
import { exportNodeToPng } from '../lib/exportPng';

describe('exportNodeToPng', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the given node to a PNG and triggers a download', async () => {
    const node = document.createElement('div');
    node.id = 'recap-card';
    await exportNodeToPng(node, 'racingshape-2026-06-01.png');

    expect(toPng).toHaveBeenCalledTimes(1);
    expect((toPng as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(node);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the node is null', async () => {
    await exportNodeToPng(null, 'x.png');
    expect(toPng).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/exportPng.test.ts`
Expected: FAIL — cannot resolve `../lib/exportPng`.

- [ ] **Step 4: Write the exportPng helper**

```ts
// web/src/lib/exportPng.ts
import { toPng } from 'html-to-image';

/** Render a DOM node to a PNG and trigger a browser download. No-op if node is null. */
export async function exportNodeToPng(node: HTMLElement | null, filename: string): Promise<void> {
  if (!node) return;
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor:
      getComputedStyle(document.documentElement).getPropertyValue('--panel') || '#11151c',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/exportPng.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 6: Commit**

```bash
git add web/package.json package-lock.json web/src/lib/exportPng.ts web/src/test/exportPng.test.ts
git commit -m "feat(web): recap PNG export via html-to-image"
```

---

## Task 6: DateSelector — list TODAY + archived days, switch to archived mode

> Plan 03 already provides `getRaces` in `api.ts`; this task adds a regression test for it (no production change needed there) and creates the real `DateSelector` (plan 03 inlined a disabled `<select>` stub directly in `Header`; this component replaces it when `Header` is rewired in Task 9).

**Files:**
- Create: `web/src/components/DateSelector.tsx`
- Test: `web/src/test/api.getRaces.test.ts`
- Test: `web/src/test/DateSelector.test.tsx`

- [ ] **Step 1: Write the regression test for `getRaces`**

```ts
// web/src/test/api.getRaces.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRaces } from '../lib/api';
import type { RaceListItem } from '../lib/types';

describe('getRaces', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /api/races and returns the parsed list', async () => {
    const list: RaceListItem[] = [
      { raceDate: '2026-06-01', topScore: 44, winnerLogin: 'devon-r' },
      { raceDate: '2026-05-31', topScore: 30, winnerLogin: 'mira-k' },
    ];
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => list });
    const res = await getRaces();
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/races');
    expect(res).toEqual(list);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes (plan 03 already exports `getRaces`)**

Run: `npm test -w @racingshape/web -- run src/test/api.getRaces.test.ts`
Expected: PASS (1 passing). If it FAILs because `getRaces` is missing, add it to `web/src/lib/api.ts`:

```ts
// web/src/lib/api.ts — only if plan 03 did not already provide it
export function getRaces(): Promise<RaceListItem[]> {
  return getJson<RaceListItem[]>('/api/races');
}
```

then re-run — expected PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/test/api.getRaces.test.ts
git commit -m "test(web): cover getRaces api client"
```

- [ ] **Step 4: Write the failing test for `DateSelector`**

```tsx
// web/src/test/DateSelector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { DateSelector } from '../components/DateSelector';
import type { RaceListItem } from '../lib/types';

const RACES: RaceListItem[] = [
  { raceDate: '2026-06-01', topScore: 44, winnerLogin: 'devon-r' },
  { raceDate: '2026-05-31', topScore: 30, winnerLogin: 'mira-k' },
];

describe('DateSelector', () => {
  it('renders a TODAY option plus one option per archived race', () => {
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={vi.fn()} />
      </TooltipProvider>,
    );
    const select = screen.getByRole('combobox', { name: /race day/i });
    const options = [...select.querySelectorAll('option')].map((o) => o.value);
    expect(options).toEqual(['today', '2026-06-01', '2026-05-31']);
    expect(screen.getByRole('option', { name: /TODAY/i })).toBeInTheDocument();
  });

  it('carries a tooltip attribute on the select', () => {
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('date-selector').getAttribute('data-tip') ?? '').toMatch(/\|\|/);
  });

  it('fires onSelect with the chosen race date', async () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={onSelect} />
      </TooltipProvider>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    expect(onSelect).toHaveBeenCalledWith('2026-06-01');
  });

  it('fires onSelect with "today" when TODAY is chosen', async () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="2026-06-01" onSelect={onSelect} />
      </TooltipProvider>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), 'today');
    expect(onSelect).toHaveBeenCalledWith('today');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/DateSelector.test.tsx`
Expected: FAIL — cannot resolve `../components/DateSelector`.

- [ ] **Step 6: Write the DateSelector component (matches plan-03's stub styling + `date-selector` test id; `data-tip` via `tip()`)**

```tsx
// web/src/components/DateSelector.tsx
import type { RaceListItem } from '../lib/types';
import { tip } from '../lib/tooltip';

export interface DateSelectorProps {
  races: RaceListItem[];
  /** "today" for the live day, or a YYYY-MM-DD archived date. */
  selected: string;
  onSelect: (value: string) => void;
}

export function DateSelector({ races, selected, onSelect }: DateSelectorProps) {
  return (
    <select
      data-testid="date-selector"
      aria-label="Race day"
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      data-tip={tip(
        'Race day',
        "Switch between today's live race and any archived day. Archived days replay as a ~15s fast-forward.",
      )}
      className="cursor-pointer appearance-none rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink hover:border-cyan"
    >
      <option value="today">TODAY · LIVE</option>
      {races.map((r) => (
        <option key={r.raceDate} value={r.raceDate}>
          {r.raceDate}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/DateSelector.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 8: Commit**

```bash
git add web/src/components/DateSelector.tsx web/src/test/DateSelector.test.tsx
git commit -m "feat(web): date selector lists today + archived races"
```

---

## Task 7: useReplay — deterministic frame stepper over archived snapshots

> 💡 **Tweening between frames:** snapshots are captured every ~5 min, so at any replay time we linearly interpolate each racer's score between the two surrounding frames — cars glide instead of jumping.

**Files:**
- Create: `web/src/replay/useReplay.ts`
- Test: `web/src/test/replay/useReplay.test.tsx`

- [ ] **Step 1: Write the failing test (fake timers)**

```tsx
// web/src/test/replay/useReplay.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplay, REPLAY_DURATION_MS } from '../../replay/useReplay';
import type { SnapshotFrame } from '../../lib/types';

// A full day: first capture ~00:00 ET, last ~23:55 ET. Two racers with linear growth.
const FRAMES: SnapshotFrame[] = [
  { capturedAt: '2026-06-01T04:00:00.000Z', scores: [{ login: 'a', score: 0 }, { login: 'b', score: 0 }] },
  { capturedAt: '2026-06-02T03:55:00.000Z', scores: [{ login: 'a', score: 40 }, { login: 'b', score: 20 }] },
];

describe('useReplay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts paused at t=0 with the first frame scores', () => {
    const { result } = renderHook(() => useReplay(FRAMES));
    expect(result.current.playing).toBe(false);
    expect(result.current.t).toBe(0);
    expect(result.current.speed).toBe(1);
    expect(result.current.scores).toEqual({ a: 0, b: 0 });
  });

  it('compresses the full day to ~REPLAY_DURATION_MS at 1x', () => {
    const { result } = renderHook(() => useReplay(FRAMES));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS / 2);
    });
    expect(result.current.scores.a).toBeCloseTo(20, 0);
    expect(result.current.scores.b).toBeCloseTo(10, 0);

    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS / 2 + 100);
    });
    expect(result.current.t).toBe(1);
    expect(result.current.scores).toEqual({ a: 40, b: 20 });
    expect(result.current.playing).toBe(false);
  });

  it('scales speed: 2x reaches the end in half the wall time', () => {
    const { result } = renderHook(() => useReplay(FRAMES));
    act(() => result.current.setSpeed(2));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS / 2 + 50);
    });
    expect(result.current.t).toBe(1);
    expect(result.current.scores).toEqual({ a: 40, b: 20 });
  });

  it('pause stops advancing t', () => {
    const { result } = renderHook(() => useReplay(FRAMES));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS / 4);
    });
    const frozen = result.current.t;
    act(() => result.current.pause());
    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS);
    });
    expect(result.current.playing).toBe(false);
    expect(result.current.t).toBeCloseTo(frozen, 5);
  });

  it('handles a single-frame day by holding the final scores at t=1', () => {
    const single: SnapshotFrame[] = [
      { capturedAt: '2026-06-01T12:00:00.000Z', scores: [{ login: 'a', score: 7 }] },
    ];
    const { result } = renderHook(() => useReplay(single));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(REPLAY_DURATION_MS + 100);
    });
    expect(result.current.scores).toEqual({ a: 7 });
    expect(result.current.t).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/replay/useReplay.test.tsx`
Expected: FAIL — cannot resolve `../../replay/useReplay`.

- [ ] **Step 3: Write the useReplay hook**

```ts
// web/src/replay/useReplay.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SnapshotFrame } from '../lib/types';

/** A full archived day compresses to ~15s of wall time (roadmap §9, DESIGN §5.4). */
export const REPLAY_DURATION_MS = 15_000;
const TICK_MS = 1000 / 30; // ~30fps stepper

export type ReplayScores = Record<string, number>;

export interface ReplayState {
  playing: boolean;
  speed: number; // 1, 2, 4
  t: number; // 0..1 normalized progress through the day
  play: () => void;
  pause: () => void;
  setSpeed: (s: number) => void;
  scores: ReplayScores; // interpolated per-racer score at time t
}

/** Linear-interpolate every racer's score at normalized time t (0..1) across the frame span. */
function scoresAt(frames: SnapshotFrame[], t: number): ReplayScores {
  if (frames.length === 0) return {};
  if (frames.length === 1 || t <= 0) {
    const f = t <= 0 ? frames[0] : frames[frames.length - 1];
    return Object.fromEntries(f.scores.map((s) => [s.login, s.score]));
  }
  const first = new Date(frames[0].capturedAt).getTime();
  const last = new Date(frames[frames.length - 1].capturedAt).getTime();
  const span = Math.max(last - first, 1);
  const target = first + t * span;

  // find the bracketing frames
  let lo = frames[0];
  let hi = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    const a = new Date(frames[i].capturedAt).getTime();
    const b = new Date(frames[i + 1].capturedAt).getTime();
    if (target >= a && target <= b) {
      lo = frames[i];
      hi = frames[i + 1];
      break;
    }
  }
  const aT = new Date(lo.capturedAt).getTime();
  const bT = new Date(hi.capturedAt).getTime();
  const frac = bT === aT ? 1 : (target - aT) / (bT - aT);

  const loMap = new Map(lo.scores.map((s) => [s.login, s.score]));
  const hiMap = new Map(hi.scores.map((s) => [s.login, s.score]));
  const logins = new Set<string>([...loMap.keys(), ...hiMap.keys()]);
  const out: ReplayScores = {};
  for (const login of logins) {
    const a = loMap.get(login) ?? 0;
    const b = hiMap.get(login) ?? a;
    out[login] = a + (b - a) * frac;
  }
  return out;
}

export function useReplay(frames: SnapshotFrame[]): ReplayState {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const play = useCallback(() => {
    setT((cur) => (cur >= 1 ? 0 : cur)); // restart if at the end
    setPlaying(true);
  }, []);
  const pause = useCallback(() => {
    setPlaying(false);
    clear();
  }, [clear]);

  useEffect(() => {
    if (!playing) {
      clear();
      return;
    }
    timer.current = setInterval(() => {
      setT((cur) => {
        const next = cur + (TICK_MS * speed) / REPLAY_DURATION_MS;
        if (next >= 1) {
          setPlaying(false);
          clear();
          return 1;
        }
        return next;
      });
    }, TICK_MS);
    return clear;
  }, [playing, speed, clear]);

  return { playing, speed, t, play, pause, setSpeed, scores: scoresAt(frames, t) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/replay/useReplay.test.tsx`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add web/src/replay/useReplay.ts web/src/test/replay/useReplay.test.tsx
git commit -m "feat(web): deterministic replay frame stepper with score interpolation"
```

---

## Task 8: ReplayControls — play/pause + speed, bound to useReplay

**Files:**
- Create: `web/src/components/ReplayControls.tsx`
- Test: `web/src/test/ReplayControls.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/test/ReplayControls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { ReplayControls } from '../components/ReplayControls';

function setup(over: Partial<React.ComponentProps<typeof ReplayControls>> = {}) {
  const props = {
    enabled: true,
    playing: false,
    speed: 1,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSpeed: vi.fn(),
    ...over,
  };
  render(
    <TooltipProvider>
      <ReplayControls {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe('ReplayControls', () => {
  it('is disabled when not an archived day', () => {
    setup({ enabled: false });
    expect(screen.getByRole('button', { name: /replay/i })).toBeDisabled();
  });

  it('calls onPlay when paused and the button is clicked', async () => {
    const props = setup({ enabled: true, playing: false });
    await userEvent.click(screen.getByRole('button', { name: /replay/i }));
    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });

  it('shows pause and calls onPause while playing', async () => {
    const props = setup({ enabled: true, playing: true });
    const btn = screen.getByRole('button', { name: /pause|replay/i });
    expect(btn.textContent).toMatch(/❚❚|PAUSE/i);
    await userEvent.click(btn);
    expect(props.onPause).toHaveBeenCalledTimes(1);
  });

  it('cycles speed 1x → 2x', async () => {
    const props = setup({ enabled: true, speed: 1 });
    await userEvent.click(screen.getByRole('button', { name: /speed/i }));
    expect(props.onSpeed).toHaveBeenCalledWith(2);
  });

  it('disables the speed control too when not enabled', () => {
    setup({ enabled: false });
    expect(screen.getByRole('button', { name: /speed/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/ReplayControls.test.tsx`
Expected: FAIL — cannot resolve `../components/ReplayControls`.

- [ ] **Step 3: Write the ReplayControls component (matches plan-03's stub chip styling + `replay-btn` test id; `data-tip` via `tip()`)**

```tsx
// web/src/components/ReplayControls.tsx
import { tip } from '../lib/tooltip';

const SPEEDS = [1, 2, 4] as const;

export interface ReplayControlsProps {
  enabled: boolean;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (s: number) => void;
}

const chipClass =
  'flex items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink hover:border-cyan disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line';

export function ReplayControls({ enabled, playing, speed, onPlay, onPause, onSpeed }: ReplayControlsProps) {
  const nextSpeed = () => {
    const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    return SPEEDS[(i + 1) % SPEEDS.length];
  };
  return (
    <span className="inline-flex gap-[9px]">
      <button
        type="button"
        data-testid="replay-btn"
        aria-label={playing ? 'Pause replay' : 'Replay'}
        disabled={!enabled}
        onClick={() => (playing ? onPause() : onPlay())}
        data-tip={tip(
          'Replay',
          'Play the selected day back as a compressed fast-forward — full day in ~15 seconds.',
        )}
        className={chipClass}
      >
        {playing ? '❚❚ PAUSE' : '▶ REPLAY'}
      </button>
      <button
        type="button"
        data-testid="replay-speed"
        aria-label="Replay speed"
        disabled={!enabled}
        onClick={() => onSpeed(nextSpeed())}
        data-tip={tip('Replay speed', 'Cycle playback speed: 1× → 2× → 4×.')}
        className={chipClass}
      >
        {speed}×
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/ReplayControls.test.tsx`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReplayControls.tsx web/src/test/ReplayControls.test.tsx
git commit -m "feat(web): replay play/pause + speed controls"
```

---

## Task 9: App + Header integration — archived/replay mode vs live polling

**Files:**
- Modify: `web/src/components/Header.tsx` (turn the no-props stub Header into a props-driven Header mounting the real `DateSelector` + `ReplayControls`)
- Modify: `web/src/components/Track.tsx` (thread `live`/`reactor`/`displayScoreFor` to each `Car`)
- Modify: `web/src/components/RaceControl.tsx` (pass `live`/`reactor`/`displayScoreFor` through to `Track`)
- Modify: `web/src/App.tsx` (selectedDate state, archived fetch, replay-driven scores, mount `Recap`, PNG export, disable boosting off-live)
- Test: `web/src/test/App.archived.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```tsx
// web/src/test/App.archived.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../lib/api';
import type { RaceToday, RaceArchive, RaceListItem, StatsResponse } from '../lib/types';

const TODAY: RaceToday = {
  raceDate: '2026-06-02',
  live: true,
  topScore: 12,
  lastPolledAt: '2026-06-02T15:00:00.000Z',
  standings: [
    {
      login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 12,
      breakdown: { commit: 12, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
      position: 1, gapToLeader: 0, isLeader: true, topMover: true,
      reactions: { total: 2, byKind: { '🔥': 2, '⚡': 0, '🏎️': 0 } }, cosmetics: [],
    },
  ],
};

const RACES: RaceListItem[] = [{ raceDate: '2026-06-01', topScore: 44, winnerLogin: 'devon-r' }];

const ARCHIVE: RaceArchive = {
  raceDate: '2026-06-01',
  live: false,
  topScore: 44,
  standings: [
    {
      login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44,
      breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
      position: 1, gapToLeader: 0, isLeader: true, topMover: false,
      reactions: { total: 7, byKind: { '🔥': 5, '⚡': 1, '🏎️': 1 } }, cosmetics: ['gold_rims'],
    },
    {
      login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31,
      breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 },
      position: 2, gapToLeader: 13, isLeader: false, topMover: false,
      reactions: { total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } }, cosmetics: ['flame_trail'],
    },
  ],
  frames: [
    { capturedAt: '2026-06-01T04:00:00.000Z', scores: [{ login: 'devon-r', score: 0 }, { login: 'mira-k', score: 0 }] },
    { capturedAt: '2026-06-02T03:55:00.000Z', scores: [{ login: 'devon-r', score: 44 }, { login: 'mira-k', score: 31 }] },
  ],
  reactions: [
    { targetLogin: 'devon-r', kind: '🔥', reactor: 'mira-k', createdAt: '2026-06-01T18:00:00.000Z' },
  ],
  recap: {
    raceDate: '2026-06-01',
    podium: [
      { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
      { position: 2, login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 } },
    ],
    superlatives: [
      { key: 'fastest_hour', title: 'Fastest hour', login: 'devon-r', detail: '9 commits · 2–3pm' },
      { key: 'comeback', title: 'Comeback of the day', login: 'mira-k', detail: '+22 after 6pm' },
      { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'no late activity' },
    ],
  },
};

const STATS: StatsResponse = {
  range: '14d', repoUrl: 'https://github.com/S2AI/s2shape', chart: [],
  totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 },
  completion: { rate: 0, closed: 0, opened: 0 },
  streak: { current: 0, startDate: null, bestThisMonth: 0 },
};

vi.mock('../lib/api');
import App from '../App';

describe('App archived/replay mode', () => {
  beforeEach(() => {
    vi.mocked(api.getRaceToday).mockResolvedValue(TODAY);
    vi.mocked(api.getRaces).mockResolvedValue(RACES);
    vi.mocked(api.getStats).mockResolvedValue(STATS);
    vi.mocked(api.getArchive).mockResolvedValue(ARCHIVE);
    vi.mocked(api.postReaction).mockResolvedValue({ ok: true, reactions: TODAY.standings[0].reactions });
  });
  afterEach(() => vi.clearAllMocks());

  it('starts live: polls getRaceToday and enables boosting', async () => {
    render(<App />);
    await waitFor(() => expect(api.getRaceToday).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /boost devon-r/i })).toBeEnabled();
    expect(screen.queryByTestId('recap-card')).toBeNull();
  });

  it('selecting an archived date fetches the archive, shows the recap + replay controls, and disables boosting', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalledWith('2026-06-01'));

    expect(await screen.findByTestId('recap-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replay/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeDisabled();
  });

  it('positions cars from replay scores at t=0 (start line) for an archived day', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalled());

    const cars = await screen.findAllByTestId('car');
    cars.forEach((c) => expect((c as HTMLElement).style.left).toBe('2%')); // pct(0,44) = 2%
  });

  it('switching back to TODAY resumes live polling and re-enables boosting', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), 'today');
    expect(await screen.findByRole('button', { name: /boost devon-r/i })).toBeEnabled();
    expect(screen.queryByTestId('recap-card')).toBeNull();
  });
});
```

> `vi.mock('../lib/api')` auto-mocks every named export; `vi.mocked(...)` gives typed mock handles. At replay `t=0` the interpolated scores are 0, so `carPct(0, 44) = 2` → `left: '2%'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @racingshape/web -- run src/test/App.archived.test.tsx`
Expected: FAIL — plan-03's `App` is always-live (no archive fetch, no Recap, no replay-driven scores, boost button always live), and `Header` takes no props.

- [ ] **Step 3: Rewire `Header` to be props-driven (mount the real `DateSelector` + `ReplayControls`)**

Replace plan-03's no-props `Header` (which inlined disabled stubs) with a props-driven one. It keeps the same markup/classes and the `live-chip`/`theme-btn` test ids, and renders the real `DateSelector`/`ReplayControls` (which carry the `date-selector`/`replay-btn` ids). Full file:

```tsx
// web/src/components/Header.tsx
import type { RaceListItem } from '../lib/types';
import { tip } from '../lib/tooltip';
import { useTheme } from '../lib/useTheme';
import { DateSelector } from './DateSelector';
import { ReplayControls } from './ReplayControls';

export interface HeaderProps {
  live: boolean;
  races: RaceListItem[];
  selectedDate: string;
  onSelectDate: (value: string) => void;
  replay: {
    enabled: boolean;
    playing: boolean;
    speed: number;
    onPlay: () => void;
    onPause: () => void;
    onSpeed: (s: number) => void;
  };
}

export function Header({ live, races, selectedDate, onSelectDate, replay }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-line border-l-[5px] border-l-accent bg-gradient-to-r from-panel to-panel2 px-[18px] py-[14px]">
      <div className="flex items-center gap-[13px]">
        <div className="grid h-[46px] w-[46px] place-items-center rounded-[9px] bg-accent text-[24px] shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset]">
          🏁
        </div>
        <div>
          <h1 className="font-head text-[24px] font-bold leading-none tracking-[3px]">RACINGSHAPE</h1>
          <div className="mono mt-[3px] text-[10px] tracking-[2px] text-muted">
            SHIP CODE · RACE CARS · WIN THE DAY
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap items-center gap-[9px]">
        {live && (
          <div
            data-testid="live-chip"
            data-tip={tip(
              'Live race',
              'Polling GitHub every 60s. Scores recompute and cars animate to new positions on each poll.',
            )}
            className="flex cursor-help items-center gap-[7px] rounded-[7px] border border-accent bg-accent px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-white"
          >
            <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-white" />
            LIVE
          </div>
        )}

        <DateSelector races={races} selected={selectedDate} onSelect={onSelectDate} />
        <ReplayControls {...replay} />

        <button
          type="button"
          data-testid="theme-btn"
          onClick={toggle}
          data-tip={tip('Theme', 'Toggle dark / light. Choice persists across sessions.')}
          className="flex items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
        >
          {theme === 'dark' ? '🌙 DARK' : '☀️ LIGHT'}
        </button>
      </div>
    </header>
  );
}
```

> Plan-03's `Header.test.tsx` rendered `<Header />` with no props and asserted a disabled date-selector + disabled replay-btn. That test belongs to plan 03's now-superseded stub; this plan's `App.archived.test.tsx` covers the real Header behavior. When running the full suite (Step 8), update plan-03's `Header.test.tsx` to render `<Header live races={[]} selectedDate="today" onSelectDate={() => {}} replay={{ enabled: false, playing: false, speed: 1, onPlay() {}, onPause() {}, onSpeed() {} }} />` and assert the LIVE chip + theme toggle + a `date-selector` combobox render (drop the "disabled stub" assertions, which no longer apply).

- [ ] **Step 4: Thread the boost props through `Track`**

Plan 03's `Track` is `{ standings, topScore }` and renders `<Car standing={r} topScore={topScore} />` per lane. Make these additive edits to `web/src/components/Track.tsx` — widen the signature and forward the new props (everything else, including the finish line and lanes, stays):

```tsx
export function Track({
  standings,
  topScore,
  live,
  reactor,
  displayScoreFor,
}: {
  standings: RacerStanding[];
  topScore: number;
  live?: boolean;
  reactor?: string;
  displayScoreFor?: (login: string) => number | undefined;
}) {
```

and change the per-lane `Car` render to:

```tsx
          <Car
            standing={r}
            topScore={topScore}
            live={live}
            reactor={reactor}
            displayScore={displayScoreFor?.(r.login)}
          />
```

- [ ] **Step 5: Thread the boost props through `RaceControl`**

Plan 03's `RaceControl` is `{ standings, topScore }` and renders `<Track standings={standings} topScore={topScore} />`. Make additive edits to `web/src/components/RaceControl.tsx` — widen the signature and forward:

```tsx
export function RaceControl({
  standings,
  topScore,
  live,
  reactor,
  displayScoreFor,
}: {
  standings: RacerStanding[];
  topScore: number;
  live?: boolean;
  reactor?: string;
  displayScoreFor?: (login: string) => number | undefined;
}) {
```

and change the `<Track …/>` render to:

```tsx
          <Track
            standings={standings}
            topScore={topScore}
            live={live}
            reactor={reactor}
            displayScoreFor={displayScoreFor}
          />
```

- [ ] **Step 6: Rewrite `App` for archived/replay mode**

Replace `web/src/App.tsx` so it: keeps live polling when `selectedDate === 'today'`; fetches `getArchive` and drives `Track`/`Car`s from `useReplay` interpolated scores on an archived date; shows reactions/cosmetics read-only and the `Recap` card with PNG export + replay link; and disables boosting off the live day. Full file:

```tsx
// web/src/App.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from './lib/tooltip';
import { usePolling } from './lib/usePolling';
import { getRaceToday, getStats, getRaces, getArchive } from './lib/api';
import type { RaceArchive, RaceListItem, RaceToday, RacerStanding, StatsResponse, Cosmetic } from './lib/types';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { TelemetryChart } from './components/TelemetryChart';
import { PitWall } from './components/PitWall';
import { Recap } from './components/Recap';
import { useReplay } from './replay/useReplay';
import { exportNodeToPng } from './lib/exportPng';

const POLL_MS = 60_000;
const REACTOR = 'you'; // free-text handle for v1 (PRD §5.7)

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const [races, setRaces] = useState<RaceListItem[]>([]);
  const [archive, setArchive] = useState<RaceArchive | null>(null);
  const isLive = selectedDate === 'today';

  // available archived days
  useEffect(() => {
    void getRaces().then(setRaces).catch(() => setRaces([]));
  }, []);

  // live polling (always running; we just ignore its output off the live day)
  const today = usePolling<RaceToday>(() => getRaceToday(), POLL_MS, []);
  const stats = usePolling<StatsResponse>(() => getStats('14d'), POLL_MS, []);

  // fetch the archive when a past day is selected
  useEffect(() => {
    if (isLive) {
      setArchive(null);
      return;
    }
    let cancelled = false;
    void getArchive(selectedDate).then((a) => {
      if (!cancelled) setArchive(a);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isLive]);

  // replay engine over the archive frames (empty when live)
  const frames = useMemo(() => archive?.frames ?? [], [archive]);
  const replay = useReplay(frames);

  // which standings + per-racer display score to render
  const standings: RacerStanding[] = isLive ? today.data?.standings ?? [] : archive?.standings ?? [];
  const topScore = isLive ? today.data?.topScore ?? 1 : archive?.topScore ?? 1;
  const displayScoreFor = useCallback(
    (login: string): number | undefined => (isLive ? undefined : replay.scores[login] ?? 0),
    [isLive, replay.scores],
  );

  // cosmetics earned that day, for the recap card
  const cosmeticsByLogin: Record<string, Cosmetic[]> = useMemo(() => {
    const src = isLive ? [] : archive?.standings ?? [];
    return Object.fromEntries(src.filter((s) => s.cosmetics.length > 0).map((s) => [s.login, s.cosmetics]));
  }, [isLive, archive]);

  const onExportPng = useCallback(() => {
    void exportNodeToPng(document.getElementById('recap-card'), `racingshape-${selectedDate}.png`);
  }, [selectedDate]);
  const replayLink = `${window.location.origin}/race/${selectedDate}`;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1320px]">
        <Header
          live={isLive}
          races={races}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          replay={{
            enabled: !isLive && frames.length > 0,
            playing: replay.playing,
            speed: replay.speed,
            onPlay: replay.play,
            onPause: replay.pause,
            onSpeed: replay.setSpeed,
          }}
        />

        <div className="mt-[16px] grid grid-cols-[1fr_310px] gap-[16px] max-[940px]:grid-cols-1">
          <div>
            <RaceControl
              standings={standings}
              topScore={topScore}
              live={isLive}
              reactor={REACTOR}
              displayScoreFor={displayScoreFor}
            />
            <div className="mt-[16px]">{stats.data && <TelemetryChart stats={stats.data} />}</div>
            {!isLive && archive && (
              <Recap
                recap={archive.recap}
                cosmeticsByLogin={cosmeticsByLogin}
                onExportPng={onExportPng}
                replayLink={replayLink}
              />
            )}
          </div>
          {stats.data && <PitWall stats={stats.data} />}
        </div>
      </div>
    </TooltipProvider>
  );
}
```

> Boosting is enabled only on the live day: `RaceControl` passes `live={isLive}` down to `Car`, so `BoostButton` is enabled live and disabled on archived days (Task 1). Reactions render read-only on archived days because `Car`'s `ReactionCount` shows the archived totals from `archive.standings[].reactions` and the boost button is disabled. Cosmetics replay with the day straight from `archive.standings[].cosmetics`.

- [ ] **Step 7: Run the integration test to verify it passes**

Run: `npm test -w @racingshape/web -- run src/test/App.archived.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 8: Update plan-03's superseded `Header.test.tsx`, then run the full web suite**

First update `web/src/test/Header.test.tsx` to the props-driven Header (per the note in Step 3), then:

Run: `npm test -w @racingshape/web`
Expected: PASS — all web tests green (plan 03 + plan 04).

- [ ] **Step 9: Verify the production build compiles**

Run: `npm run build -w @racingshape/web`
Expected: `tsc -b` reports no type errors and Vite writes `web/dist/`.

- [ ] **Step 10: Commit**

```bash
git add web/src/App.tsx web/src/components/Header.tsx web/src/components/Track.tsx web/src/components/RaceControl.tsx web/src/test/App.archived.test.tsx web/src/test/Header.test.tsx
git commit -m "feat(web): archived/replay mode with recap, read-only reactions, and replay-driven cars"
```

---

## Done when (maps to PRD §5.7 + roadmap §12 delight items)

- [ ] **Boosts spray + cheer + never change score.** Each car label has a ⚡ `BoostButton` (Task 1) that POSTs a `CreateReactionBody` via the new `postReaction` export, optimistically bumps the count (Task 2), sprays a 5-glyph ⚡/🔥/💨 particle burst, and floats a friendly named "cheer" affirmation — ported from the mockup `boost()`/`.spark`/`.cheer` (animations live in global `index.css`). Its `data-tip` reads "Cosmetic hype only — never changes score." Reactions never touch the score (no score field is written client-side; the API ignores reactions in scoring).
- [ ] **Recap card + PNG export + replay link.** `Recap` (Task 4) renders the three-step podium (P1 raised, amber-tinted) with per-racer breakdown tooltips, three superlative tiles with definition tooltips (null-login → "—"), and the day's earned cosmetics — markup ported from the mockup `.recap/.podium/.step/.supers/.super` using Tailwind utilities + inline styles. "Export PNG" rasterizes the `#recap-card` node via `html-to-image` (Task 5) and a "Replay link" button copies a link to the selected day.
- [ ] **Three starter cosmetics render and replay.** `Cosmetics` (Task 3) paints `flame_trail`, `gold_rims`, and `rookie_decal` over the pod with earned-by `data-tip`s (streak ≥ 5 / first merge / most-improved), keeping the inert `cosmetics-slot` id so plan-03 tests stay green. On archived days they replay because they come straight from `archive.standings[].cosmetics` (Task 9).
- [ ] **Any day replays as a ~15s fast-forward.** `useReplay` (Task 7) compresses the full day's frame span to `REPLAY_DURATION_MS` (15s) at 1×, interpolating per-racer scores; `ReplayControls` (Task 8) drive play/pause and 1×/2×/4× speed; `App` (Task 9) positions cars from the interpolated scores via `displayScoreFor` on archived days.
- [ ] **Archived reactions/cosmetics replay read-only.** On a selected past date, boosting is disabled (`BoostButton live={false}`), reaction counts show that day's archived totals, and cosmetics replay with the day (Task 9). The `DateSelector` (Task 6) switches between TODAY (live polling) and archived dates from `getRaces`; switching back to TODAY resumes live polling.
- [ ] **Every new metric has a tooltip (roadmap §11).** Reaction count, boost button, each cosmetic, each podium step, each superlative tile, and the date/replay controls all expose their breakdown via the single tooltip engine (`data-tip={tip(...)}`). No dead numbers.

**This completes v1.** With plans 01–04 green, the full roadmap done-definition (§12) is satisfied: a live race that resets and archives daily, a 14-day activity chart with GitHub links, the pit-wall stats, dark-mode persistence, ETag/backoff-safe polling, and — from this plan — pit-stop boosts, the Grand Prix recap (+PNG + replay link), the three starter cosmetics, and ~15s replay of any archived day.
