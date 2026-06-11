import { flagEmoji } from '@racingshape/shared';

export interface GeoOpts {
  enabled: boolean;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Returns a function IP -> flag emoji (or null). Caches per IP; fails closed. */
export function createIpApiGeo(opts: GeoOpts): (ip: string) => Promise<string | null> {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const cache = new Map<string, string | null>();

  return async (ip: string): Promise<string | null> => {
    if (!opts.enabled || !ip) return null;
    if (cache.has(ip)) return cache.get(ip) ?? null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
        { signal: ctrl.signal },
      );
      if (!res.ok) { cache.set(ip, null); return null; }
      const body = (await res.json()) as { status?: string; countryCode?: string };
      const flag = body.status === 'success' && body.countryCode ? flagEmoji(body.countryCode) : null;
      cache.set(ip, flag);
      return flag;
    } catch {
      cache.set(ip, null); // don't hammer on repeated failures
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
