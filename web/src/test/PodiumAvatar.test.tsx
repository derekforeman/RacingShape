import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PodiumAvatar } from '../components/PodiumAvatar';

describe('PodiumAvatar', () => {
  it('renders the GitHub avatar image when a url is present', () => {
    render(<PodiumAvatar login="devon-r" avatarUrl="https://x/d.png" position={1} />);
    const img = screen.getByTestId('podium-avatar') as HTMLImageElement;
    expect(img).toHaveAttribute('src', 'https://x/d.png');
    expect(img).toHaveAttribute('alt', 'devon-r');
  });

  it('falls back to a colored initials tile when there is no avatar url', () => {
    render(<PodiumAvatar login="mira-k" avatarUrl="" position={2} />);
    expect(screen.queryByTestId('podium-avatar')).toBeNull();
    expect(screen.getByTestId('podium-avatar-fallback')).toHaveTextContent('MK');
  });

  it('falls back to initials when the image fails to load', () => {
    render(<PodiumAvatar login="sasha-p" avatarUrl="https://x/s.png" position={3} />);
    fireEvent.error(screen.getByTestId('podium-avatar'));
    expect(screen.getByTestId('podium-avatar-fallback')).toHaveTextContent('SP');
  });
});
