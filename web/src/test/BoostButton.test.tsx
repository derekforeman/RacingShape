import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../lib/tooltip';
import { BoostButton } from '../components/BoostButton';
import * as api from '../lib/api';

function renderButton(props: Partial<React.ComponentProps<typeof BoostButton>> = {}) {
  const onBoosted = vi.fn();
  const onClickOptimistic = vi.fn();
  const utils = render(
    <TooltipProvider>
      <BoostButton
        targetLogin="devon-r"
        reactor="tester"
        live={true}
        onClickOptimistic={onClickOptimistic}
        onBoosted={onBoosted}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...utils, onBoosted, onClickOptimistic };
}

describe('BoostButton', () => {
  beforeEach(() => {
    vi.spyOn(api, 'postReaction').mockResolvedValue({
      ok: true,
      reactions: { total: 9, byKind: { '🔥': 6, '⚡': 2, '🏎️': 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic cheer + spark offsets
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a ⚡ control with the cosmetic-only tooltip attribute', () => {
    renderButton();
    const btn = screen.getByRole('button', { name: /boost devon-r/i });
    expect(btn.textContent).toContain('⚡');
    expect(btn.getAttribute('data-tip') ?? '').toMatch(/Cosmetic hype only — never changes score\./);
  });

  it('clicking POSTs a CreateReactionBody and reports the server total via onBoosted', async () => {
    const { onBoosted } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    await waitFor(() => expect(api.postReaction).toHaveBeenCalledTimes(1));
    expect(api.postReaction).toHaveBeenCalledWith({
      targetLogin: 'devon-r',
      kind: '⚡',
      reactor: 'tester',
    });
    await waitFor(() =>
      expect(onBoosted).toHaveBeenCalledWith({ total: 9, byKind: { '🔥': 6, '⚡': 2, '🏎️': 1 } }),
    );
  });

  it('fires onClickOptimistic synchronously on click', async () => {
    const { onClickOptimistic } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    expect(onClickOptimistic).toHaveBeenCalledTimes(1);
  });

  it('floats a friendly cheer affirmation naming the target on click', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    const cheer = await screen.findByTestId('cheer');
    expect(cheer.textContent).toContain('devon-r');
    expect(cheer.textContent).toMatch(/Nice! 🎉|Boosted! ⚡|Send it! 🏎️|Let’s go! 🔥|Respect 🙌|On fire! 🔥/);
  });

  it('sprays a particle burst of five ⚡/🔥/💨 glyphs on click', async () => {
    const { container } = renderButton();
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    const sparks = container.querySelectorAll('[data-testid="spark"]');
    expect(sparks.length).toBe(5);
    expect([...sparks].every((s) => ['⚡', '🔥', '💨'].includes(s.textContent ?? ''))).toBe(true);
  });

  it('is disabled and does not POST when not live (archived/replay)', async () => {
    renderButton({ live: false });
    const btn = screen.getByRole('button', { name: /boost devon-r/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(api.postReaction).not.toHaveBeenCalled();
  });
});
