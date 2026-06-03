import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { ReactionCount } from '../components/ReactionCount';

describe('ReactionCount', () => {
  it('renders the total followed by a 🔥 glyph', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count').textContent).toBe('7🔥');
  });

  it('exposes a tooltip with the per-kind breakdown and the never-affects-score note', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } }} />
      </TooltipProvider>,
    );
    const tipStr = screen.getByTestId('reaction-count').getAttribute('data-tip') ?? '';
    expect(tipStr).toMatch(/Pit-stop boosts\|\|/);
    expect(tipStr).toMatch(/🔥 4/);
    expect(tipStr).toMatch(/⚡ 2/);
    expect(tipStr).toMatch(/🏎️ 1/);
    expect(tipStr).toMatch(/Never affects score\./);
  });

  it('reads "No boosts yet" when empty', () => {
    render(
      <TooltipProvider>
        <ReactionCount reactions={{ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } }} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('reaction-count').textContent).toBe('0🔥');
    expect(screen.getByTestId('reaction-count').getAttribute('data-tip') ?? '').toMatch(/No boosts yet/);
  });
});
