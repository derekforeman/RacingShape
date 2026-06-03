import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { DateSelector } from '../components/DateSelector';
import type { RaceListItem } from '../lib/types';

const RACES: RaceListItem[] = [
  { raceDate: '2026-06-01', topScore: 44, winnerLogin: 'devon-r' },
  { raceDate: '2026-05-31', topScore: 30, winnerLogin: 'mira-k' },
];

describe('DateSelector', () => {
  it('renders a TODAY option plus one option per archived race', () => {
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={vi.fn()} />
      </TooltipProvider>,
    );
    const select = screen.getByRole('combobox', { name: /race day/i });
    const options = [...select.querySelectorAll('option')].map((o) => o.value);
    expect(options).toEqual(['today', '2026-06-01', '2026-05-31']);
    expect(screen.getByRole('option', { name: /TODAY/i })).toBeInTheDocument();
  });

  it('carries a tooltip attribute on the select', () => {
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('date-selector').getAttribute('data-tip') ?? '').toMatch(/\|\|/);
  });

  it('fires onSelect with the chosen race date', async () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="today" onSelect={onSelect} />
      </TooltipProvider>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), '2026-06-01');
    expect(onSelect).toHaveBeenCalledWith('2026-06-01');
  });

  it('fires onSelect with "today" when TODAY is chosen', async () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <DateSelector races={RACES} selected="2026-06-01" onSelect={onSelect} />
      </TooltipProvider>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /race day/i }), 'today');
    expect(onSelect).toHaveBeenCalledWith('today');
  });
});
