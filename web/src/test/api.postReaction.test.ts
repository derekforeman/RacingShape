import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postReaction } from '../lib/api';
import type { CreateReactionResponse } from '../lib/types';

describe('postReaction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs the body to /api/race/today/reactions and returns the parsed response', async () => {
    const payload: CreateReactionResponse = {
      ok: true,
      reactions: { total: 8, byKind: { '🔥': 5, '⚡': 2, '🏎️': 1 } },
    };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const res = await postReaction({ targetLogin: 'devon-r', kind: '⚡', reactor: 'mira-k' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/race/today/reactions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ targetLogin: 'devon-r', kind: '⚡', reactor: 'mira-k' });
    expect(res).toEqual(payload);
  });

  it('throws on a non-ok response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    await expect(
      postReaction({ targetLogin: 'devon-r', kind: '🔥', reactor: 'me' }),
    ).rejects.toThrow(/500/);
  });
});
