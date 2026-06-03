import { describe, it, expect, vi } from 'vitest';
import { ResetScheduler, type ResetSchedulerDeps } from '../../src/scheduler/resetScheduler.js';

describe('ResetScheduler', () => {
  it('arms a timer for msUntilNextNyMidnight and snapshots the closing day on fire', () => {
    let fire: (() => void) | null = null;
    const snapshot = vi.fn();
    // 2026-06-02T23:59:00 EDT is 2026-06-03T03:59:00Z; ms to NY midnight = 60s.
    let now = new Date('2026-06-03T03:59:00.000Z');

    const deps: ResetSchedulerDeps = {
      clock: () => now,
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot,
      setTimer: (fn) => {
        fire = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    };

    const sched = new ResetScheduler(deps);
    sched.start();
    expect(fire).not.toBeNull();

    // advance to just before the new midnight and fire
    now = new Date('2026-06-03T04:00:00.000Z');
    fire!();
    expect(snapshot).toHaveBeenCalledTimes(1);
    // it snapshots the *closing* day's race date
    expect(snapshot.mock.calls[0]![0]).toBe('2026-06-02');
  });

  it('re-arms the timer after firing', () => {
    let armCount = 0;
    let fire: (() => void) | null = null;
    const now = new Date('2026-06-03T03:59:00.000Z');
    const deps: ResetSchedulerDeps = {
      clock: () => now,
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot: () => {},
      setTimer: (fn) => {
        armCount += 1;
        fire = fn;
        return armCount as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    };
    const sched = new ResetScheduler(deps);
    sched.start();
    expect(armCount).toBe(1);
    fire!();
    expect(armCount).toBe(2); // re-armed for the next midnight
  });

  it('stop() clears the timer and prevents re-arming', () => {
    const clearTimer = vi.fn();
    let fire: (() => void) | null = null;
    const deps: ResetSchedulerDeps = {
      clock: () => new Date('2026-06-03T03:59:00.000Z'),
      msUntilNextNyMidnight: () => 60_000,
      raceDateFor: () => '2026-06-02',
      snapshot: () => {},
      setTimer: (fn) => {
        fire = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer,
    };
    const sched = new ResetScheduler(deps);
    sched.start();
    sched.stop();
    expect(clearTimer).toHaveBeenCalled();
    const armedBefore = fire;
    fire!(); // firing after stop must not re-arm or snapshot
    expect(fire).toBe(armedBefore);
  });
});
