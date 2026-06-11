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
