import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../lib/api';
import type { RaceToday, RaceArchive, RaceListItem, StatsResponse } from '../lib/types';

const SEEN_KEY = 'racingshape-recap-seen';

const TODAY: RaceToday = {
  raceDate: '2026-06-02', live: true, topScore: 1, lastPolledAt: null, standings: [],
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
      reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } }, cosmetics: [],
    },
  ],
  frames: [],
  reactions: [],
  recap: {
    raceDate: '2026-06-01',
    podium: [
      { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
    ],
    superlatives: [
      { key: 'fastest_hour', title: 'Fastest hour', login: 'devon-r', detail: 'x' },
      { key: 'comeback', title: 'Comeback of the day', login: null, detail: 'x' },
      { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'x' },
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

describe('App grand-prix reveal', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'dark');
    vi.mocked(api.getRaceToday).mockResolvedValue(TODAY);
    vi.mocked(api.getRaces).mockResolvedValue(RACES);
    vi.mocked(api.getStats).mockResolvedValue(STATS);
    vi.mocked(api.getArchive).mockResolvedValue(ARCHIVE);
  });
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('reveals the freshly-completed day once, leading with the team total', async () => {
    render(<App />);
    expect(await screen.findByTestId('grand-prix-reveal')).toBeInTheDocument();
    expect(screen.getByTestId('reveal-team-total')).toHaveTextContent('44');
    expect(screen.getByTestId('reveal-podium-1')).toBeInTheDocument();
  });

  it('dismissing it persists "seen" so it does not show again', async () => {
    render(<App />);
    await screen.findByTestId('grand-prix-reveal');
    await userEvent.click(screen.getByTestId('reveal-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('grand-prix-reveal')).toBeNull());
    expect(localStorage.getItem(SEEN_KEY)).toBe('2026-06-01');
  });

  it('does not reveal a day that was already seen', async () => {
    localStorage.setItem(SEEN_KEY, '2026-06-01');
    render(<App />);
    await waitFor(() => expect(api.getRaces).toHaveBeenCalled());
    expect(screen.queryByTestId('grand-prix-reveal')).toBeNull();
  });

  it('"View full results" opens the archived recap and closes the reveal', async () => {
    render(<App />);
    await screen.findByTestId('grand-prix-reveal');
    await userEvent.click(screen.getByTestId('reveal-view-results'));
    expect(await screen.findByTestId('recap-card')).toBeInTheDocument();
    expect(screen.queryByTestId('grand-prix-reveal')).toBeNull();
  });
});
