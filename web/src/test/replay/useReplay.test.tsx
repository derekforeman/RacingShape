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
