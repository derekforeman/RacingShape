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
    const payload = { raceDate: '2026-06-02', live: true, topScore: 44, standings: [], lastPolledAt: null, viewers: { count: 0, peak: 0, peakAt: null } } as RaceToday;
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));
    const out = await getRaceToday();
    expect(fetchMock).toHaveBeenCalledWith('/api/race/today', expect.any(Object));
    expect(out).toEqual(payload);
  });

  it('getStats encodes the range query', async () => {
    const payload = { range: '14d', repoUrl: 'https://github.com/S2AI/s2shape', chart: [], totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 }, completion: { rate: 0, closed: 0, opened: 0 }, streak: { current: 0, startDate: null, bestThisMonth: 0 }, crowd: { peakToday: 0, peaks: [] } } as StatsResponse;
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
