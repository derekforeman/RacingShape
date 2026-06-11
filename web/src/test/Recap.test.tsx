import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { Recap } from '../components/Recap';
import type { Recap as RecapType, Cosmetic } from '../lib/types';

const RECAP: RecapType = {
  raceDate: '2026-06-01',
  podium: [
    { position: 1, login: 'devon-r', displayName: 'devon-r', avatarUrl: '', score: 44, breakdown: { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 } },
    { position: 2, login: 'mira-k', displayName: 'mira-k', avatarUrl: '', score: 31, breakdown: { commit: 5, pr_opened: 1, pr_merged: 2, issue_closed: 4 } },
    { position: 3, login: 'sasha-p', displayName: 'sasha-p', avatarUrl: '', score: 27, breakdown: { commit: 7, pr_opened: 0, pr_merged: 3, issue_closed: 0 } },
  ],
  superlatives: [
    { key: 'fastest_hour', title: 'Fastest hour', login: 'devon-r', detail: '9 commits · 2–3pm' },
    { key: 'comeback', title: 'Comeback of the day', login: 'mira-k', detail: '+22 after 6pm' },
    { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'no late activity' },
  ],
};

const COSMETICS: Record<string, Cosmetic[]> = {
  'devon-r': ['gold_rims'],
  'mira-k': ['flame_trail'],
};

function renderRecap(recap = RECAP, earned = COSMETICS, crowdPeak?: number) {
  return render(
    <TooltipProvider>
      <Recap recap={recap} cosmeticsByLogin={earned} onExportPng={() => {}} replayLink="http://x/race/2026-06-01" crowdPeak={crowdPeak} />
    </TooltipProvider>,
  );
}

describe('Recap', () => {
  it('renders the three podium steps in P2, P1, P3 visual order with P1 raised', () => {
    renderRecap();
    const steps = screen.getAllByTestId(/^podium-step-/);
    expect(steps.map((s) => s.getAttribute('data-testid'))).toEqual([
      'podium-step-2',
      'podium-step-1',
      'podium-step-3',
    ]);
    const p1 = screen.getByTestId('podium-step-1');
    expect(p1.className).toMatch(/raised/);
    expect(within(p1).getByText('devon-r')).toBeInTheDocument();
    expect(within(p1).getByText(/44 PTS/)).toBeInTheDocument();
  });

  it('gives each podium step a per-racer breakdown tooltip', () => {
    renderRecap();
    const pil = within(screen.getByTestId('podium-step-1')).getByTestId('podium-pil-1');
    const tipStr = pil.getAttribute('data-tip') ?? '';
    expect(tipStr).toMatch(/P1 · devon-r/);
    expect(tipStr).toMatch(/commits/);
  });

  it('renders three superlative tiles with definition tooltips', () => {
    renderRecap();
    expect(screen.getAllByTestId(/^super-/)).toHaveLength(3);
    const fastest = screen.getByTestId('super-fastest_hour');
    expect(fastest.textContent).toMatch(/Fastest hour/);
    expect(fastest.textContent).toMatch(/devon-r/);
    expect(fastest.getAttribute('data-tip') ?? '').toMatch(/Most points scored in any single 60-min window/);
  });

  it('renders an em-dash placeholder for a null-login superlative', () => {
    renderRecap();
    expect(screen.getByTestId('super-midnight_grinder').textContent).toMatch(/—/);
  });

  it('lists the cosmetics earned that day', () => {
    renderRecap();
    const earned = screen.getByTestId('recap-cosmetics');
    expect(earned.textContent).toMatch(/devon-r/);
    expect(earned.textContent).toMatch(/Gold rims/);
    expect(earned.textContent).toMatch(/mira-k/);
    expect(earned.textContent).toMatch(/Flame trail/);
  });

  it('renders nothing when there is no podium (empty day)', () => {
    const { container } = renderRecap({ ...RECAP, podium: [] }, {});
    expect(container.querySelector('[data-testid="recap-card"]')).toBeNull();
  });

  it('renders the biggest-crowd card when crowdPeak > 0', () => {
    renderRecap(RECAP, COSMETICS, 42);
    const card = screen.getByTestId('super-crowd-peak');
    expect(card).toBeInTheDocument();
    expect(card.textContent).toMatch(/Biggest crowd/i);
    expect(card.textContent).toMatch(/42 fans/);
  });

  it('omits the biggest-crowd card when crowdPeak is 0', () => {
    const { container } = renderRecap(RECAP, COSMETICS, 0);
    expect(container.querySelector('[data-testid="super-crowd-peak"]')).toBeNull();
  });

  it('omits the biggest-crowd card when crowdPeak is undefined', () => {
    const { container } = renderRecap(RECAP, COSMETICS, undefined);
    expect(container.querySelector('[data-testid="super-crowd-peak"]')).toBeNull();
  });
});
