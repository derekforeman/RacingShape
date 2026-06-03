import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider, tip } from '../lib/tooltip';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

describe('tooltip engine', () => {
  it('tip() builds the HEADER||body convention string', () => {
    expect(tip('Live race', 'Polling every 60s.')).toBe('Live race||Polling every 60s.');
  });

  it('shows header and body on hover over a [data-tip] element', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <button data-tip={tip('LEADER', 'devon-r leads')}>hover me</button>
      </TooltipProvider>,
    );
    fireEvent.mouseOver(screen.getByText('hover me'), { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('tooltip')).toHaveClass('show');
    expect(screen.getByTestId('tooltip-header')).toHaveTextContent('LEADER');
    expect(screen.getByTestId('tooltip-body')).toHaveTextContent('devon-r leads');
  });

  it('renders header-only when there is no body separator', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <span data-tip="Just a label">x</span>
      </TooltipProvider>,
    );
    fireEvent.mouseOver(screen.getByText('x'), { clientX: 50, clientY: 50 });
    expect(screen.getByTestId('tooltip-body')).toHaveTextContent('Just a label');
    expect(screen.getByTestId('tooltip-header')).not.toBeVisible();
  });

  it('hides on mouseout', () => {
    setViewport(1000, 800);
    render(
      <TooltipProvider>
        <span data-tip="Hi||there">x</span>
      </TooltipProvider>,
    );
    const target = screen.getByText('x');
    fireEvent.mouseOver(target, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId('tooltip')).toHaveClass('show');
    fireEvent.mouseOut(target, { relatedTarget: document.body });
    expect(screen.getByTestId('tooltip')).not.toHaveClass('show');
  });

  it('flips left/up near the right and bottom edges', () => {
    setViewport(300, 300);
    render(
      <TooltipProvider>
        <span data-tip="Edge||case">x</span>
      </TooltipProvider>,
    );
    const target = screen.getByText('x');
    fireEvent.mouseOver(target, { clientX: 295, clientY: 295 });
    const tipEl = screen.getByTestId('tooltip');
    expect(parseInt(tipEl.style.left, 10)).toBeLessThan(295);
    expect(parseInt(tipEl.style.top, 10)).toBeLessThan(295);
  });

  it('the tooltip card never blocks clicks (pointer-events: none)', () => {
    render(
      <TooltipProvider>
        <span data-tip="Hi||there">x</span>
      </TooltipProvider>,
    );
    expect(screen.getByTestId('tooltip')).toHaveStyle({ pointerEvents: 'none' });
  });
});
