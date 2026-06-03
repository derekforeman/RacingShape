import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { ReplayControls } from '../components/ReplayControls';

function setup(over: Partial<React.ComponentProps<typeof ReplayControls>> = {}) {
  const props = {
    enabled: true,
    playing: false,
    speed: 1,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSpeed: vi.fn(),
    ...over,
  };
  render(
    <TooltipProvider>
      <ReplayControls {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe('ReplayControls', () => {
  it('is disabled when not an archived day', () => {
    setup({ enabled: false });
    expect(screen.getByRole('button', { name: /replay/i })).toBeDisabled();
  });

  it('calls onPlay when paused and the button is clicked', async () => {
    const props = setup({ enabled: true, playing: false });
    await userEvent.click(screen.getByRole('button', { name: /replay/i }));
    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });

  it('shows pause and calls onPause while playing', async () => {
    const props = setup({ enabled: true, playing: true });
    const btn = screen.getByRole('button', { name: /pause|replay/i });
    expect(btn.textContent).toMatch(/❚❚|PAUSE/i);
    await userEvent.click(btn);
    expect(props.onPause).toHaveBeenCalledTimes(1);
  });

  it('cycles speed 1x → 2x', async () => {
    const props = setup({ enabled: true, speed: 1 });
    await userEvent.click(screen.getByRole('button', { name: /speed/i }));
    expect(props.onSpeed).toHaveBeenCalledWith(2);
  });

  it('disables the speed control too when not enabled', () => {
    setup({ enabled: false });
    expect(screen.getByRole('button', { name: /speed/i })).toBeDisabled();
  });
});
