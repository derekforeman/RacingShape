# RacingShape — Frontend Shell & Live Race (Plan 03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vite + React + Tailwind web app — design tokens, one tooltip engine, header, timing tower, auto-scaling track with tweening cars, telemetry chart, pit-wall, and a persistent dark/light toggle — rendering a live dashboard against the API from plan 02.

**Architecture:** A single-page React app in the `web` workspace. It talks only to our own API (`/api/*`, dev-proxied to `http://localhost:8787`), never to GitHub. A generic `usePolling` hook refetches `/api/race/today` every 60s and pauses when the tab is hidden; `/api/stats?range=14d` is fetched once on mount. All visual tokens come from CSS custom properties on `<html data-theme>` (copied verbatim from the approved mockup), so components reference Tailwind/`var(--token)` and never hardcode hex. Every displayed number is wired through one shared tooltip engine (roadmap §11, "no dead numbers").

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS (+ PostCSS, Autoprefixer), Vitest + jsdom + @testing-library/react/user-event/jest-dom, `@racingshape/shared` (workspace types/scoring).

---

**Canonical contract:** [`2026-06-02-racingshape-roadmap.md`](2026-06-02-racingshape-roadmap.md) wins on every type name (§6), file path (§3), convention (§4), token (§9), the auto-scale rule (§10), and tooltip coverage (§11). Also read [`DESIGN.md`](../../../DESIGN.md) (§3 layout, §4 components, §6 hover-detail, §7 tokens, §8 states), [`mockup-2-f1-broadcast.html`](../../../mockup-2-f1-broadcast.html) (the approved visual reference — ported here), and [`prd.md`](../../../prd.md) §5.1–5.6.

**Depends on plan 02:** the API already serves `GET /api/race/today` (`RaceToday`), `GET /api/stats?range=14d` (`StatsResponse`), `GET /api/races` (`RaceListItem[]`), and `GET /api/race/:date` (`RaceArchive`), and `@racingshape/shared` already exports every type in roadmap §6. This plan consumes those — it does not rebuild any backend.

**Plan-04 boundary (read this first):** This plan ships a **static "today" view with live polling and cosmetics-agnostic cars.** The following are explicitly **PLAN 04**, not built here:
- Pit-stop boosts (particle burst + cheer + POST) — the reaction **count is rendered** (read-only) but no boost button is functional.
- Grand Prix recap card — App leaves a clearly-marked **mount-point stub** (`{/* PLAN 04: <Recap/> */}`) only.
- Earned cosmetics — `Car.tsx` renders an imported **empty `Cosmetics` stub** so the seam exists; the real sprite layer is plan 04.
- Date selector + Replay — the header renders a **disabled, non-functional date selector showing "TODAY"** and a **disabled Replay button**, both marked `PLAN 04`.

Where this plan creates a placeholder, it is real, compiling code that renders nothing harmful — never a `// TODO`.

---

## File structure (created by this plan)

```
web/package.json            @racingshape/web
web/tsconfig.json
web/vite.config.ts          react plugin + /api proxy + vitest (jsdom)
web/postcss.config.js
web/tailwind.config.ts
web/index.html              Google Fonts + <html data-theme="dark">
web/src/main.tsx            React root
web/src/index.css           Tailwind directives + canonical token CSS vars
web/src/test/setup.ts       jest-dom matchers
web/src/lib/types.ts        re-export from @racingshape/shared
web/src/lib/api.ts          typed fetch client
web/src/lib/usePolling.ts   generic interval-refetch hook
web/src/lib/useTheme.ts     dark/light + localStorage
web/src/lib/tooltip.tsx     TooltipProvider + useTip + <Tip>
web/src/lib/format.ts       breakdown -> tooltip text helpers
web/src/components/Header.tsx
web/src/components/TimingTower.tsx
web/src/components/Track.tsx
web/src/components/Car.tsx
web/src/components/cosmetics/Cosmetics.tsx   (empty stub; plan 04 fills)
web/src/components/TelemetryChart.tsx
web/src/components/PitWall.tsx
web/src/components/RaceControl.tsx
web/src/App.tsx
web/src/test/*.test.tsx     co-located test files referenced per task
```

> Per roadmap §3, plan-04-only files (`DateSelector.tsx`, `ReplayControls.tsx`, `BoostButton.tsx`, `Recap.tsx`, `replay/useReplay.ts`) are NOT created here. `cosmetics/Cosmetics.tsx` is created here as an empty stub because `Car.tsx` imports it.

**Test command form (roadmap §4):**
- One file: `npm test -w @racingshape/web -- run src/test/<file>.test.tsx`
- By name: append `-t "substring"`
- Whole workspace: `npm test -w @racingshape/web`

---

## Task 1: Scaffold the `web` workspace + smoke test

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/postcss.config.js`, `web/tailwind.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/test/setup.ts`
- Create (temporary minimal): `web/src/App.tsx`
- Modify: root `package.json` (add `dev` orchestration + ensure `web` in workspaces)
- Test: `web/src/test/smoke.test.tsx`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "@racingshape/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@racingshape/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.3",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `web/vite.config.ts`** (react plugin, `/api` proxy → `localhost:8787`, vitest jsdom + setup)

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

- [ ] **Step 4: Create `web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `web/tailwind.config.ts`** (token-aware: expose CSS vars as Tailwind colors so components can use `text-ink`, `bg-panel`, etc.)

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        cyan: 'var(--cyan)',
        amber: 'var(--amber)',
        green: 'var(--green)',
        grid: 'var(--grid)',
      },
      fontFamily: {
        head: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['"Chakra Petch"', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `web/index.html`** (Google Fonts link verbatim from mockup; `<html data-theme="dark">`)

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RacingShape</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Chakra+Petch:wght@500;700&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Create a temporary minimal `web/src/App.tsx`** (replaced fully in Task 14)

```tsx
export default function App() {
  return <div>RacingShape</div>;
}
```

- [ ] **Step 9: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Add root `dev` orchestration.** Open the root `package.json`. Ensure `"web"` is in `workspaces`. Add/merge these scripts (keep any existing api/test scripts from plans 01–02):

```json
{
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "dev:api": "npm run dev -w @racingshape/api",
    "dev:web": "npm run dev -w @racingshape/web",
    "build": "npm run build --workspaces --if-present",
    "test": "vitest run"
  }
}
```

> `npm run dev` runs each workspace's `dev` script in parallel (api listens on 8787, web on 5173 and proxies `/api` to it). If the repo already defines a different parallel runner, keep it — the requirement is only that `npm run dev` brings up api + web together.

- [ ] **Step 11: Write the failing smoke test — `web/src/test/smoke.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('renders the RacingShape wordmark', () => {
    render(<App />);
    expect(screen.getByText(/RacingShape/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Install deps and run the smoke test (expected FAIL until deps install)**

Run: `npm install`
Then: `npm test -w @racingshape/web -- run src/test/smoke.test.tsx`
Expected: PASS (the minimal App from Step 8 already renders "RacingShape"). If `npm install` has not yet linked the workspace it FAILs to resolve `@racingshape/web` — rerun after install. This step proves the toolchain is wired.

- [ ] **Step 13: Commit**

```bash
git add web/package.json web/tsconfig.json web/vite.config.ts web/postcss.config.js web/tailwind.config.ts web/index.html web/src/main.tsx web/src/App.tsx web/src/test/setup.ts web/src/test/smoke.test.tsx package.json package-lock.json
git commit -m "chore: scaffold web workspace with vite, tailwind, vitest"
```

---

## Task 2: Design tokens + base CSS (`index.css`)

**Files:**
- Create: `web/src/index.css`
- Test: `web/src/test/tokens.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/tokens.test.tsx`**

```tsx
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('../index.css', import.meta.url)),
  'utf8',
);

describe('index.css design tokens', () => {
  it('declares the canonical dark token values (roadmap §9)', () => {
    expect(css).toContain('--bg:#07090d');
    expect(css).toContain('--panel:#11151c');
    expect(css).toContain('--accent:#e10600');
    expect(css).toContain('--cyan:#15d6e0');
    expect(css).toContain('--amber:#ffb300');
    expect(css).toContain('--green:#34d399');
  });

  it('declares the canonical light token overrides', () => {
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('--bg:#eef1f5');
    expect(css).toContain('--panel:#ffffff');
    expect(css).toContain('--cyan:#0891b2');
  });

  it('includes Tailwind directives and the font-family vars', () => {
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
    expect(css).toContain('Rajdhani');
    expect(css).toContain('Chakra Petch');
    expect(css).toContain('Inter');
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — file does not exist)**

Run: `npm test -w @racingshape/web -- run src/test/tokens.test.tsx`
Expected: FAIL — `ENOENT` reading `index.css`.

- [ ] **Step 3: Create `web/src/index.css`** (tokens verbatim from mockup `:root` / `[data-theme="light"]`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #07090d;
  --bg2: #0d1016;
  --panel: #11151c;
  --panel2: #161b24;
  --ink: #eef2f7;
  --muted: #8a94a6;
  --line: #222a36;
  --accent: #e10600;
  --accent2: #ff3b30;
  --cyan: #15d6e0;
  --amber: #ffb300;
  --green: #34d399;
  --grid: #1a2029;

  --font-head: 'Rajdhani', system-ui, sans-serif;
  --font-mono: 'Chakra Petch', monospace;
  --font-body: 'Inter', system-ui, sans-serif;
}

[data-theme='light'] {
  --bg: #eef1f5;
  --bg2: #e3e8ef;
  --panel: #ffffff;
  --panel2: #f4f6fa;
  --ink: #0d1320;
  --muted: #5b6678;
  --line: #dde3ec;
  --accent: #e10600;
  --accent2: #c81e1e;
  --cyan: #0891b2;
  --amber: #d97706;
  --green: #059669;
  --grid: #eceff4;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  padding: 16px;
  transition: 0.35s;
}

.mono {
  font-family: var(--font-mono);
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/tokens.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/index.css web/src/test/tokens.test.tsx
git commit -m "feat: add canonical dark/light design tokens and base styles"
```

---

## Task 3: Typed API client (`types.ts` + `api.ts`)

**Files:**
- Create: `web/src/lib/types.ts`, `web/src/lib/api.ts`
- Test: `web/src/test/api.test.ts`

- [ ] **Step 1: Create `web/src/lib/types.ts`** (re-export the shared contract — single import surface for the web)

```ts
export type {
  EventType,
  ReactionKind,
  Cosmetic,
  Racer,
  ScoreBreakdown,
  ReactionSummary,
  RacerStanding,
  RaceToday,
  SnapshotFrame,
  ArchivedReaction,
  PodiumStep,
  Superlative,
  Recap,
  RaceArchive,
  RaceListItem,
  ChartDay,
  TasksStat,
  CompletionStat,
  StreakStat,
  StatsResponse,
  CreateReactionBody,
  CreateReactionResponse,
} from '@racingshape/shared';
```

- [ ] **Step 2: Write the failing test — `web/src/test/api.test.ts`**

```ts
import { afterEach, beforeEach, vi } from 'vitest';
import { getRaceToday, getStats, getRaces, getArchive } from '../lib/api';
import type { RaceToday, StatsResponse } from '../lib/types';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('getRaceToday hits /api/race/today and returns parsed JSON', async () => {
    const payload = { raceDate: '2026-06-02', live: true, topScore: 44, standings: [], lastPolledAt: null } as RaceToday;
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));
    const out = await getRaceToday();
    expect(fetchMock).toHaveBeenCalledWith('/api/race/today', expect.any(Object));
    expect(out).toEqual(payload);
  });

  it('getStats encodes the range query', async () => {
    const payload = { range: '14d', repoUrl: 'https://github.com/S2AI/s2shape', chart: [], totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 }, completion: { rate: 0, closed: 0, opened: 0 }, streak: { current: 0, startDate: null, bestThisMonth: 0 } } as StatsResponse;
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));
    const out = await getStats('14d');
    expect(fetchMock).toHaveBeenCalledWith('/api/stats?range=14d', expect.any(Object));
    expect(out.range).toBe('14d');
  });

  it('getRaces hits /api/races', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await getRaces();
    expect(fetchMock).toHaveBeenCalledWith('/api/races', expect.any(Object));
  });

  it('getArchive encodes the date in the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ raceDate: '2026-06-01' }));
    await getArchive('2026-06-01');
    expect(fetchMock).toHaveBeenCalledWith('/api/race/2026-06-01', expect.any(Object));
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, false, 500));
    await expect(getRaceToday()).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2b: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/api.test.ts`
Expected: FAIL — cannot resolve `../lib/api`.

- [ ] **Step 3: Create `web/src/lib/api.ts`**

```ts
import type {
  RaceToday,
  StatsResponse,
  RaceListItem,
  RaceArchive,
} from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function getRaceToday(): Promise<RaceToday> {
  return getJson<RaceToday>('/api/race/today');
}

export function getStats(range: string): Promise<StatsResponse> {
  return getJson<StatsResponse>(`/api/stats?range=${encodeURIComponent(range)}`);
}

export function getRaces(): Promise<RaceListItem[]> {
  return getJson<RaceListItem[]>('/api/races');
}

export function getArchive(date: string): Promise<RaceArchive> {
  return getJson<RaceArchive>(`/api/race/${encodeURIComponent(date)}`);
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/api.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/api.ts web/src/test/api.test.ts
git commit -m "feat: add typed API client and shared type re-exports"
```

---

## Task 4: Polling hook (`usePolling.ts`)

**Files:**
- Create: `web/src/lib/usePolling.ts`
- Test: `web/src/test/usePolling.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/usePolling.test.tsx`**

```tsx
import { afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePolling } from '../lib/usePolling';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePolling', () => {
  it('fetches once immediately and exposes data', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    expect(result.current.loading).toBe(false);
  });

  it('refetches on the interval', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('captures errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });

  it('clears the interval on unmount', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { unmount } = renderHook(() => usePolling(fn, 1000, []));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on the interval while the document is hidden', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('refetch() triggers an immediate fetch', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/usePolling.test.tsx`
Expected: FAIL — cannot resolve `../lib/usePolling`.

- [ ] **Step 3: Create `web/src/lib/usePolling.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Calls `fn` immediately, then every `intervalMs`. Pauses interval ticks while
 * the document is hidden. Clears the interval on unmount. `deps` re-arms it.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  deps: unknown[],
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void run();
    const id = setInterval(() => {
      if (!document.hidden) {
        void run();
      }
    }, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, error, loading, refetch: run };
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/usePolling.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/usePolling.ts web/src/test/usePolling.test.tsx
git commit -m "feat: add usePolling hook with hidden-tab pause and cleanup"
```

---

## Task 5: Theme hook (`useTheme.ts`)

**Files:**
- Create: `web/src/lib/useTheme.ts`
- Test: `web/src/test/useTheme.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/useTheme.test.tsx`**

```tsx
import { afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, THEME_STORAGE_KEY } from '../lib/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});

afterEach(() => {
  localStorage.clear();
});

describe('useTheme', () => {
  it('defaults to dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle flips to light and sets the html attribute', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the choice to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('reads a persisted choice on init', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/useTheme.test.tsx`
Expected: FAIL — cannot resolve `../lib/useTheme`.

- [ ] **Step 3: Create `web/src/lib/useTheme.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'racingshape-theme';

function readInitial(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/useTheme.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/useTheme.ts web/src/test/useTheme.test.tsx
git commit -m "feat: add useTheme hook with localStorage persistence"
```

---

## Task 6: Tooltip engine (`tooltip.tsx`)

The single tooltip engine, ported from the mockup's `#tip` element + `showTip/moveTip` logic into React. Convention: `data-tip="HEADER||body"`. A fixed floating card follows the cursor, flips near the right/bottom edges, has `pointer-events: none` so it never blocks clicks, and fades in 120ms.

**Files:**
- Create: `web/src/lib/tooltip.tsx`
- Test: `web/src/test/tooltip.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/tooltip.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider, tip } from '../lib/tooltip';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

describe('tooltip engine', () => {
  it('tip() builds the HEADER||body convention string', () => {
    expect(tip('Live race', 'Polling every 60s.')).toBe('Live race||Polling every 60s.');
  });

  it('shows header and body on hover over a [data-tip] element', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <button data-tip={tip('LEADER', 'devon-r leads')}>hover me</button>
      </TooltipProvider>,
    );
    fireEvent.mouseOver(screen.getByText('hover me'), { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('tooltip')).toHaveClass('show');
    expect(screen.getByTestId('tooltip-header')).toHaveTextContent('LEADER');
    expect(screen.getByTestId('tooltip-body')).toHaveTextContent('devon-r leads');
  });

  it('renders header-only when there is no body separator', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <span data-tip="Just a label">x</span>
      </TooltipProvider>,
    );
    fireEvent.mouseOver(screen.getByText('x'), { clientX: 50, clientY: 50 });
    expect(screen.getByTestId('tooltip-body')).toHaveTextContent('Just a label');
    expect(screen.getByTestId('tooltip-header')).not.toBeVisible();
  });

  it('hides on mouseout', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <span data-tip="Hi||there">x</span>
      </TooltipProvider>,
    );
    const target = screen.getByText('x');
    fireEvent.mouseOver(target, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId('tooltip')).toHaveClass('show');
    fireEvent.mouseOut(target, { relatedTarget: document.body });
    expect(screen.getByTestId('tooltip')).not.toHaveClass('show');
  });

  it('flips left/up near the right and bottom edges', () => {
    setViewport(300, 300);
    render(
      <TooltipProvider>
        <span data-tip="Edge||case">x</span>
      </TooltipProvider>,
    );
    const target = screen.getByText('x');
    fireEvent.mouseOver(target, { clientX: 295, clientY: 295 });
    const tipEl = screen.getByTestId('tooltip');
    // near the right/bottom edge the tooltip is positioned to the upper-left of the cursor
    expect(parseInt(tipEl.style.left, 10)).toBeLessThan(295);
    expect(parseInt(tipEl.style.top, 10)).toBeLessThan(295);
  });

  it('the tooltip card never blocks clicks (pointer-events: none)', () => {
    render(
      <TooltipProvider>
        <span data-tip="Hi||there">x</span>
      </TooltipProvider>,
    );
    expect(screen.getByTestId('tooltip')).toHaveStyle({ pointerEvents: 'none' });
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/tooltip.test.tsx`
Expected: FAIL — cannot resolve `../lib/tooltip`.

- [ ] **Step 3: Create `web/src/lib/tooltip.tsx`** (ports mockup `#tip` CSS into inline style + the show/move/hide listeners; jsdom returns 0 for `offsetWidth/Height` so edge math uses sane fallbacks)

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Build the `HEADER||body` convention string the engine parses. */
export function tip(header: string, body: string): string {
  return `${header}||${body}`;
}

interface TipState {
  show: boolean;
  header: string;
  body: string;
  left: number;
  top: number;
}

const PAD = 14;
const TipCtx = createContext<null>(null);

export function useTip() {
  return useContext(TipCtx);
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TipState>({
    show: false,
    header: '',
    body: '',
    left: 0,
    top: 0,
  });
  const tipRef = useRef<HTMLDivElement>(null);

  const place = useCallback((clientX: number, clientY: number) => {
    const el = tipRef.current;
    const w = el?.offsetWidth || 240;
    const h = el?.offsetHeight || 80;
    let x = clientX + PAD;
    let y = clientY + PAD;
    if (x + w > window.innerWidth - 8) x = clientX - w - PAD;
    if (y + h > window.innerHeight - 8) y = clientY - h - PAD;
    return { x, y };
  }, []);

  const showFor = useCallback(
    (raw: string, clientX: number, clientY: number) => {
      const [head, body] = raw.split('||');
      const { x, y } = place(clientX, clientY);
      setState({
        show: true,
        header: body ? head : '',
        body: body ?? head,
        left: x,
        top: y,
      });
    },
    [place],
  );

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest('[data-tip]');
      if (t) showFor(t.getAttribute('data-tip') ?? '', e.clientX, e.clientY);
    };
    const onMove = (e: MouseEvent) => {
      setState((s) => {
        if (!s.show) return s;
        const { x, y } = place(e.clientX, e.clientY);
        return { ...s, left: x, top: y };
      });
    };
    const onOut = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest('[data-tip]');
      const related = e.relatedTarget as Node | null;
      if (t && !(related && t.contains(related))) {
        setState((s) => ({ ...s, show: false }));
      }
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
    };
  }, [showFor, place]);

  return (
    <TipCtx.Provider value={null}>
      {children}
      <div
        ref={tipRef}
        data-testid="tooltip"
        className={`tip${state.show ? ' show' : ''}`}
        style={{
          position: 'fixed',
          zIndex: 9999,
          maxWidth: 260,
          background: 'var(--panel2)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderLeft: '3px solid var(--cyan)',
          borderRadius: 8,
          padding: '9px 11px',
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
          pointerEvents: 'none',
          opacity: state.show ? 1 : 0,
          transform: state.show ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .12s, transform .12s',
          boxShadow: '0 10px 30px rgba(0,0,0,.45)',
          left: state.left,
          top: state.top,
        }}
      >
        <span
          data-testid="tooltip-header"
          style={{
            display: state.header ? 'block' : 'none',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--cyan)',
            marginBottom: 3,
          }}
        >
          {state.header}
        </span>
        <span data-testid="tooltip-body">{state.body}</span>
      </div>
    </TipCtx.Provider>
  );
}
```

> The `tooltip-header` test asserts `not.toBeVisible()` for header-only mode — `display:none` satisfies jest-dom's visibility check.

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/tooltip.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/tooltip.tsx web/src/test/tooltip.test.tsx
git commit -m "feat: add single tooltip engine ported from the mockup"
```

---

## Task 7: Tooltip text helpers (`format.ts`)

Pure functions turning a `ScoreBreakdown` + score into tooltip bodies. These satisfy roadmap §11 ("no dead numbers"). Weights come from `@racingshape/shared` (`SCORE_WEIGHTS`) so they stay in one place. The breakdown body matches the mockup's `bkText` exactly (events × weight = points, one line per non-zero type).

**Files:**
- Create: `web/src/lib/format.ts`
- Test: `web/src/test/format.test.ts`

- [ ] **Step 1: Write the failing test — `web/src/test/format.test.ts`**

```ts
import {
  breakdownBody,
  standingTip,
  gapText,
  completionText,
  streakText,
  chartDayBody,
} from '../lib/format';
import type { RacerStanding, ScoreBreakdown } from '../lib/types';

const bk: ScoreBreakdown = { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 };

function standing(overrides: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'devon-r',
    displayName: 'devon-r',
    avatarUrl: '',
    score: 44,
    breakdown: bk,
    position: 1,
    gapToLeader: 0,
    isLeader: true,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
    ...overrides,
  };
}

describe('format helpers', () => {
  it('breakdownBody lists each non-zero type as events × weight = points', () => {
    expect(breakdownBody(bk)).toBe(
      '10 commits ×1 = 10\n2 PRs opened ×5 = 10\n3 PRs merged ×8 = 24',
    );
  });

  it('breakdownBody returns a no-activity line when all zero', () => {
    expect(breakdownBody({ commit: 0, pr_opened: 0, pr_merged: 0, issue_closed: 0 })).toBe(
      'No tracked activity yet today',
    );
  });

  it('gapText returns LDR for the leader and +n otherwise', () => {
    expect(gapText(standing({ isLeader: true, gapToLeader: 0 }))).toBe('LDR');
    expect(gapText(standing({ isLeader: false, gapToLeader: 13, position: 2 }))).toBe('+13');
  });

  it('standingTip combines header, breakdown, and gap line for a leader', () => {
    const out = standingTip(standing({ isLeader: true, score: 44 }));
    expect(out).toContain('devon-r — 44 pts||');
    expect(out).toContain('10 commits ×1 = 10');
    expect(out).toContain('Leading the race');
  });

  it('standingTip shows pts-behind for a non-leader', () => {
    const out = standingTip(standing({ isLeader: false, gapToLeader: 13, score: 31, position: 2 }));
    expect(out).toContain('13 pts behind leader');
  });

  it('completionText renders n / m closed or merged', () => {
    expect(completionText({ rate: 0.82, closed: 41, opened: 50 })).toBe(
      '41 / 50 opened items were closed or merged',
    );
  });

  it('streakText names the run start and best this month', () => {
    expect(streakText({ current: 12, startDate: '2026-05-22', bestThisMonth: 12 })).toBe(
      'Consecutive days with at least one tracked event. Current run started 2026-05-22; best this month is 12.',
    );
  });

  it('streakText handles a null start (no active run)', () => {
    expect(streakText({ current: 0, startDate: null, bestThisMonth: 4 })).toBe(
      'No active streak. Best this month is 4.',
    );
  });

  it('chartDayBody lists exact counts for a day', () => {
    expect(chartDayBody({ raceDate: '2026-06-02', commits: 8, prsOpened: 2, issuesClosed: 1 })).toBe(
      '8 commits\n2 PRs opened\n1 issue closed',
    );
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/format.test.ts`
Expected: FAIL — cannot resolve `../lib/format`.

- [ ] **Step 3: Create `web/src/lib/format.ts`**

```ts
import { SCORE_WEIGHTS } from '@racingshape/shared';
import type {
  RacerStanding,
  ScoreBreakdown,
  CompletionStat,
  StreakStat,
  ChartDay,
} from './types';
import { tip } from './tooltip';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Mirrors the mockup's bkText: one line per non-zero type, events × weight = points. */
export function breakdownBody(b: ScoreBreakdown): string {
  const lines: string[] = [];
  if (b.commit)
    lines.push(`${b.commit} ${plural(b.commit, 'commit', 'commits')} ×${SCORE_WEIGHTS.commit} = ${b.commit * SCORE_WEIGHTS.commit}`);
  if (b.pr_opened)
    lines.push(`${b.pr_opened} ${plural(b.pr_opened, 'PR opened', 'PRs opened')} ×${SCORE_WEIGHTS.pr_opened} = ${b.pr_opened * SCORE_WEIGHTS.pr_opened}`);
  if (b.pr_merged)
    lines.push(`${b.pr_merged} ${plural(b.pr_merged, 'PR merged', 'PRs merged')} ×${SCORE_WEIGHTS.pr_merged} = ${b.pr_merged * SCORE_WEIGHTS.pr_merged}`);
  if (b.issue_closed)
    lines.push(`${b.issue_closed} ${plural(b.issue_closed, 'issue closed', 'issues closed')} ×${SCORE_WEIGHTS.issue_closed} = ${b.issue_closed * SCORE_WEIGHTS.issue_closed}`);
  return lines.length ? lines.join('\n') : 'No tracked activity yet today';
}

export function gapText(s: RacerStanding): string {
  return s.isLeader ? 'LDR' : `+${s.gapToLeader}`;
}

/** Full row/pod tooltip: header `login — n pts`, breakdown lines, then a gap line. */
export function standingTip(s: RacerStanding): string {
  const tail = s.isLeader
    ? '\n\nLeading the race'
    : `\n\n${s.gapToLeader} pts behind leader`;
  return tip(`${s.login} — ${s.score} pts`, `${breakdownBody(s.breakdown)}${tail}`);
}

export function completionText(c: CompletionStat): string {
  return `${c.closed} / ${c.opened} opened items were closed or merged`;
}

export function streakText(s: StreakStat): string {
  if (s.current === 0 || !s.startDate) {
    return `No active streak. Best this month is ${s.bestThisMonth}.`;
  }
  return `Consecutive days with at least one tracked event. Current run started ${s.startDate}; best this month is ${s.bestThisMonth}.`;
}

export function chartDayBody(d: ChartDay): string {
  return [
    `${d.commits} ${plural(d.commits, 'commit', 'commits')}`,
    `${d.prsOpened} ${plural(d.prsOpened, 'PR opened', 'PRs opened')}`,
    `${d.issuesClosed} ${plural(d.issuesClosed, 'issue closed', 'issues closed')}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/format.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/format.ts web/src/test/format.test.ts
git commit -m "feat: add tooltip text formatters for no-dead-numbers coverage"
```

---

## Task 8: Header (`Header.tsx`)

Race-stripe header ported from the mockup. Logo + Rajdhani wordmark, pulsing LIVE chip (with tooltip), a **STUB** date selector showing "TODAY" (disabled, marked plan 04), a **STUB** disabled Replay button, and a theme toggle wired to `useTheme`. Every control has a tooltip (roadmap §11).

**Files:**
- Create: `web/src/components/Header.tsx`
- Test: `web/src/test/Header.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/Header.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { Header } from '../components/Header';
import { THEME_STORAGE_KEY } from '../lib/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => localStorage.clear());

describe('Header', () => {
  it('renders the wordmark and LIVE chip with a tooltip', () => {
    render(<Header />);
    expect(screen.getByText('RACINGSHAPE')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByTestId('live-chip')).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });

  it('renders a STUB date selector showing TODAY, disabled for plan 04', () => {
    render(<Header />);
    const sel = screen.getByTestId('date-selector') as HTMLSelectElement;
    expect(sel).toBeDisabled();
    expect(sel.value).toMatch(/TODAY/i);
    expect(sel).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });

  it('renders a disabled Replay button (plan 04 seam)', () => {
    render(<Header />);
    expect(screen.getByTestId('replay-btn')).toBeDisabled();
  });

  it('toggle button flips the theme and persists it', () => {
    render(<Header />);
    const btn = screen.getByTestId('theme-btn');
    expect(btn).toHaveTextContent(/DARK/i);
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(btn).toHaveTextContent(/LIGHT/i);
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/Header.test.tsx`
Expected: FAIL — cannot resolve `../components/Header`.

- [ ] **Step 3: Create `web/src/components/Header.tsx`** (markup + classes ported from the mockup `<header>`; tokens via Tailwind color names; tooltips on every control)

```tsx
import { tip } from '../lib/tooltip';
import { useTheme } from '../lib/useTheme';

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-line border-l-[5px] border-l-accent bg-gradient-to-r from-panel to-panel2 px-[18px] py-[14px]">
      <div className="flex items-center gap-[13px]">
        <div className="grid h-[46px] w-[46px] place-items-center rounded-[9px] bg-accent text-[24px] shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset]">
          🏁
        </div>
        <div>
          <h1 className="font-head text-[24px] font-bold leading-none tracking-[3px]">
            RACINGSHAPE
          </h1>
          <div className="mono mt-[3px] text-[10px] tracking-[2px] text-muted">
            SHIP CODE · RACE CARS · WIN THE DAY
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap items-center gap-[9px]">
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

        {/* PLAN 04: real date selector + archived days. Disabled stub for now. */}
        <select
          data-testid="date-selector"
          disabled
          defaultValue="JUN 02 · TODAY"
          data-tip={tip(
            'Race day',
            'Switch between today and archived days. (Coming soon — archived replay arrives in the next release.)',
          )}
          className="cursor-not-allowed appearance-none rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink opacity-60"
        >
          <option>JUN 02 · TODAY</option>
        </select>

        {/* PLAN 04: replay engine. Disabled stub for now. */}
        <button
          type="button"
          data-testid="replay-btn"
          disabled
          data-tip={tip('Replay', 'Play an archived day back as a ~15s fast-forward. (Coming soon.)')}
          className="flex cursor-not-allowed items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink opacity-60"
        >
          ▶ REPLAY
        </button>

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

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/Header.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Header.tsx web/src/test/Header.test.tsx
git commit -m "feat: add race-stripe header with theme toggle and plan-04 stubs"
```

---

## Task 9: Timing tower (`TimingTower.tsx`)

One row per `RacerStanding` sorted by `position`: position number, avatar tile (colored, initials), username, points, gap (`LDR`/`+n`). P1 gets the amber left-border + tint. Each row carries the full score-breakdown tooltip from `standingTip`. Ported from the mockup `.tower`/`.trow` markup.

**Files:**
- Create: `web/src/components/TimingTower.tsx`
- Test: `web/src/test/TimingTower.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/TimingTower.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import { TimingTower } from '../components/TimingTower';
import type { RacerStanding } from '../lib/types';

function s(over: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'x',
    displayName: 'x',
    avatarUrl: '',
    score: 0,
    breakdown: { commit: 0, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position: 1,
    gapToLeader: 0,
    isLeader: false,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
    ...over,
  };
}

const standings: RacerStanding[] = [
  s({ login: 'devon-r', score: 44, position: 1, isLeader: true, gapToLeader: 0, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } }),
  s({ login: 'mira-k', score: 31, position: 2, gapToLeader: 13 }),
  s({ login: 'sasha-p', score: 27, position: 3, gapToLeader: 17 }),
];

describe('TimingTower', () => {
  it('renders rows in position order', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(within(rows[0]).getByText('devon-r')).toBeInTheDocument();
    expect(within(rows[1]).getByText('mira-k')).toBeInTheDocument();
    expect(within(rows[2]).getByText('sasha-p')).toBeInTheDocument();
  });

  it('marks P1 with the leader class', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(rows[0].className).toMatch(/border-l-amber/);
    expect(rows[1].className).not.toMatch(/border-l-amber/);
  });

  it('shows LDR for P1 and +n for the rest', () => {
    render(<TimingTower standings={standings} />);
    expect(screen.getByText('LDR')).toBeInTheDocument();
    expect(screen.getByText('+13')).toBeInTheDocument();
    expect(screen.getByText('+17')).toBeInTheDocument();
  });

  it('every row carries the breakdown tooltip', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(rows[0]).toHaveAttribute('data-tip', expect.stringContaining('devon-r — 44 pts||'));
    expect(rows[0].getAttribute('data-tip')).toContain('10 commits ×1 = 10');
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/TimingTower.test.tsx`
Expected: FAIL — cannot resolve `../components/TimingTower`.

- [ ] **Step 3: Create `web/src/components/TimingTower.tsx`** (carries a stable per-login color for the avatar tile — shared with `Car`)

```tsx
import type { RacerStanding } from '../lib/types';
import { standingTip, gapText } from '../lib/format';

const PALETTE = ['#e10600', '#15d6e0', '#34d399', '#ffb300', '#9b5de5', '#ff7849'];

/** Deterministic per-login color so the tower tile and track pod match. */
export function colorFor(login: string): string {
  let h = 0;
  for (let i = 0; i < login.length; i++) h = (h * 31 + login.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsFor(login: string): string {
  const cleaned = login.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/);
  if (cleaned.length >= 2) return (cleaned[0][0] + cleaned[1][0]).toUpperCase();
  return login.slice(0, 2).toUpperCase();
}

export function TimingTower({ standings }: { standings: RacerStanding[] }) {
  const ordered = [...standings].sort((a, b) => a.position - b.position);
  return (
    <div className="border-r border-line p-[10px]">
      <div className="mono flex gap-[9px] px-[8px] pb-[6px] text-[9px] tracking-[1px] text-muted">
        <span className="w-[18px]">P</span>
        <span className="w-[26px]" />
        <span>DRIVER</span>
        <span className="ml-auto">PTS</span>
        <span className="w-[34px] text-right">GAP</span>
      </div>
      {ordered.map((r) => (
        <div
          key={r.login}
          data-testid="tower-row"
          data-tip={standingTip(r)}
          className={`mb-[3px] flex cursor-help items-center gap-[9px] rounded-[7px] border-l-[3px] px-[8px] py-[7px] transition-[.2s] hover:bg-panel2 ${
            r.isLeader
              ? 'border-l-amber bg-gradient-to-r from-[rgba(255,179,0,.1)] to-transparent'
              : 'border-l-transparent'
          }`}
        >
          <span className={`mono w-[18px] text-[14px] font-bold ${r.isLeader ? 'text-amber' : 'text-muted'}`}>
            {r.position}
          </span>
          <span
            className="mono grid h-[26px] w-[26px] place-items-center rounded-[6px] text-[11px] font-bold text-white"
            style={{ background: colorFor(r.login) }}
          >
            {initialsFor(r.login)}
          </span>
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">
            {r.login}
          </span>
          <span className="mono text-[14px] font-bold">{r.score}</span>
          <span className="mono w-[34px] text-right text-[10px] text-cyan">{gapText(r)}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/TimingTower.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TimingTower.tsx web/src/test/TimingTower.test.tsx
git commit -m "feat: add timing tower with leader styling and breakdown tooltips"
```

---

## Task 10: Car + Track + Cosmetics stub (`Car.tsx`, `Track.tsx`, `cosmetics/Cosmetics.tsx`)

`Track` renders one lane per racer with a start line and a checkered finish strip (finish-line tooltip: "auto-scaled…"). `Car` positions itself via the canonical auto-scale rule (roadmap §10): `pct = 2 + (score / max(topScore, 1)) * 80`, with a CSS `left` transition (~1s `cubic-bezier(.4,.8,.3,1)`) so polls tween. The pod shows initials; the avatar badge renders the GitHub image with an initials fallback; the leader gets an amber ring + glow; a DRS tag appears when `topMover`. `standing.cosmetics` renders through an imported empty `Cosmetics` stub (the plan-04 seam).

**Files:**
- Create: `web/src/components/cosmetics/Cosmetics.tsx`, `web/src/components/Car.tsx`, `web/src/components/Track.tsx`
- Test: `web/src/test/Car.test.tsx`, `web/src/test/Track.test.tsx`

- [ ] **Step 1: Create the empty cosmetics stub — `web/src/components/cosmetics/Cosmetics.tsx`** (plan 04 implements the sprite layer; this exists so `Car` can import it now)

```tsx
import type { Cosmetic } from '../../lib/types';

/**
 * PLAN 04 fills this in (flame_trail, gold_rims, rookie_decal sprite/CSS layer).
 * For plan 03 it is intentionally inert so the seam exists and Car can import it.
 */
export function Cosmetics({ cosmetics }: { cosmetics: Cosmetic[] }) {
  return <span data-testid="cosmetics-slot" data-count={cosmetics.length} hidden />;
}
```

- [ ] **Step 2: Write the failing test — `web/src/test/Car.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Car, carPct } from '../components/Car';
import type { RacerStanding } from '../lib/types';

function s(over: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'devon-r',
    displayName: 'devon-r',
    avatarUrl: 'https://example.com/a.png',
    score: 44,
    breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
    position: 1,
    gapToLeader: 0,
    isLeader: true,
    topMover: false,
    reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } },
    cosmetics: [],
    ...over,
  };
}

describe('carPct (roadmap §10 auto-scale)', () => {
  it('puts the leader near the front (~82%)', () => {
    expect(carPct(44, 44)).toBeCloseTo(82, 5);
  });
  it('idles a zero score at the 2% start line', () => {
    expect(carPct(0, 44)).toBeCloseTo(2, 5);
  });
  it('clamps topScore to 1 to avoid divide-by-zero', () => {
    expect(carPct(0, 0)).toBeCloseTo(2, 5);
  });
});

describe('Car', () => {
  it('positions the car by score and uses the tween transition', () => {
    render(<Car standing={s({ score: 22 })} topScore={44} />);
    const car = screen.getByTestId('car');
    expect(car.style.left).toBe('42%'); // 2 + (22/44)*80
    expect(car.style.transition).toContain('cubic-bezier(.4,.8,.3,1)');
  });

  it('gives the leader the amber ring class', () => {
    render(<Car standing={s({ isLeader: true })} topScore={44} />);
    expect(screen.getByTestId('car').className).toMatch(/lead/);
  });

  it('shows the DRS tag only when topMover', () => {
    const { rerender } = render(<Car standing={s({ topMover: true })} topScore={44} />);
    expect(screen.getByTestId('drs-tag')).toBeInTheDocument();
    rerender(<Car standing={s({ topMover: false })} topScore={44} />);
    expect(screen.queryByTestId('drs-tag')).not.toBeInTheDocument();
  });

  it('renders the avatar image and falls back to initials when it errors', () => {
    render(<Car standing={s({ login: 'mira-k', avatarUrl: 'https://x/y.png' })} topScore={44} />);
    const img = screen.getByTestId('car-avatar') as HTMLImageElement;
    expect(img).toHaveAttribute('src', 'https://x/y.png');
    fireEvent.error(img);
    expect(screen.getByTestId('car-avatar-fallback')).toHaveTextContent('MK');
  });

  it('renders the read-only reaction count and a cosmetics slot', () => {
    render(<Car standing={s({ reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } } })} topScore={44} />);
    expect(screen.getByTestId('reaction-count')).toHaveTextContent('7');
    expect(screen.getByTestId('cosmetics-slot')).toBeInTheDocument();
  });

  it('the pod and reaction count expose tooltips', () => {
    render(<Car standing={s({})} topScore={44} />);
    expect(screen.getByTestId('car-pod')).toHaveAttribute('data-tip', expect.stringContaining('||'));
    expect(screen.getByTestId('reaction-count')).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });
});
```

- [ ] **Step 3: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/Car.test.tsx`
Expected: FAIL — cannot resolve `../components/Car`.

- [ ] **Step 4: Create `web/src/components/Car.tsx`** (markup/classes ported from the mockup `.car`/`.pod`/`.cav`/`.clabel`/`.drs`/`.rc`; avatar `<img>` with initials fallback per DESIGN §10; reaction count read-only)

```tsx
import { useState } from 'react';
import type { RacerStanding } from '../lib/types';
import { standingTip } from '../lib/format';
import { tip } from '../lib/tooltip';
import { colorFor, initialsFor } from './TimingTower';
import { Cosmetics } from './cosmetics/Cosmetics';

/** Canonical auto-scale (roadmap §10): leader ~82%, empty idles at 2%, no /0. */
export function carPct(score: number, topScore: number): number {
  return 2 + (score / Math.max(topScore, 1)) * 80;
}

function reactionTip(s: RacerStanding): string {
  const k = s.reactions.byKind;
  return tip(
    'Pit-stop boosts',
    `${s.reactions.total} cosmetic reactions from teammates · 🔥${k['🔥']} ⚡${k['⚡']} 🏎️${k['🏎️']}. Never affects score.`,
  );
}

export function Car({ standing, topScore }: { standing: RacerStanding; topScore: number }) {
  const [avatarBroken, setAvatarBroken] = useState(false);
  const color = colorFor(standing.login);
  const initials = initialsFor(standing.login);
  const left = `${carPct(standing.score, topScore)}%`;
  const podTip = standingTip(standing);

  return (
    <div
      data-testid="car"
      className={`car absolute z-[2] flex items-center gap-[8px]${standing.isLeader ? ' lead' : ''}`}
      style={{ left, transition: 'left 1s cubic-bezier(.4,.8,.3,1)' }}
    >
      {standing.topMover && (
        <span
          data-testid="drs-tag"
          data-tip={tip('DRS — top mover', 'Gained the most points on the latest 60s poll.')}
          className="mono absolute left-0 top-[-8px] cursor-help text-[8px] tracking-[1px] text-amber"
        >
          ▮ DRS
        </span>
      )}

      <Cosmetics cosmetics={standing.cosmetics} />

      <div
        data-testid="car-pod"
        data-tip={podTip}
        className="relative flex h-[22px] w-[50px] cursor-help items-center rounded-[4px_11px_11px_4px] pl-[5px] shadow-[0_2px_6px_rgba(0,0,0,.4)]"
        style={{ background: color }}
      >
        <span className="mono text-[11px] font-bold text-white">{initials}</span>
      </div>

      <div className="flex items-center gap-[7px]">
        {!avatarBroken ? (
          <img
            data-testid="car-avatar"
            src={standing.avatarUrl}
            alt={standing.login}
            onError={() => setAvatarBroken(true)}
            className={`h-[24px] w-[24px] rounded-full border-2 object-cover ${standing.isLeader ? 'border-amber shadow-[0_0_10px_var(--amber)]' : 'border-cyan'}`}
            style={{ borderColor: standing.isLeader ? 'var(--amber)' : color }}
          />
        ) : (
          <span
            data-testid="car-avatar-fallback"
            className={`grid h-[24px] w-[24px] place-items-center rounded-full border-2 text-[10px] font-bold text-white ${standing.isLeader ? 'shadow-[0_0_10px_var(--amber)]' : ''}`}
            style={{ borderColor: standing.isLeader ? 'var(--amber)' : color }}
          >
            {initials}
          </span>
        )}

        <span
          data-tip={podTip}
          className="clabel mono flex cursor-help items-center gap-[5px] whitespace-nowrap rounded-[5px] border border-line bg-panel2 px-[7px] py-[1px] font-head text-[12px] font-semibold tracking-[.5px]"
        >
          {standing.login}
          <span
            data-testid="reaction-count"
            data-tip={reactionTip(standing)}
            className="mono cursor-help text-[10px] font-bold text-accent2"
          >
            {standing.reactions.total}🔥
          </span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/Car.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 6: Write the failing test — `web/src/test/Track.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import { Track } from '../components/Track';
import type { RacerStanding } from '../lib/types';

function s(login: string, score: number, position: number): RacerStanding {
  return {
    login,
    displayName: login,
    avatarUrl: '',
    score,
    breakdown: { commit: score, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position,
    gapToLeader: 0,
    isLeader: position === 1,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
  };
}

describe('Track', () => {
  it('renders one lane per racer', () => {
    render(<Track standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    expect(screen.getAllByTestId('lane')).toHaveLength(2);
  });

  it('renders a checkered finish line with an auto-scale tooltip', () => {
    render(<Track standings={[s('a', 10, 1)]} topScore={10} />);
    const finish = screen.getByTestId('finish-line');
    expect(finish).toHaveAttribute('data-tip', expect.stringContaining('Auto-scaled'));
  });

  it('places each racer car inside its lane', () => {
    render(<Track standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    const lanes = screen.getAllByTestId('lane');
    expect(within(lanes[0]).getByTestId('car')).toBeInTheDocument();
    expect(within(lanes[1]).getByTestId('car')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/Track.test.tsx`
Expected: FAIL — cannot resolve `../components/Track`.

- [ ] **Step 8: Create `web/src/components/Track.tsx`** (ported from the mockup `.trackwrap`/`.lane`/`.startline`/`.finishline`)

```tsx
import type { RacerStanding } from '../lib/types';
import { Car } from './Car';
import { tip } from '../lib/tooltip';

export function Track({
  standings,
  topScore,
}: {
  standings: RacerStanding[];
  topScore: number;
}) {
  const ordered = [...standings].sort((a, b) => a.position - b.position);
  return (
    <div className="relative px-[14px] pb-[6px] pt-[14px]">
      <div
        data-testid="finish-line"
        data-tip={tip(
          'Finish line',
          "Auto-scaled to the day's top score, so the leader sits near the front and the whole pack stays on screen.",
        )}
        className="absolute bottom-0 right-[18px] top-0 z-[3] w-[14px] cursor-help opacity-[.35]"
        style={{
          background:
            'repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0/7px 7px',
        }}
      />
      {ordered.map((r) => (
        <div
          key={r.login}
          data-testid="lane"
          className="relative my-[6px] flex h-[46px] items-center rounded-[6px] border-b border-line"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 56px)',
          }}
        >
          <div className="absolute bottom-[6px] left-[8px] top-[6px] w-[3px] bg-muted opacity-40" />
          <Car standing={r} topScore={topScore} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/Track.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add web/src/components/cosmetics/Cosmetics.tsx web/src/components/Car.tsx web/src/components/Track.tsx web/src/test/Car.test.tsx web/src/test/Track.test.tsx
git commit -m "feat: add auto-scaling track and tweening cars with cosmetics seam"
```

---

## Task 11: Telemetry chart (`TelemetryChart.tsx`)

Stacked CSS bars over `StatsResponse.chart`: commits (cyan), PRs opened (red/accent), issues closed (amber), on dashed gridlines. Per-bar hover tooltip with exact counts + date (via `chartDayBody`). A legend and an `↗ GITHUB` badge; series links built from `repoUrl` deep-link to the matching `S2AI/s2shape` views. Ported from the mockup `.chart`/`.col`/`.stk`/`.legend`.

**Files:**
- Create: `web/src/components/TelemetryChart.tsx`
- Test: `web/src/test/TelemetryChart.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/TelemetryChart.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import { TelemetryChart } from '../components/TelemetryChart';
import type { StatsResponse } from '../lib/types';

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [
    { raceDate: '2026-06-01', commits: 5, prsOpened: 1, issuesClosed: 0 },
    { raceDate: '2026-06-02', commits: 10, prsOpened: 2, issuesClosed: 2 },
  ],
  totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 },
  completion: { rate: 0, closed: 0, opened: 0 },
  streak: { current: 0, startDate: null, bestThisMonth: 0 },
};

describe('TelemetryChart', () => {
  it('renders one column per chart day', () => {
    render(<TelemetryChart stats={stats} />);
    expect(screen.getAllByTestId('chart-col')).toHaveLength(2);
  });

  it('scales the tallest day to 100% height', () => {
    render(<TelemetryChart stats={stats} />);
    const stacks = screen.getAllByTestId('chart-stack');
    // day1 total = 6, day2 total = 14 (max) => heights 6/14*100 and 100
    expect(stacks[1].style.height).toBe('100%');
    expect(parseFloat(stacks[0].style.height)).toBeCloseTo((6 / 14) * 100, 1);
  });

  it('segments are proportional to the counts', () => {
    render(<TelemetryChart stats={stats} />);
    const stack = screen.getAllByTestId('chart-stack')[1];
    expect(within(stack).getByTestId('seg-commits').style.flexGrow).toBe('10');
    expect(within(stack).getByTestId('seg-prs').style.flexGrow).toBe('2');
    expect(within(stack).getByTestId('seg-issues').style.flexGrow).toBe('2');
  });

  it('each bar exposes a tooltip with exact counts and date', () => {
    render(<TelemetryChart stats={stats} />);
    const stack = screen.getAllByTestId('chart-stack')[1];
    expect(stack.getAttribute('data-tip')).toContain('2026-06-02||');
    expect(stack.getAttribute('data-tip')).toContain('10 commits');
    expect(stack.getAttribute('data-tip')).toContain('2 PRs opened');
    expect(stack.getAttribute('data-tip')).toContain('2 issues closed');
  });

  it('the GITHUB badge and series links target the repo', () => {
    render(<TelemetryChart stats={stats} />);
    expect(screen.getByTestId('github-badge')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape');
    expect(screen.getByTestId('link-commits')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/commits');
    expect(screen.getByTestId('link-prs')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/pulls');
    expect(screen.getByTestId('link-issues')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/issues?q=is%3Aissue+is%3Aclosed');
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/TelemetryChart.test.tsx`
Expected: FAIL — cannot resolve `../components/TelemetryChart`.

- [ ] **Step 3: Create `web/src/components/TelemetryChart.tsx`**

```tsx
import type { StatsResponse } from '../lib/types';
import { chartDayBody } from '../lib/format';
import { tip } from '../lib/tooltip';

function dayLabel(raceDate: string): string {
  // 'YYYY-MM-DD' -> single-letter weekday, matching the mockup's compact labels
  const d = new Date(`${raceDate}T12:00:00`);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}

export function TelemetryChart({ stats }: { stats: StatsResponse }) {
  const { chart, repoUrl } = stats;
  const totals = chart.map((d) => d.commits + d.prsOpened + d.issuesClosed);
  const max = Math.max(1, ...totals);

  const commitsUrl = `${repoUrl}/commits`;
  const prsUrl = `${repoUrl}/pulls`;
  const issuesUrl = `${repoUrl}/issues?q=is%3Aissue+is%3Aclosed`;

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">📈</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">
          TELEMETRY — 14 DAY ACTIVITY
        </h2>
        <a
          data-testid="github-badge"
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          data-tip={tip('Source', 'Every series links to the matching view on S2AI/s2shape — click through to commits, PRs, or issues.')}
          className="mono ml-auto rounded-[5px] border border-cyan px-[8px] py-[3px] text-[10px] tracking-[1px] text-cyan"
        >
          ↗ GITHUB
        </a>
      </div>

      <div className="p-[16px]">
        <div className="relative flex h-[170px] items-end gap-[5px] px-[4px] pt-[10px]">
          {[0.25, 0.5, 0.75].map((g) => (
            <div
              key={g}
              className="absolute left-0 right-0 border-t border-dashed border-line"
              style={{ bottom: `${g * 100}%` }}
            />
          ))}
          {chart.map((d, i) => {
            const total = totals[i];
            const h = (total / max) * 100;
            return (
              <div
                key={d.raceDate}
                data-testid="chart-col"
                className="z-[1] flex h-full flex-1 flex-col items-center justify-end gap-[4px]"
              >
                <div
                  data-testid="chart-stack"
                  data-tip={tip(d.raceDate, chartDayBody(d))}
                  className="flex w-[70%] cursor-help flex-col-reverse overflow-hidden rounded-[3px_3px_0_0] transition-[height_.7s_cubic-bezier(.4,.8,.3,1)] hover:brightness-[1.2]"
                  style={{ height: `${h}%` }}
                >
                  <div data-testid="seg-commits" className="bg-cyan" style={{ flexGrow: d.commits }} />
                  <div data-testid="seg-prs" className="bg-accent" style={{ flexGrow: d.prsOpened }} />
                  <div data-testid="seg-issues" className="bg-amber" style={{ flexGrow: d.issuesClosed }} />
                </div>
                <div className="mono text-[9px] text-muted">{dayLabel(d.raceDate)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-[16px] border-t border-line px-[16px] py-[10px] font-head text-[11px] font-semibold tracking-[.5px] text-muted">
        <a data-testid="link-commits" href={commitsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-cyan" />
          Commits
        </a>
        <a data-testid="link-prs" href={prsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-accent" />
          PRs opened
        </a>
        <a data-testid="link-issues" href={issuesUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-amber" />
          Issues closed
        </a>
        <span className="ml-auto">Hover a bar for the day · click → s2shape</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/TelemetryChart.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TelemetryChart.tsx web/src/test/TelemetryChart.test.tsx
git commit -m "feat: add telemetry chart with stacked bars and github deep-links"
```

---

## Task 12: Pit wall (`PitWall.tsx`)

Three stat blocks from `StatsResponse`: total tasks touched (issues + PRs composition tooltip), completion rate (gauge bar + `n/m` tooltip), team streak (run start + best-this-month tooltip). Aggregate/team framing only — never individual judgment (roadmap §4). Ported from the mockup `.stat`/`.gauge`.

**Files:**
- Create: `web/src/components/PitWall.tsx`
- Test: `web/src/test/PitWall.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/PitWall.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { PitWall } from '../components/PitWall';
import type { StatsResponse } from '../lib/types';

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [],
  totalTasks: { total: 37, issues: 23, prs: 14, deltaVsPriorWeek: 9 },
  completion: { rate: 0.82, closed: 41, opened: 50 },
  streak: { current: 12, startDate: '2026-05-22', bestThisMonth: 12 },
};

describe('PitWall', () => {
  it('renders the three team stat values', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('stat-tasks')).toHaveTextContent('37');
    expect(screen.getByTestId('stat-completion')).toHaveTextContent('82%');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('12');
  });

  it('tasks value tooltip shows the issues + PRs composition', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-tasks').getAttribute('data-tip') ?? '';
    expect(tip).toContain('23 issues');
    expect(tip).toContain('14 pull requests');
  });

  it('completion gauge tooltip shows n / m', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('completion-gauge').getAttribute('data-tip')).toContain('41 / 50');
    expect(screen.getByTestId('completion-fill').style.width).toBe('82%');
  });

  it('streak tooltip names the run start and best this month', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-streak').getAttribute('data-tip') ?? '';
    expect(tip).toContain('2026-05-22');
    expect(tip).toContain('best this month is 12');
  });

  it('shows the signed delta-vs-prior-week sub-line', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByText(/\+9 vs prior week/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/PitWall.test.tsx`
Expected: FAIL — cannot resolve `../components/PitWall`.

- [ ] **Step 3: Create `web/src/components/PitWall.tsx`**

```tsx
import type { StatsResponse } from '../lib/types';
import { completionText, streakText } from '../lib/format';
import { tip } from '../lib/tooltip';

export function PitWall({ stats }: { stats: StatsResponse }) {
  const { totalTasks, completion, streak } = stats;
  const delta = totalTasks.deltaVsPriorWeek;
  const deltaSign = delta >= 0 ? `▲ +${delta}` : `▼ ${delta}`;
  const pct = Math.round(completion.rate * 100);

  return (
    <aside className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">📊</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">PIT WALL</h2>
      </div>

      <div className="border-b border-line px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          🗂️ Total tasks touched
        </div>
        <div
          data-testid="stat-tasks"
          data-tip={tip(
            'Tasks touched · 14d',
            `${totalTasks.issues} issues + ${totalTasks.prs} pull requests the team opened, updated, or closed in the window.`,
          )}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none"
        >
          {totalTasks.total}
        </div>
        <div className="mt-[5px] text-[11px] font-semibold text-green">{deltaSign} vs prior week</div>
      </div>

      <div className="border-b border-line px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          ✅ Completion rate
        </div>
        <div
          data-testid="stat-completion"
          data-tip={tip('Completion rate', completionText(completion))}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none"
        >
          {pct}%
        </div>
        <div
          data-testid="completion-gauge"
          data-tip={`${completion.closed} / ${completion.opened} closed or merged`}
          className="mt-[9px] h-[7px] cursor-help overflow-hidden rounded-[4px] bg-panel2"
        >
          <div
            data-testid="completion-fill"
            className="h-full rounded-[4px] bg-gradient-to-r from-cyan to-green"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-[5px] text-[11px] text-muted">closed / opened · 14d window</div>
      </div>

      <div className="px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          🔥 Team streak
        </div>
        <div
          data-testid="stat-streak"
          data-tip={tip('Team streak', streakText(streak))}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none text-amber"
        >
          {streak.current} <span className="text-[14px] text-muted">DAYS</span>
        </div>
        <div className="mt-[5px] text-[11px] text-muted">
          {streak.startDate ? `active every day since ${streak.startDate}` : 'start a run today'}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/PitWall.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PitWall.tsx web/src/test/PitWall.test.tsx
git commit -m "feat: add pit wall team stats with derivation tooltips"
```

---

## Task 13: Race Control frame (`RaceControl.tsx`)

The frame coupling the timing tower (left, 230px) and the track (right), with a panel header carrying a `LAP: LIVE` badge (race-window tooltip). Ported from the mockup `.race` grid + `.panel`/`.ph`. Empty/quiet-day state: all cars idle at the start line with inviting copy (DESIGN §8). Single-contributor state still renders + animates.

**Files:**
- Create: `web/src/components/RaceControl.tsx`
- Test: `web/src/test/RaceControl.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/RaceControl.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import { RaceControl } from '../components/RaceControl';
import type { RacerStanding } from '../lib/types';

function s(login: string, score: number, position: number): RacerStanding {
  return {
    login,
    displayName: login,
    avatarUrl: '',
    score,
    breakdown: { commit: score, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position,
    gapToLeader: 0,
    isLeader: position === 1,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
  };
}

describe('RaceControl', () => {
  it('renders the LAP: LIVE badge with a race-window tooltip', () => {
    render(<RaceControl standings={[s('a', 10, 1)]} topScore={10} />);
    const badge = screen.getByTestId('lap-badge');
    expect(badge).toHaveTextContent(/LAP: LIVE/);
    expect(badge.getAttribute('data-tip')).toContain('America/New_York');
  });

  it('renders the timing tower and the track together', () => {
    render(<RaceControl standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    expect(screen.getAllByTestId('tower-row')).toHaveLength(2);
    expect(screen.getAllByTestId('lane')).toHaveLength(2);
  });

  it('empty day shows inviting copy and no rows', () => {
    render(<RaceControl standings={[]} topScore={1} />);
    expect(screen.queryAllByTestId('tower-row')).toHaveLength(0);
    expect(screen.getByTestId('empty-state')).toHaveTextContent(/first commit/i);
  });

  it('single contributor still renders a car at the start', () => {
    render(<RaceControl standings={[s('solo', 0, 1)]} topScore={1} />);
    const lane = screen.getByTestId('lane');
    expect(within(lane).getByTestId('car')).toBeInTheDocument();
    expect(within(lane).getByTestId('car').style.left).toBe('2%');
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — module not found)**

Run: `npm test -w @racingshape/web -- run src/test/RaceControl.test.tsx`
Expected: FAIL — cannot resolve `../components/RaceControl`.

- [ ] **Step 3: Create `web/src/components/RaceControl.tsx`**

```tsx
import type { RacerStanding } from '../lib/types';
import { TimingTower } from './TimingTower';
import { Track } from './Track';
import { tip } from '../lib/tooltip';

export function RaceControl({
  standings,
  topScore,
}: {
  standings: RacerStanding[];
  topScore: number;
}) {
  const empty = standings.length === 0;

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">🏎️</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">RACE CONTROL — TODAY</h2>
        <span
          data-testid="lap-badge"
          data-tip={tip(
            'Race window',
            '00:00:00 → 23:59:59 America/New_York. Resets at midnight; prior day is archived.',
          )}
          className="mono ml-auto cursor-help rounded-[5px] border border-accent px-[8px] py-[3px] text-[10px] tracking-[1px] text-accent"
        >
          LAP: LIVE
        </span>
      </div>

      {empty ? (
        <div
          data-testid="empty-state"
          className="px-[20px] py-[40px] text-center font-head text-[15px] tracking-[1px] text-muted"
        >
          The grid is set — no laps yet today.
          <br />
          The first commit of the day takes pole. 🏁
        </div>
      ) : (
        <div className="grid grid-cols-[230px_1fr] max-[640px]:grid-cols-1">
          <TimingTower standings={standings} />
          <Track standings={standings} topScore={topScore} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/RaceControl.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/RaceControl.tsx web/src/test/RaceControl.test.tsx
git commit -m "feat: add race control frame with empty and single-racer states"
```

---

## Task 14: App composition + integration test (`App.tsx`)

Compose Header + RaceControl + TelemetryChart + PitWall, wrapped in `TooltipProvider`. Poll `/api/race/today` every 60s via `usePolling`; fetch `/api/stats?range=14d`. Loading + error states. Leave a clearly-marked recap mount-point stub for plan 04. The integration test mocks the api module and asserts the leader, tower order, and a chart bar render, and that the dark-mode toggle persists.

**Files:**
- Modify (full replace): `web/src/App.tsx`
- Test: `web/src/test/App.test.tsx`

- [ ] **Step 1: Write the failing test — `web/src/test/App.test.tsx`**

```tsx
import { afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { RaceToday, StatsResponse } from '../lib/types';

const raceToday: RaceToday = {
  raceDate: '2026-06-02',
  live: true,
  topScore: 44,
  lastPolledAt: '2026-06-02T15:00:00.000Z',
  standings: [
    {
      login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://x/d.png',
      score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
      position: 1, gapToLeader: 0, isLeader: true, topMover: true,
      reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }, cosmetics: [],
    },
    {
      login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://x/m.png',
      score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 },
      position: 2, gapToLeader: 13, isLeader: false, topMover: false,
      reactions: { total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } }, cosmetics: [],
    },
  ],
};

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [{ raceDate: '2026-06-02', commits: 10, prsOpened: 2, issuesClosed: 2 }],
  totalTasks: { total: 37, issues: 23, prs: 14, deltaVsPriorWeek: 9 },
  completion: { rate: 0.82, closed: 41, opened: 50 },
  streak: { current: 12, startDate: '2026-05-22', bestThisMonth: 12 },
};

vi.mock('../lib/api', () => ({
  getRaceToday: vi.fn().mockResolvedValue(raceToday),
  getStats: vi.fn().mockResolvedValue(stats),
  getRaces: vi.fn().mockResolvedValue([]),
  getArchive: vi.fn(),
}));

import App from '../App';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('App integration', () => {
  it('renders the leader, tower order, and a chart bar from the api', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('tower-row').length).toBe(2));
    const rows = screen.getAllByTestId('tower-row');
    expect(within(rows[0]).getByText('devon-r')).toBeInTheDocument();
    expect(within(rows[1]).getByText('mira-k')).toBeInTheDocument();
    expect(screen.getByText('LDR')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-stack').length).toBe(1);
    expect(screen.getByTestId('stat-tasks')).toHaveTextContent('37');
  });

  it('persists the dark-mode toggle', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('theme-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('theme-btn'));
    expect(localStorage.getItem('racingshape-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('shows an error state when the race fetch fails', async () => {
    const api = await import('../lib/api');
    (api.getRaceToday as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('race-error')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test (expected FAIL — App is still the minimal scaffold)**

Run: `npm test -w @racingshape/web -- run src/test/App.test.tsx`
Expected: FAIL — no `tower-row` / `theme-btn` rendered.

- [ ] **Step 3: Replace `web/src/App.tsx` with the full composition**

```tsx
import { useCallback } from 'react';
import { TooltipProvider } from './lib/tooltip';
import { usePolling } from './lib/usePolling';
import { getRaceToday, getStats } from './lib/api';
import type { RaceToday, StatsResponse } from './lib/types';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { TelemetryChart } from './components/TelemetryChart';
import { PitWall } from './components/PitWall';

const POLL_MS = 60_000;

export default function App() {
  const fetchRace = useCallback(() => getRaceToday(), []);
  const fetchStats = useCallback(() => getStats('14d'), []);

  const race = usePolling<RaceToday>(fetchRace, POLL_MS, []);
  const stats = usePolling<StatsResponse>(fetchStats, POLL_MS, []);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1320px]">
        <Header />

        <div className="mt-[16px] grid grid-cols-[1fr_310px] gap-[16px] max-[940px]:grid-cols-1">
          <div>
            {race.error ? (
              <div
                data-testid="race-error"
                className="rounded-[10px] border border-line bg-panel px-[20px] py-[40px] text-center font-head tracking-[1px] text-accent2"
              >
                Lost the telemetry feed. Retrying on the next poll…
              </div>
            ) : race.data ? (
              <RaceControl standings={race.data.standings} topScore={race.data.topScore} />
            ) : (
              <div
                data-testid="race-loading"
                className="rounded-[10px] border border-line bg-panel px-[20px] py-[40px] text-center font-head tracking-[1px] text-muted"
              >
                Warming up the grid…
              </div>
            )}

            <div className="mt-[16px]">
              {stats.data && <TelemetryChart stats={stats.data} />}
            </div>
          </div>

          {stats.data && <PitWall stats={stats.data} />}
        </div>

        {/* PLAN 04: <Recap /> mounts here for completed/archived days. */}
        {/* <Recap raceDate={...} /> */}
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Run the integration test (expected PASS)**

Run: `npm test -w @racingshape/web -- run src/test/App.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole web suite (expected all green)**

Run: `npm test -w @racingshape/web`
Expected: PASS — all test files from Tasks 1–14 green.

- [ ] **Step 6: Verify the production build compiles**

Run: `npm run build -w @racingshape/web`
Expected: `tsc -b` reports no type errors and Vite writes `web/dist/`.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx web/src/test/App.test.tsx
git commit -m "feat: compose live dashboard with polling, stats, and error states"
```

---

## Done when

- [ ] `npm run dev` brings up api (8787) + web (5173), and the web app renders today's contributors as cars positioned by weighted score, tweening on each 60s poll (`/api` proxied to the API from plan 02).
- [ ] Timing tower lists racers in position order with P1 amber-highlighted; `LDR`/`+n` gaps correct.
- [ ] Track auto-scales via `pct = 2 + (score/max(topScore,1))*80` (roadmap §10) — leader near the front, empty day idling at the start line.
- [ ] Telemetry chart shows stacked commits/PRs/issues bars with working `S2AI/s2shape` deep-links.
- [ ] Pit wall shows total tasks, completion rate (gauge), and team streak, framed as team aggregates.
- [ ] Dark/light toggle flips `<html data-theme>` and persists to `localStorage` key `racingshape-theme`.
- [ ] Every displayed metric exposes a tooltip via the single engine (roadmap §11): tower row, car pod/label, reaction count, DRS tag, chart bar, pit-wall tasks/completion/streak, finish line, and all header controls (LIVE/date/replay/theme).
- [ ] Plan-04 seams are present and inert: disabled date selector ("TODAY"), disabled Replay button, empty `Cosmetics` slot in `Car`, and a commented recap mount-point in `App`.
- [ ] `npm test -w @racingshape/web` is all green and `npm run build -w @racingshape/web` succeeds.

**Handoff to plan 04:** the live dashboard, tooltip engine, car/track, and the four stub seams (date selector, Replay button, `Cosmetics` slot, recap mount-point) are in place — plan 04 fills them with pit-stop boosts, the Grand Prix recap card + PNG export, earned cosmetics, and the date-selector/replay engine.
