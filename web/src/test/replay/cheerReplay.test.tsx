/**
 * Replay cheer bubble tests — verifies that during archived-day replay:
 *   - source:'cheer' reactions surface as CheerFx bubbles on the target car
 *   - source:'boost' reactions do NOT produce cheer bubbles
 *   - bubbles auto-clear after ~1600ms
 *   - the hook resets when disabled (day switch / back to live)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplayCheerFx } from '../../replay/useReplayCheerFx';
import type { SnapshotFrame, ArchivedReaction } from '../../lib/types';

// Day span: 00:00 → 23:55 ET
const DAY_START = '2026-06-01T04:00:00.000Z';
const DAY_END   = '2026-06-02T03:55:00.000Z';
const DAY_SPAN_MS = new Date(DAY_END).getTime() - new Date(DAY_START).getTime();

const FRAMES: SnapshotFrame[] = [
  { capturedAt: DAY_START, scores: [{ login: 'devon-r', score: 0 }] },
  { capturedAt: DAY_END,   scores: [{ login: 'devon-r', score: 44 }] },
];

// Reactions: cheer at t=0.5, boost at t=0.25
const cheerAt = new Date(new Date(DAY_START).getTime() + DAY_SPAN_MS * 0.5).toISOString();
const boostAt = new Date(new Date(DAY_START).getTime() + DAY_SPAN_MS * 0.25).toISOString();

const REACTIONS: ArchivedReaction[] = [
  { targetLogin: 'devon-r', kind: '⚡', reactor: 'maya',   createdAt: cheerAt, source: 'cheer' },
  { targetLogin: 'devon-r', kind: '🔥', reactor: 'mira-k', createdAt: boostAt, source: 'boost' },
];

describe('useReplayCheerFx', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires a CheerFx when replay.t crosses a source:cheer reaction', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: number }) => useReplayCheerFx(t, FRAMES, REACTIONS, true),
      { initialProps: { t: 0 } },
    );

    expect(result.current).toHaveLength(0);

    // Advance t past the 25% mark (boost only — no cheer yet)
    rerender({ t: 0.3 });
    expect(result.current).toHaveLength(0);

    // Advance t past the 50% mark (cheer reaction)
    rerender({ t: 0.6 });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.targetLogin).toBe('devon-r');
    expect(result.current[0]!.label).toBe('maya');
  });

  it('does NOT produce a CheerFx for source:boost reactions', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: number }) => useReplayCheerFx(t, FRAMES, REACTIONS, true),
      { initialProps: { t: 0 } },
    );

    // Advance past boost at t=0.25 but not past cheer at t=0.5
    rerender({ t: 0.35 });
    // No bubbles — boost does not create a cheer bubble
    expect(result.current).toHaveLength(0);
    // Specifically: no 'mira-k' label
    expect(result.current.some((f) => f.label === 'mira-k')).toBe(false);
  });

  it('auto-clears cheer bubbles after ~1600ms', () => {
    const { result, rerender } = renderHook(
      ({ t }: { t: number }) => useReplayCheerFx(t, FRAMES, REACTIONS, true),
      { initialProps: { t: 0 } },
    );

    rerender({ t: 0.6 }); // fires cheer
    expect(result.current).toHaveLength(1);

    // Advance time past the 1600ms auto-clear
    act(() => { vi.advanceTimersByTime(1600); });
    expect(result.current).toHaveLength(0);
  });

  it('resets when enabled becomes false (day switch / back to live)', () => {
    const { result, rerender } = renderHook(
      ({ t, enabled }: { t: number; enabled: boolean }) =>
        useReplayCheerFx(t, FRAMES, REACTIONS, enabled),
      { initialProps: { t: 0.6, enabled: true } },
    );

    expect(result.current).toHaveLength(1);

    // Switch back to live
    rerender({ t: 0.6, enabled: false });
    expect(result.current).toHaveLength(0);
  });

  it('fires nothing when there are no cheer reactions', () => {
    const boostOnly: ArchivedReaction[] = [
      { targetLogin: 'devon-r', kind: '🔥', reactor: 'x', createdAt: cheerAt, source: 'boost' },
    ];
    const { result, rerender } = renderHook(
      ({ t }: { t: number }) => useReplayCheerFx(t, FRAMES, boostOnly, true),
      { initialProps: { t: 0 } },
    );
    rerender({ t: 1.0 });
    expect(result.current).toHaveLength(0);
  });

  it('does not fire if frames list has fewer than 2 entries', () => {
    const singleFrame: SnapshotFrame[] = [
      { capturedAt: DAY_START, scores: [{ login: 'devon-r', score: 0 }] },
    ];
    const { result, rerender } = renderHook(
      ({ t }: { t: number }) => useReplayCheerFx(t, singleFrame, REACTIONS, true),
      { initialProps: { t: 0 } },
    );
    rerender({ t: 1.0 });
    expect(result.current).toHaveLength(0);
  });
});
