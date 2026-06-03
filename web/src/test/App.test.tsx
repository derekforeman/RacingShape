import { afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { RaceToday, StatsResponse } from '../lib/types';

// vi.mock is hoisted above module-scope consts, so fixtures must live in vi.hoisted.
const { raceToday, stats } = vi.hoisted(() => {
  const raceToday: RaceToday = {
    raceDate: '2026-06-02',
    live: true,
    topScore: 44,
    lastPolledAt: '2026-06-02T15:00:00.000Z',
    standings: [
      {
        login: 'devon-r', displayName: 'devon-r', avatarUrl: 'https://x/d.png',
        score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
        position: 1, gapToLeader: 0, isLeader: true, topMover: true,
        reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }, cosmetics: [],
      },
      {
        login: 'mira-k', displayName: 'mira-k', avatarUrl: 'https://x/m.png',
        score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 },
        position: 2, gapToLeader: 13, isLeader: false, topMover: false,
        reactions: { total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } }, cosmetics: [],
      },
    ],
  };

  const stats: StatsResponse = {
    range: '14d',
    repoUrl: 'https://github.com/S2AI/s2shape',
    chart: [{ raceDate: '2026-06-02', commits: 10, prsOpened: 2, issuesClosed: 2 }],
    totalTasks: { total: 37, issues: 23, prs: 14, deltaVsPriorWeek: 9 },
    completion: { rate: 0.82, closed: 41, opened: 50 },
    streak: { current: 12, startDate: '2026-05-22', bestThisMonth: 12 },
  };

  return { raceToday, stats };
});

vi.mock('../lib/api', () => ({
  getRaceToday: vi.fn().mockResolvedValue(raceToday),
  getStats: vi.fn().mockResolvedValue(stats),
  getRaces: vi.fn().mockResolvedValue([]),
  getArchive: vi.fn(),
}));

import App from '../App';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('App integration', () => {
  it('renders the leader, tower order, and a chart bar from the api', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('tower-row').length).toBe(2));
    const rows = screen.getAllByTestId('tower-row');
    expect(within(rows[0]).getByText('devon-r')).toBeInTheDocument();
    expect(within(rows[1]).getByText('mira-k')).toBeInTheDocument();
    expect(screen.getByText('LDR')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-stack').length).toBe(1);
    expect(screen.getByTestId('stat-tasks')).toHaveTextContent('37');
  });

  it('persists the dark-mode toggle', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('theme-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('theme-btn'));
    expect(localStorage.getItem('racingshape-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('shows an error state when the race fetch fails', async () => {
    const api = await import('../lib/api');
    (api.getRaceToday as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('race-error')).toBeInTheDocument());
  });
});
