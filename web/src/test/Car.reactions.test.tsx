import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { Car } from '../components/Car';
import * as api from '../lib/api';
import type { RacerStanding } from '../lib/types';

const STANDING: RacerStanding = {
  login: 'devon-r',
  displayName: 'devon-r',
  avatarUrl: '',
  score: 44,
  breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 },
  position: 1,
  gapToLeader: 0,
  isLeader: true,
  topMover: true,
  reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } },
  cosmetics: [],
};

function renderCar(live: boolean) {
  return render(
    <TooltipProvider>
      <Car standing={STANDING} topScore={44} live={live} reactor="tester" />
    </TooltipProvider>,
  );
}

describe('Car reactions wiring', () => {
  beforeEach(() => {
    vi.spyOn(api, 'postReaction').mockResolvedValue({
      ok: true,
      reactions: { total: 8, byKind: { '🔥': 4, '⚡': 3, '🏎️': 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the reaction count and an enabled boost button on a live day', () => {
    renderCar(true);
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeEnabled();
  });

  it('clicking boost optimistically increments the displayed count immediately', async () => {
    renderCar(true);
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    expect(screen.getByTestId('reaction-count').textContent).toBe('8🔥');
  });

  it('omits the boost button when live is undefined (plan-03 read-only mode preserved)', () => {
    render(
      <TooltipProvider>
        <Car standing={STANDING} topScore={44} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /boost devon-r/i })).toBeNull();
  });

  it('disables boosting on an archived/replay day (live=false)', () => {
    renderCar(false);
    expect(screen.getByRole('button', { name: /boost devon-r/i })).toBeDisabled();
  });
});
