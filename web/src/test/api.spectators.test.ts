import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postHeartbeat, postCheer } from '../lib/api';
import type { HeartbeatResponse, CheerResponse } from '@racingshape/shared';

describe('postHeartbeat', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs to /api/spectators/heartbeat and returns parsed response', async () => {
    const payload: HeartbeatResponse = { flag: '🇺🇸' };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const body = { sessionId: 'test-session-123', name: 'Alice', flag: null, cheerForLogin: null };
    const res = await postHeartbeat(body);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/spectators/heartbeat');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(body);
    expect(res).toEqual(payload);
  });

  it('throws on a non-ok response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });
    await expect(
      postHeartbeat({ sessionId: 'abc' }),
    ).rejects.toThrow(/503/);
  });
});

describe('postCheer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs to /api/spectators/cheer and returns parsed response', async () => {
    const payload: CheerResponse = { ok: true };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const body = { sessionId: 'test-session-123', targetLogin: 'devon-r' };
    const res = await postCheer(body);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/spectators/cheer');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(body);
    expect(res).toEqual(payload);
  });

  it('returns a cooldown reason when the server responds with it', async () => {
    const payload: CheerResponse = { ok: false, reason: 'cooldown' };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    const res = await postCheer({ sessionId: 'abc', targetLogin: 'someone' });
    expect(res).toEqual(payload);
  });
});
