import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { Car } from '../components/Car';
import type { RacerStanding } from '../lib/types';

function s(score: number): RacerStanding {
  return {
    login: 'devon-r',
    displayName: 'devon-r',
    avatarUrl: '',
    score,
    breakdown: { commit: score, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
    position: 1,
    gapToLeader: 0,
    isLeader: true,
    topMover: false,
    reactions: { total: 7, byKind: { '🔥': 7, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
  };
}

function renderCar(score: number, topScore: number) {
  return render(
    <TooltipProvider>
      <Car standing={s(score)} topScore={topScore} />
    </TooltipProvider>,
  );
}

describe('Car label placement near the finish line', () => {
  it('flips the avatar + name to the LEFT of the pod when near the finish (pct > 60)', () => {
    renderCar(44, 44); // pct = 2 + (44/44)*80 = 82 -> near finish
    const info = screen.getByTestId('car-info');
    expect(info.className).toMatch(/right-full/);
    expect(info.className).toMatch(/flex-row-reverse/);
    // label content still intact (not clipped away)
    expect(screen.getByText('devon-r')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-count')).toBeInTheDocument();
  });

  it('keeps the label to the RIGHT for a mid-pack car (no flip)', () => {
    renderCar(10, 44); // pct = 2 + (10/44)*80 ≈ 20 -> not near finish
    const info = screen.getByTestId('car-info');
    expect(info.className).not.toMatch(/right-full/);
    expect(info.className).not.toMatch(/flex-row-reverse/);
  });

  it('does not flip a leader on an empty/low day (topScore floored, pct stays at start)', () => {
    renderCar(0, 1); // pct = 2 -> start line, no flip
    expect(screen.getByTestId('car-info').className).not.toMatch(/right-full/);
  });
});
