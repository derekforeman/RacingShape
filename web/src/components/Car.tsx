import { useState, useEffect } from 'react';
import type { RacerStanding, ReactionSummary } from '../lib/types';
import { standingTip } from '../lib/format';
import { colorFor, initialsFor } from './TimingTower';
import { Cosmetics } from './cosmetics/Cosmetics';
import { ReactionCount } from './ReactionCount';
import { BoostButton } from './BoostButton';
import { tip } from '../lib/tooltip';

/** Canonical auto-scale (roadmap §10): leader ~82%, empty idles at 2%, no /0. */
export function carPct(score: number, topScore: number): number {
  return 2 + (score / Math.max(topScore, 1)) * 80;
}

export function Car({
  standing,
  topScore,
  live,
  reactor,
  displayScore,
}: {
  standing: RacerStanding;
  topScore: number;
  /** When true the boost button is enabled; false = archived read-only; undefined = no boost button. */
  live?: boolean;
  reactor?: string;
  /** Replay/archived: overrides the standing score for car positioning (interpolated). */
  displayScore?: number;
}) {
  const [avatarBroken, setAvatarBroken] = useState(false);
  const color = colorFor(standing.login);
  const initials = initialsFor(standing.login);
  const left = `${carPct(displayScore ?? standing.score, topScore)}%`;
  const podTip = standingTip(standing);

  // Optimistic reaction summary, re-synced whenever the server-supplied standing changes.
  const [reactions, setReactions] = useState<ReactionSummary>(standing.reactions);
  useEffect(() => setReactions(standing.reactions), [standing.reactions]);

  const bumpLocal = () =>
    setReactions((r) => ({
      total: r.total + 1,
      byKind: { ...r.byKind, '⚡': r.byKind['⚡'] + 1 },
    }));

  return (
    <div
      data-testid="car"
      className={`car absolute z-[2] flex items-center gap-[8px]${standing.isLeader ? ' lead' : ''}`}
      style={{ left, transition: 'left 1s cubic-bezier(.4,.8,.3,1)' }}
    >
      {standing.topMover && (
        <span
          data-testid="drs-tag"
          data-tip={tip('DRS — top mover', 'Gained the most points on the latest 60s poll.')}
          className="mono absolute left-0 top-[-8px] cursor-help text-[8px] tracking-[1px] text-amber"
        >
          ▮ DRS
        </span>
      )}

      <Cosmetics cosmetics={standing.cosmetics} />

      <div
        data-testid="car-pod"
        data-tip={podTip}
        className="relative flex h-[22px] w-[50px] cursor-help items-center rounded-[4px_11px_11px_4px] pl-[5px] shadow-[0_2px_6px_rgba(0,0,0,.4)]"
        style={{ background: color }}
      >
        <span className="mono text-[11px] font-bold text-white">{initials}</span>
      </div>

      <div className="flex items-center gap-[7px]">
        {!avatarBroken ? (
          <img
            data-testid="car-avatar"
            src={standing.avatarUrl}
            alt={standing.login}
            onError={() => setAvatarBroken(true)}
            className="h-[24px] w-[24px] rounded-full border-2 object-cover"
            style={{ borderColor: standing.isLeader ? 'var(--amber)' : color }}
          />
        ) : (
          <span
            data-testid="car-avatar-fallback"
            className="grid h-[24px] w-[24px] place-items-center rounded-full border-2 text-[10px] font-bold text-white"
            style={{ borderColor: standing.isLeader ? 'var(--amber)' : color }}
          >
            {initials}
          </span>
        )}

        <span
          data-tip={podTip}
          className="clabel mono relative flex cursor-help items-center gap-[5px] whitespace-nowrap rounded-[5px] border border-line bg-panel2 px-[7px] py-[1px] font-head text-[12px] font-semibold tracking-[.5px]"
        >
          {standing.login}
          <span className="ml-[5px] inline-flex items-center gap-[4px]">
            <ReactionCount reactions={reactions} />
            {live !== undefined && (
              <BoostButton
                targetLogin={standing.login}
                reactor={reactor ?? 'you'}
                live={live}
                onClickOptimistic={bumpLocal}
                onBoosted={(s) => setReactions(s)}
              />
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
