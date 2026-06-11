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
