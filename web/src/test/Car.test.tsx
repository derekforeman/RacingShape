import { render, screen, fireEvent } from '@testing-library/react';
import { Car, carPct } from '../components/Car';
import type { RacerStanding } from '../lib/types';

function s(over: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'devon-r',
    displayName: 'devon-r',
    avatarUrl: 'https://example.com/a.png',
    score: 44,
    breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
    position: 1,
    gapToLeader: 0,
    isLeader: true,
    topMover: false,
    reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } },
    cosmetics: [],
    ...over,
  };
}

describe('carPct (roadmap §10 auto-scale)', () => {
  it('puts the leader near the front (~82%)', () => {
    expect(carPct(44, 44)).toBeCloseTo(82, 5);
  });
  it('idles a zero score at the 2% start line', () => {
    expect(carPct(0, 44)).toBeCloseTo(2, 5);
  });
  it('clamps topScore to 1 to avoid divide-by-zero', () => {
    expect(carPct(0, 0)).toBeCloseTo(2, 5);
  });
});

describe('Car', () => {
  it('positions the car by score and uses the tween transition', () => {
    render(<Car standing={s({ score: 22 })} topScore={44} />);
    const car = screen.getByTestId('car');
    expect(car.style.left).toBe('42%'); // 2 + (22/44)*80
    expect(car.style.transition).toContain('cubic-bezier(.4,.8,.3,1)');
  });

  it('gives the leader the amber ring class', () => {
    render(<Car standing={s({ isLeader: true })} topScore={44} />);
    expect(screen.getByTestId('car').className).toMatch(/lead/);
  });

  it('shows the DRS tag only when topMover', () => {
    const { rerender } = render(<Car standing={s({ topMover: true })} topScore={44} />);
    expect(screen.getByTestId('drs-tag')).toBeInTheDocument();
    rerender(<Car standing={s({ topMover: false })} topScore={44} />);
    expect(screen.queryByTestId('drs-tag')).not.toBeInTheDocument();
  });

  it('renders the avatar image and falls back to initials when it errors', () => {
    render(<Car standing={s({ login: 'mira-k', avatarUrl: 'https://x/y.png' })} topScore={44} />);
    const img = screen.getByTestId('car-avatar') as HTMLImageElement;
    expect(img).toHaveAttribute('src', 'https://x/y.png');
    fireEvent.error(img);
    expect(screen.getByTestId('car-avatar-fallback')).toHaveTextContent('MK');
  });

  it('renders the read-only reaction count and a cosmetics slot', () => {
    render(<Car standing={s({ reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } } })} topScore={44} />);
    expect(screen.getByTestId('reaction-count')).toHaveTextContent('7');
    expect(screen.getByTestId('cosmetics-slot')).toBeInTheDocument();
  });

  it('the pod and reaction count expose tooltips', () => {
    render(<Car standing={s({})} topScore={44} />);
    expect(screen.getByTestId('car-pod')).toHaveAttribute('data-tip', expect.stringContaining('||'));
    expect(screen.getByTestId('reaction-count')).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });
});
