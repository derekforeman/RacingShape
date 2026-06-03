import { render, screen, within } from '@testing-library/react';
import { TimingTower } from '../components/TimingTower';
import type { RacerStanding } from '../lib/types';

function s(over: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'x',
    displayName: 'x',
    avatarUrl: '',
    score: 0,
    breakdown: { commit: 0, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position: 1,
    gapToLeader: 0,
    isLeader: false,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
    ...over,
  };
}

const standings: RacerStanding[] = [
  s({ login: 'devon-r', score: 44, position: 1, isLeader: true, gapToLeader: 0, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } }),
  s({ login: 'mira-k', score: 31, position: 2, gapToLeader: 13 }),
  s({ login: 'sasha-p', score: 27, position: 3, gapToLeader: 17 }),
];

describe('TimingTower', () => {
  it('renders rows in position order', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(within(rows[0]).getByText('devon-r')).toBeInTheDocument();
    expect(within(rows[1]).getByText('mira-k')).toBeInTheDocument();
    expect(within(rows[2]).getByText('sasha-p')).toBeInTheDocument();
  });

  it('marks P1 with the leader class', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(rows[0].className).toMatch(/border-l-amber/);
    expect(rows[1].className).not.toMatch(/border-l-amber/);
  });

  it('shows LDR for P1 and +n for the rest', () => {
    render(<TimingTower standings={standings} />);
    expect(screen.getByText('LDR')).toBeInTheDocument();
    expect(screen.getByText('+13')).toBeInTheDocument();
    expect(screen.getByText('+17')).toBeInTheDocument();
  });

  it('every row carries the breakdown tooltip', () => {
    render(<TimingTower standings={standings} />);
    const rows = screen.getAllByTestId('tower-row');
    expect(rows[0]).toHaveAttribute('data-tip', expect.stringContaining('devon-r — 44 pts||'));
    expect(rows[0].getAttribute('data-tip')).toContain('10 commits ×1 = 10');
  });
});
