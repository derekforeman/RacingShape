import { describe, it, expect, vi, afterEach } from 'vitest';
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
  topMover: false,
  reactions: { total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } },
  cosmetics: [],
};

function renderCar(props: Partial<React.ComponentProps<typeof Car>> = {}) {
  return render(
    <TooltipProvider>
      <Car standing={STANDING} topScore={44} {...props} />
    </TooltipProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Car cheer affordance', () => {
  it('clicking the car pod calls onCheer with the car login', async () => {
    const onCheer = vi.fn();
    renderCar({ onCheer });
    const pod = screen.getByRole('button', { name: /cheer devon-r/i });
    await userEvent.click(pod);
    expect(onCheer).toHaveBeenCalledTimes(1);
    expect(onCheer).toHaveBeenCalledWith('devon-r');
  });

  it('without onCheer the pod is not a button (read-only)', () => {
    renderCar();
    expect(screen.queryByRole('button', { name: /cheer/i })).toBeNull();
    expect(screen.getByTestId('car-pod')).toBeInTheDocument();
  });

  it('renders a cheer bubble with label text + 🙌 when cheerFx has an entry', () => {
    renderCar({ cheerFx: [{ id: 1, label: 'Go go go!' }] });
    const bubble = screen.getByTestId('cheer-bubble');
    expect(bubble).toHaveTextContent('Go go go! 🙌');
  });

  it('renders up to 2 bubbles when multiple cheerFx are present', () => {
    renderCar({
      cheerFx: [
        { id: 1, label: 'Nice!' },
        { id: 2, label: 'Let\'s go!' },
        { id: 3, label: 'Keep it up!' },
      ],
    });
    // Only the last 2 are shown to avoid overlap
    const bubbles = screen.getAllByTestId('cheer-bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0]).toHaveTextContent('Let\'s go! 🙌');
    expect(bubbles[1]).toHaveTextContent('Keep it up! 🙌');
  });

  it('renders no cheer bubbles when cheerFx is empty', () => {
    renderCar({ cheerFx: [] });
    expect(screen.queryByTestId('cheer-bubble')).toBeNull();
  });

  it('cheering does not trigger a boost (postReaction is not called)', async () => {
    vi.spyOn(api, 'postReaction');
    const onCheer = vi.fn();
    renderCar({ onCheer, live: true, reactor: 'tester' });
    await userEvent.click(screen.getByRole('button', { name: /cheer devon-r/i }));
    expect(api.postReaction).not.toHaveBeenCalled();
    expect(onCheer).toHaveBeenCalledWith('devon-r');
  });

  it('the boost ⚡ button still works independently of cheering', async () => {
    vi.spyOn(api, 'postReaction').mockResolvedValue({
      ok: true,
      reactions: { total: 8, byKind: { '🔥': 4, '⚡': 3, '🏎️': 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onCheer = vi.fn();
    renderCar({ onCheer, live: true, reactor: 'tester' });

    // Click the boost button
    await userEvent.click(screen.getByRole('button', { name: /boost devon-r/i }));
    expect(api.postReaction).toHaveBeenCalledTimes(1);
    // onCheer should NOT have been called by the boost
    expect(onCheer).not.toHaveBeenCalled();
  });
});
