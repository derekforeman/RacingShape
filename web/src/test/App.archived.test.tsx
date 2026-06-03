import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../lib/api';
import type { RaceToday, RaceArchive, RaceListItem, StatsResponse } from '../lib/types';

const TODAY: RaceToday = {
  raceDate: '2026-06-02',
  live: true,
  topScore: 12,
  lastPolledAt: '2026-06-02T15:00:00.000Z',
  standings: [
    {
      login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 12,
      breakdown: { commit: 12, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
      position: 1, gapToLeader: 0, isLeader: true, topMover: true,
      reactions: { total: 2, byKind: { '🔥': 2, '⚡': 0, '🏎️': 0 } }, cosmetics: [],
    },
  ],
};

const RACES: RaceListItem[] = [{ raceDate: '2026-06-01', topScore: 44, winnerLogin: 'devon-r' }];

const ARCHIVE: RaceArchive = {
  raceDate: '2026-06-01',
  live: false,
  topScore: 44,
  standings: [
    {
      login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44,
      breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
      position: 1, gapToLeader: 0, isLeader: true, topMover: false,
      reactions: { total: 7, byKind: { '🔥': 5, '⚡': 1, '🏎️': 1 } }, cosmetics: ['gold_rims'],
    },
    {
      login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31,
      breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 },
      position: 2, gapToLeader: 13, isLeader: false, topMover: false,
      reactions: { total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } }, cosmetics: ['flame_trail'],
    },
  ],
  frames: [
    { capturedAt: '2026-06-01T04:00:00.000Z', scores: [{ login: 'devon-r', score: 0 }, { login: 'mira-k', score: 0 }] },
    { capturedAt: '2026-06-02T03:55:00.000Z', scores: [{ login: 'devon-r', score: 44 }, { login: 'mira-k', score: 31 }] },
  ],
  reactions: [
    { targetLogin: 'devon-r', kind: '🔥', reactor: 'mira-k', createdAt: '2026-06-01T18:00:00.000Z' },
  ],
  recap: {
    raceDate: '2026-06-01',
    podium: [
      { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
      { position: 2, login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 } },
    ],
    superlatives: [
      { key: 'fastest_hour', title: 'Fastest hour', login: 'devon-r', detail: '9 commits · 2–3pm' },
      { key: 'comeback', title: 'Comeback of the day', login: 'mira-k', detail: '+22 after 6pm' },
      { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'no late activity' },
    ],
  },
};

const STATS: StatsResponse = {
  range: '14d', repoUrl: 'https://github.com/S2AI/s2shape', chart: [],
  totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 },
  completion: { rate: 0, closed: 0, opened: 0 },
  streak: { current: 0, startDate: null, bestThisMonth: 0 },
};

vi.mock('../lib/api');
import App from '../App';

describe('App archived/replay mode', () => {
  beforeEach(() => {
    vi.mocked(api.getRaceToday).mockResolvedValue(TODAY);
    vi.mocked(api.getRaces).mockResolvedValue(RACES);
    vi.mocked(api.getStats).mockResolvedValue(STATS);
    vi.mocked(api.getArchive).mockResolvedValue(ARCHIVE);
    vi.mocked(api.postReaction).mockResolvedValue({ ok: true, reactions: TODAY.standings[0]!.reactions });
  });
  afterEach(() => vi.clearAllMocks());

  it('starts live: polls getRaceToday and enables boosting', async () => {
    render(<App />);
    await waitFor(() => expect(api.getRaceToday).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /boost devon-r/i })).toBeEnabled();
    expect(screen.queryByTestId('recap-card')).toBeNull();
  });

  it('selecting an archived date fetches the archive, shows the recap + replay controls, and disables boosting', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalledWith('2026-06-01'));

    expect(await screen.findByTestId('recap-card')).toBeInTheDocument();
    // target the replay control by test id: the Recap card also has a "REPLAY LINK" button
    expect(screen.getByTestId('replay-btn')).toBeEnabled();
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeDisabled();
  });

  it('positions cars from replay scores at t=0 (start line) for an archived day', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalled());

    const cars = await screen.findAllByTestId('car');
    cars.forEach((c) => expect((c as HTMLElement).style.left).toBe('2%')); // pct(0,44) = 2%
  });

  it('switching back to TODAY resumes live polling and re-enables boosting', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /boost devon-r/i });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    await waitFor(() => expect(api.getArchive).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), 'today');
    expect(await screen.findByRole('button', { name: /boost devon-r/i })).toBeEnabled();
    expect(screen.queryByTestId('recap-card')).toBeNull();
  });
});
