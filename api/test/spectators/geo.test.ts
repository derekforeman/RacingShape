import { describe, it, expect, vi } from 'vitest';
import { createIpApiGeo } from '../../src/spectators/geo.js';

const ok = (countryCode: string) =>
  ({ ok: true, json: async () => ({ status: 'success', countryCode }) }) as unknown as Response;

describe('createIpApiGeo', () => {
  it('resolves an IP to a flag emoji and caches it', async () => {
    const fetchFn = vi.fn(async () => ok('CA'));
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('1.2.3.4')).toBe('🇨🇦');
    expect(await geo('1.2.3.4')).toBe('🇨🇦'); // cached
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns null when disabled and never calls fetch', async () => {
    const fetchFn = vi.fn(async () => ok('CA'));
    const geo = createIpApiGeo({ enabled: false, fetchFn });
    expect(await geo('1.2.3.4')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns null on lookup failure', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); });
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('9.9.9.9')).toBeNull();
  });

  it('returns null on ip-api status:fail', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'fail' }) }) as unknown as Response);
    const geo = createIpApiGeo({ enabled: true, fetchFn });
    expect(await geo('10.0.0.1')).toBeNull();
  });
});
