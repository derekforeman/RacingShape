import type Database from 'better-sqlite3';
import type { AppConfig } from '../config.js';
import { conditionalGet, type RequestFn } from './client.js';
import { raceDateFor } from '../time/raceDate.js';
import type { RawActivity, RawActivityBatch } from './types.js';

interface RawCommit {
  sha: string;
  commit: { author?: { date?: string } | null };
  author: { login?: string; avatar_url?: string } | null;
}
interface RawPull {
  number: number;
  state: string;
  merged_at: string | null;
  created_at: string;
  user: { login?: string; avatar_url?: string } | null;
}
interface RawIssue {
  number: number;
  state: string;
  closed_at: string | null;
  pull_request?: unknown;
  user: { login?: string; avatar_url?: string } | null;
}

function author(login: string | undefined, avatar: string | undefined) {
  const l = login ?? 'unknown';
  return { login: l, displayName: l, avatarUrl: avatar ?? '' };
}
const iso = (s: string) => new Date(s).toISOString();

export function mapCommits(rows: RawCommit[]): RawActivity[] {
  return rows
    .filter((c) => c.commit?.author?.date)
    .map((c) => ({
      type: 'commit' as const,
      nativeId: c.sha,
      author: author(c.author?.login, c.author?.avatar_url),
      occurredAt: iso(c.commit!.author!.date!),
    }));
}

export function mapPulls(rows: RawPull[]): RawActivity[] {
  const out: RawActivity[] = [];
  for (const p of rows) {
    if (p.merged_at) {
      out.push({
        type: 'pr_merged',
        nativeId: String(p.number),
        author: author(p.user?.login, p.user?.avatar_url),
        occurredAt: iso(p.merged_at),
      });
    } else {
      out.push({
        type: 'pr_opened',
        nativeId: String(p.number),
        author: author(p.user?.login, p.user?.avatar_url),
        occurredAt: iso(p.created_at),
      });
    }
  }
  return out;
}

export function mapIssues(rows: RawIssue[]): RawActivity[] {
  return rows
    .filter((i) => i.state === 'closed' && i.closed_at && i.pull_request === undefined)
    .map((i) => ({
      type: 'issue_closed' as const,
      nativeId: String(i.number),
      author: author(i.user?.login, i.user?.avatar_url),
      occurredAt: iso(i.closed_at!),
    }));
}

/**
 * Production fetchBatch for the poller: pull commits/PRs/issues via conditional GETs,
 * map them, and keep only those whose NY race date matches the target day.
 */
export function makeFetchBatch(
  db: Database.Database,
  request: RequestFn,
  config: AppConfig,
): (raceDate: string) => Promise<RawActivityBatch> {
  const base = `/repos/${config.repoOwner}/${config.repoName}`;
  return async (raceDate: string): Promise<RawActivityBatch> => {
    const commits = await conditionalGet<RawCommit[]>(db, request, `GET ${base}/commits`, { per_page: 100 });
    const pulls = await conditionalGet<RawPull[]>(db, request, `GET ${base}/pulls`, { state: 'all', per_page: 100, sort: 'updated', direction: 'desc' });
    const issues = await conditionalGet<RawIssue[]>(db, request, `GET ${base}/issues`, { state: 'closed', per_page: 100, sort: 'updated', direction: 'desc' });

    const all = [...mapCommits(commits), ...mapPulls(pulls), ...mapIssues(issues)];
    const activities = all.filter((a) => raceDateFor(new Date(a.occurredAt)) === raceDate);
    return { raceDate, activities };
  };
}
