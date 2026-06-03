import { Octokit } from '@octokit/rest';
import type Database from 'better-sqlite3';
import type { AppConfig } from '../config.js';
import { get as getCache, put as putCache } from '../db/repositories/httpCache.js';

/** The minimal request function shape we depend on (Octokit's `octokit.request`). */
export type RequestFn = (
  route: string,
  options?: Record<string, unknown>,
) => Promise<{
  status: number;
  headers: Record<string, string | undefined>;
  data: unknown;
}>;

/**
 * Build an authenticated Octokit. The token comes only from config and is never
 * returned, logged, or serialized anywhere. Callers use `octokit.request`.
 */
export function makeOctokit(config: AppConfig): Octokit {
  return new Octokit({ auth: config.githubToken });
}

/**
 * Conditional GET against GitHub using stored ETags. On 200, caches etag+body and
 * returns the parsed data. On 304, returns the cached body (no re-fetch cost on the
 * rate limit). `request` is injected so tests can supply a fake.
 */
export async function conditionalGet<T = unknown>(
  db: Database.Database,
  request: RequestFn,
  route: string,
  options: Record<string, unknown>,
  nowIso: string = new Date().toISOString(),
): Promise<T> {
  const cached = getCache(db, route);
  const headers: Record<string, string> = {};
  if (cached?.etag) headers['if-none-match'] = cached.etag;

  try {
    const res = await request(route, { ...options, headers });
    const etag = res.headers.etag ?? null;
    putCache(db, {
      url: route,
      etag,
      lastModified: res.headers['last-modified'] ?? null,
      body: JSON.stringify(res.data),
      fetchedAt: nowIso,
    });
    return res.data as T;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 304 && cached?.body != null) {
      return JSON.parse(cached.body) as T;
    }
    throw err;
  }
}
