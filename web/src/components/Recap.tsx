import type { Recap as RecapType, PodiumStep, Superlative, Cosmetic } from '../lib/types';
import { breakdownBody } from '../lib/format';
import { tip } from '../lib/tooltip';
import { PodiumAvatar } from './PodiumAvatar';

const SUPER_EMOJI: Record<Superlative['key'], string> = {
  fastest_hour: '⚡',
  comeback: '📈',
  midnight_grinder: '🌙',
};
const SUPER_DEF: Record<Superlative['key'], string> = {
  fastest_hour: 'Most points scored in any single 60-min window of the day.',
  comeback: 'Biggest climb in standings during the second half of the day.',
  midnight_grinder: 'Latest tracked activity before the day closed.',
};
const COSMETIC_LABEL: Record<Cosmetic, string> = {
  flame_trail: 'Flame trail',
  gold_rims: 'Gold rims',
  rookie_decal: 'Rookie of the Day',
};

/** Visual podium order: silver (P2) · gold (P1, raised) · bronze (P3) — mockup layout. */
function visualOrder(podium: PodiumStep[]): PodiumStep[] {
  const byPos = new Map(podium.map((p) => [p.position, p]));
  return [byPos.get(2), byPos.get(1), byPos.get(3)].filter((p): p is PodiumStep => Boolean(p));
}

/** Mockup .pil heights: P1 104, P2 78, P3 58. P1 gets the amber tint/border. */
function pilStyle(position: number): React.CSSProperties {
  const height = position === 1 ? 104 : position === 2 ? 78 : 58;
  return position === 1
    ? { height, borderColor: 'var(--amber)', background: 'linear-gradient(180deg, rgba(255,179,0,.25), var(--panel))' }
    : { height, background: 'linear-gradient(180deg, var(--panel2), var(--panel))' };
}

function podiumTip(step: PodiumStep): string {
  return tip(`P${step.position} · ${step.login} — ${step.score} pts`, breakdownBody(step.breakdown));
}

export interface RecapProps {
  recap: RecapType;
  cosmeticsByLogin: Record<string, Cosmetic[]>;
  onExportPng: () => void;
  replayLink: string;
}

export function Recap({ recap, cosmeticsByLogin, onExportPng, replayLink }: RecapProps) {
  if (!recap.podium || recap.podium.length === 0) return null;

  const earned = Object.entries(cosmeticsByLogin).flatMap(([login, cs]) =>
    cs.map((c) => ({ login, c })),
  );

  return (
    <div
      data-testid="recap-card"
      id="recap-card"
      className="mt-[16px] overflow-hidden rounded-[10px] border border-line bg-panel"
      style={{ borderTop: '4px solid var(--accent)' }}
    >
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">🏆</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">GRAND PRIX RESULT — {recap.raceDate}</h2>
        <div className="ml-auto flex items-center gap-[9px]">
          <span
            data-tip={tip('Recap', "Auto-generated at midnight from the day's archive snapshot.")}
            className="mono cursor-help rounded-[5px] border border-amber px-[8px] py-[3px] text-[10px] tracking-[1px] text-amber"
          >
            PODIUM
          </span>
          <button
            type="button"
            data-testid="export-png"
            onClick={onExportPng}
            data-tip={tip('Export PNG', 'Render this recap card to a share-ready PNG.')}
            className="rounded-[7px] border border-line bg-panel2 px-[10px] py-[6px] font-head text-[12px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
          >
            ⬇ EXPORT PNG
          </button>
          <button
            type="button"
            data-testid="copy-replay-link"
            onClick={() => void navigator.clipboard?.writeText(replayLink)}
            data-tip={tip('Replay link', "Copy a link to this day's ~15s replay.")}
            className="rounded-[7px] border border-line bg-panel2 px-[10px] py-[6px] font-head text-[12px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
          >
            🔗 REPLAY LINK
          </button>
        </div>
      </div>

      <div className="flex items-end justify-center gap-[14px] px-[16px] pb-[10px] pt-[20px]">
        {visualOrder(recap.podium).map((step) => (
          <div
            key={step.position}
            data-testid={`podium-step-${step.position}`}
            className={`text-center ${step.position === 1 ? 'raised' : ''}`}
          >
            <div
              data-testid={`podium-pil-${step.position}`}
              data-tip={podiumTip(step)}
              className="flex w-[78px] cursor-help items-start justify-center rounded-[6px_6px_0_0] border border-line pt-[10px]"
              style={pilStyle(step.position)}
            >
              <PodiumAvatar login={step.login} avatarUrl={step.avatarUrl} position={step.position} size={40} />
            </div>
            <div className="mt-[7px] font-head text-[14px] font-bold tracking-[1px]">{step.login}</div>
            <div className="mono text-[11px] text-cyan">{step.score} PTS</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line">
        {recap.superlatives.map((s) => (
          <div
            key={s.key}
            data-testid={`super-${s.key}`}
            data-tip={tip(s.title, SUPER_DEF[s.key])}
            className="cursor-help bg-panel px-[14px] py-[13px]"
          >
            <div className="font-head text-[10px] font-bold uppercase tracking-[1px] text-amber">
              {SUPER_EMOJI[s.key]} {s.title}
            </div>
            <div className="mono mt-[4px] text-[15px] font-bold">{s.login ?? '—'}</div>
            <div className="text-[11px] text-muted">{s.detail}</div>
          </div>
        ))}
      </div>

      {earned.length > 0 && (
        <div
          data-testid="recap-cosmetics"
          className="flex flex-wrap gap-[8px] border-t border-line px-[16px] py-[12px] font-head text-[11px] font-semibold tracking-[.5px] text-muted"
        >
          <span>Cosmetics earned:</span>
          {earned.map(({ login, c }) => (
            <span key={`${login}-${c}`} className="rounded-[20px] border border-line px-[9px] py-[3px] text-ink">
              {login} · {COSMETIC_LABEL[c]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
