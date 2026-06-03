import { render, screen, within } from '@testing-library/react';
import { RaceControl } from '../components/RaceControl';
import type { RacerStanding } from '../lib/types';

function s(login: string, score: number, position: number): RacerStanding {
  return {
    login,
    displayName: login,
    avatarUrl: '',
    score,
    breakdown: { commit: score, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position,
    gapToLeader: 0,
    isLeader: position === 1,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
  };
}

describe('RaceControl', () => {
  it('renders the LAP: LIVE badge with a race-window tooltip', () => {
    render(<RaceControl standings={[s('a', 10, 1)]} topScore={10} />);
    const badge = screen.getByTestId('lap-badge');
    expect(badge).toHaveTextContent(/LAP: LIVE/);
    expect(badge.getAttribute('data-tip')).toContain('America/New_York');
  });

  it('renders the timing tower and the track together', () => {
    render(<RaceControl standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    expect(screen.getAllByTestId('tower-row')).toHaveLength(2);
    expect(screen.getAllByTestId('lane')).toHaveLength(2);
  });

  it('empty day shows inviting copy and no rows', () => {
    render(<RaceControl standings={[]} topScore={1} />);
    expect(screen.queryAllByTestId('tower-row')).toHaveLength(0);
    expect(screen.getByTestId('empty-state')).toHaveTextContent(/first commit/i);
  });

  it('single contributor still renders a car at the start', () => {
    render(<RaceControl standings={[s('solo', 0, 1)]} topScore={1} />);
    const lane = screen.getByTestId('lane');
    expect(within(lane).getByTestId('car')).toBeInTheDocument();
    expect(within(lane).getByTestId('car').style.left).toBe('2%');
  });
});
