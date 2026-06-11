import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../lib/tooltip';
import { BroadcastBug } from '../components/BroadcastBug';

function renderBug(props: React.ComponentProps<typeof BroadcastBug>) {
  return render(
    <TooltipProvider>
      <BroadcastBug {...props} />
    </TooltipProvider>,
  );
}

describe('BroadcastBug', () => {
  it('displays the viewer count and peak', () => {
    renderBug({ count: 2, peak: 5, peakAt: null, namedCount: 1 });
    expect(screen.getByText('2 WATCHING · PEAK 5')).toBeInTheDocument();
  });

  it('data-tip includes the named/anon breakdown', () => {
    renderBug({ count: 3, peak: 7, peakAt: null, namedCount: 2 });
    const bug = screen.getByTestId('broadcast-bug');
    const tip = bug.getAttribute('data-tip') ?? '';
    expect(tip).toContain('2 named');
    expect(tip).toContain('1 anonymous');
  });

  it('data-tip includes the watching count and peak', () => {
    renderBug({ count: 4, peak: 10, peakAt: '2024-06-01T14:30:00Z', namedCount: 0 });
    const bug = screen.getByTestId('broadcast-bug');
    const tip = bug.getAttribute('data-tip') ?? '';
    expect(tip).toContain('4 watching now');
    expect(tip).toContain('peak 10');
  });

  it('shows — for peakAt when null', () => {
    renderBug({ count: 0, peak: 0, peakAt: null, namedCount: 0 });
    const bug = screen.getByTestId('broadcast-bug');
    const tip = bug.getAttribute('data-tip') ?? '';
    expect(tip).toContain('—');
  });

  it('anonymous count never goes below zero', () => {
    // namedCount > count (shouldn't happen but guard against it)
    renderBug({ count: 1, peak: 1, peakAt: null, namedCount: 5 });
    const bug = screen.getByTestId('broadcast-bug');
    const tip = bug.getAttribute('data-tip') ?? '';
    expect(tip).toContain('0 anonymous');
  });
});
