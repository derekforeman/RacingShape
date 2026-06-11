import type { SpectatorFan } from '@racingshape/shared';

export interface PeakStore {
  getPeak(raceDate: string): { count: number; at: string } | null;
  setPeak(raceDate: string, count: number, at: string): void;
}

interface Presence {
  sessionId: string;
  name: string | null;
  flag: string | null;
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
    // Named fans first, then anonymous (stable sort preserves order within each group).
    fans.sort((a, b) => Number(!a.name) - Number(!b.name));
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
