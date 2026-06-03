import { describe, it, expect } from 'vitest';
import { mapCommits, mapPulls, mapIssues } from '../../src/github/fetchActivity.js';

describe('fetchActivity mappers', () => {
  it('maps commit payloads to RawActivity', () => {
    const raw = [
      {
        sha: 'abc',
        commit: { author: { date: '2026-06-02T15:00:00Z' } },
        author: { login: 'devon-r', avatar_url: 'https://a/d.png' },
      },
    ];
    const out = mapCommits(raw as any);
    expect(out).toEqual([
      {
        type: 'commit',
        nativeId: 'abc',
        author: { login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://a/d.png' },
        occurredAt: '2026-06-02T15:00:00.000Z',
      },
    ]);
  });

  it('maps an open PR to pr_opened and a merged PR to pr_merged', () => {
    const raw = [
      { number: 12, state: 'open', merged_at: null, created_at: '2026-06-02T16:00:00Z',
        user: { login: 'mira-k', avatar_url: 'https://a/m.png' } },
      { number: 13, state: 'closed', merged_at: '2026-06-02T17:00:00Z', created_at: '2026-06-02T09:00:00Z',
        user: { login: 'devon-r', avatar_url: 'https://a/d.png' } },
    ];
    const out = mapPulls(raw as any);
    expect(out).toEqual([
      { type: 'pr_opened', nativeId: '12', author: { login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://a/m.png' }, occurredAt: '2026-06-02T16:00:00.000Z' },
      { type: 'pr_merged', nativeId: '13', author: { login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://a/d.png' }, occurredAt: '2026-06-02T17:00:00.000Z' },
    ]);
  });

  it('maps a closed issue to issue_closed and skips PRs surfaced as issues', () => {
    const raw = [
      { number: 34, state: 'closed', closed_at: '2026-06-02T18:00:00Z',
        user: { login: 'mira-k', avatar_url: 'https://a/m.png' } },
      { number: 35, state: 'closed', closed_at: '2026-06-02T18:30:00Z', pull_request: {},
        user: { login: 'devon-r', avatar_url: 'https://a/d.png' } },
    ];
    const out = mapIssues(raw as any);
    expect(out).toEqual([
      { type: 'issue_closed', nativeId: '34', author: { login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://a/m.png' }, occurredAt: '2026-06-02T18:00:00.000Z' },
    ]);
  });
});
