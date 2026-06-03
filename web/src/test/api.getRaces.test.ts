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
