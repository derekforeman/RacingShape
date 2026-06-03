import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { GrandPrixReveal } from '../components/GrandPrixReveal';
import type { Recap, ScoreBreakdown } from '../lib/types';

const RECAP: Recap = {
  raceDate: '2026-06-01',
  podium: [
    { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
    { position: 2, login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 } },
    { position: 3, login: 'sasha-p', displayName: 'sasha-p', avatarUrl: '', score: 27, breakdown: { commit: 7, pr_opened: 0, pr_merged: 3, issue_closed: 0 } },
  ],
  superlatives: [],
};
const TEAM_BREAKDOWN: ScoreBreakdown = { commit: 22, pr_opened: 3, pr_merged: 8, issue_closed: 4 };

function renderReveal(over: Partial<React.ComponentProps<typeof GrandPrixReveal>> = {}) {
  const onDismiss = vi.fn();
  const onViewResults = vi.fn();
  render(
    <TooltipProvider>
      <GrandPrixReveal
        recap={RECAP}
        teamTotal={102}
        teamBreakdown={TEAM_BREAKDOWN}
        onDismiss={onDismiss}
        onViewResults={onViewResults}
        {...over}
      />
    </TooltipProvider>,
  );
  return { onDismiss, onViewResults };
}

describe('GrandPrixReveal', () => {
  afterEach(() => vi.useRealTimers());

  it('leads with the team total and the day, then the podium', () => {
    renderReveal();
    const total = screen.getByTestId('reveal-team-total');
    expect(total).toHaveTextContent('102');
    expect(total).toHaveTextContent('22 commits');
    expect(screen.getByText(/RACE OVER — 2026-06-01/)).toBeInTheDocument();
  });

  it('shows the three podium steps in P2, P1, P3 visual order with P1 raised', () => {
    renderReveal();
    const steps = screen.getAllByTestId(/^reveal-podium-/);
    expect(steps.map((s) => s.getAttribute('data-testid'))).toEqual([
      'reveal-podium-2',
      'reveal-podium-1',
      'reveal-podium-3',
    ]);
    expect(screen.getByTestId('reveal-podium-1').className).toMatch(/raised/);
  });

  it('renders a podium avatar per step (initials fallback when no image)', () => {
    renderReveal();
    expect(screen.getAllByTestId('podium-avatar-fallback')).toHaveLength(3);
  });

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <TooltipProvider>
        <GrandPrixReveal recap={RECAP} teamTotal={1} teamBreakdown={TEAM_BREAKDOWN} onDismiss={onDismiss} onViewResults={() => {}} />
      </TooltipProvider>,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(8000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape and on backdrop click, but not when clicking the card', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderReveal();
    await user.click(screen.getByText(/RACE OVER/)); // inside the card → no dismiss
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('grand-prix-reveal')); // backdrop
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('calls onViewResults from the View Full Results button', async () => {
    const { onViewResults } = renderReveal();
    await userEvent.click(screen.getByTestId('reveal-view-results'));
    expect(onViewResults).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when there is no podium', () => {
    const { container } = render(
      <TooltipProvider>
        <GrandPrixReveal recap={{ ...RECAP, podium: [] }} teamTotal={0} teamBreakdown={TEAM_BREAKDOWN} onDismiss={() => {}} onViewResults={() => {}} />
      </TooltipProvider>,
    );
    expect(container.querySelector('[data-testid="grand-prix-reveal"]')).toBeNull();
  });
});
