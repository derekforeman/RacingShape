import { useState } from 'react';
import { colorFor, initialsFor } from './TimingTower';

const MEDAL: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

/**
 * The driver's GitHub avatar for the end-of-day podium presentation, ringed (gold for P1)
 * with a medal badge. Falls back to a colored initials tile when there's no avatar image
 * or it fails to load (matches the Car treatment).
 */
export function PodiumAvatar({
  login,
  avatarUrl,
  position,
  size = 40,
}: {
  login: string;
  avatarUrl: string;
  position: number;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const ring = position === 1 ? 'var(--amber)' : 'var(--line)';
  const glow = position === 1 ? '0 0 10px var(--amber)' : undefined;
  const showImage = avatarUrl !== '' && !broken;

  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          data-testid="podium-avatar"
          src={avatarUrl}
          alt={login}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full border-2 object-cover"
          style={{ borderColor: ring, boxShadow: glow }}
        />
      ) : (
        <span
          data-testid="podium-avatar-fallback"
          className="mono grid h-full w-full place-items-center rounded-full border-2 text-[12px] font-bold text-white"
          style={{ borderColor: ring, background: colorFor(login), boxShadow: glow }}
        >
          {initialsFor(login)}
        </span>
      )}
      <span className="absolute -bottom-[4px] -right-[4px] text-[15px] leading-none" aria-hidden>
        {MEDAL[position]}
      </span>
    </span>
  );
}
