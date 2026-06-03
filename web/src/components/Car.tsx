import { useState } from 'react';
import type { RacerStanding } from '../lib/types';
import { standingTip } from '../lib/format';
import { tip } from '../lib/tooltip';
import { colorFor, initialsFor } from './TimingTower';
import { Cosmetics } from './cosmetics/Cosmetics';

/** Canonical auto-scale (roadmap §10): leader ~82%, empty idles at 2%, no /0. */
export function carPct(score: number, topScore: number): number {
  return 2 + (score / Math.max(topScore, 1)) * 80;
}

function reactionTip(s: RacerStanding): string {
  const k = s.reactions.byKind;
  return tip(
    'Pit-stop boosts',
    `${s.reactions.total} cosmetic reactions from teammates · 🔥${k['🔥']} ⚡${k['⚡']} 🏎️${k['🏎️']}. Never affects score.`,
  );
}

export function Car({ standing, topScore }: { standing: RacerStanding; topScore: number }) {
  const [avatarBroken, setAvatarBroken] = useState(false);
  const color = colorFor(standing.login);
  const initials = initialsFor(standing.login);
  const left = `${carPct(standing.score, topScore)}%`;
  const podTip = standingTip(standing);

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
          className="clabel mono flex cursor-help items-center gap-[5px] whitespace-nowrap rounded-[5px] border border-line bg-panel2 px-[7px] py-[1px] font-head text-[12px] font-semibold tracking-[.5px]"
        >
          {standing.login}
          <span
            data-testid="reaction-count"
            data-tip={reactionTip(standing)}
            className="mono cursor-help text-[10px] font-bold text-accent2"
          >
            {standing.reactions.total}🔥
          </span>
        </span>
      </div>
    </div>
  );
}
