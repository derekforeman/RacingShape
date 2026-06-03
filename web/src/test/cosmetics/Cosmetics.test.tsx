import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../../lib/tooltip';
import { Cosmetics } from '../../components/cosmetics/Cosmetics';
import type { Cosmetic } from '../../lib/types';

function renderCosmetics(cosmetics: Cosmetic[]) {
  return render(
    <TooltipProvider>
      <Cosmetics cosmetics={cosmetics} />
    </TooltipProvider>,
  );
}

describe('Cosmetics', () => {
  it('keeps the inert cosmetics-slot test id so plan-03 Car tests still pass', () => {
    renderCosmetics([]);
    expect(screen.getByTestId('cosmetics-slot')).toBeInTheDocument();
  });

  it('renders no cosmetic sprites when none are present', () => {
    renderCosmetics([]);
    expect(screen.queryByTestId('cosmetic-flame_trail')).toBeNull();
    expect(screen.queryByTestId('cosmetic-gold_rims')).toBeNull();
    expect(screen.queryByTestId('cosmetic-rookie_decal')).toBeNull();
  });

  it('renders a flame trail with an earned-by tooltip', () => {
    renderCosmetics(['flame_trail']);
    const el = screen.getByTestId('cosmetic-flame_trail');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Flame trail/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/streak of 5\+/i);
  });

  it('renders gold rims with an earned-by tooltip', () => {
    renderCosmetics(['gold_rims']);
    const el = screen.getByTestId('cosmetic-gold_rims');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Gold rims/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/first merge of the day/i);
  });

  it('renders the rookie decal with an earned-by tooltip', () => {
    renderCosmetics(['rookie_decal']);
    const el = screen.getByTestId('cosmetic-rookie_decal');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-tip') ?? '').toMatch(/Rookie of the Day/);
    expect(el.getAttribute('data-tip') ?? '').toMatch(/most-improved vs yesterday/i);
  });

  it('renders all three together', () => {
    renderCosmetics(['flame_trail', 'gold_rims', 'rookie_decal']);
    expect(screen.getByTestId('cosmetic-flame_trail')).toBeInTheDocument();
    expect(screen.getByTestId('cosmetic-gold_rims')).toBeInTheDocument();
    expect(screen.getByTestId('cosmetic-rookie_decal')).toBeInTheDocument();
  });
});
