import { render, screen, within } from '@testing-library/react';
import { Track } from '../components/Track';
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

describe('Track', () => {
  it('renders one lane per racer', () => {
    render(<Track standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    expect(screen.getAllByTestId('lane')).toHaveLength(2);
  });

  it('renders a checkered finish line with an auto-scale tooltip', () => {
    render(<Track standings={[s('a', 10, 1)]} topScore={10} />);
    const finish = screen.getByTestId('finish-line');
    expect(finish).toHaveAttribute('data-tip', expect.stringContaining('Auto-scaled'));
  });

  it('places each racer car inside its lane', () => {
    render(<Track standings={[s('a', 10, 1), s('b', 5, 2)]} topScore={10} />);
    const lanes = screen.getAllByTestId('lane');
    expect(within(lanes[0]).getByTestId('car')).toBeInTheDocument();
    expect(within(lanes[1]).getByTestId('car')).toBeInTheDocument();
  });
});
