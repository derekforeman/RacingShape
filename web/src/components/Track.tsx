import type { RacerStanding } from '../lib/types';
import { Car } from './Car';
import { tip } from '../lib/tooltip';

export function Track({
  standings,
  topScore,
  live,
  reactor,
  displayScoreFor,
  onCheer,
  cheerFxFor,
}: {
  standings: RacerStanding[];
  topScore: number;
  live?: boolean;
  reactor?: string;
  displayScoreFor?: (login: string) => number | undefined;
  onCheer?: (login: string) => void;
  cheerFxFor?: (login: string) => { id: number; label: string }[];
}) {
  const ordered = [...standings].sort((a, b) => a.position - b.position);
  return (
    <div className="relative px-[14px] pb-[6px] pt-[14px]">
      <div
        data-testid="finish-line"
        data-tip={tip(
          'Finish line',
          "Auto-scaled to the day's top score, so the leader sits near the front and the whole pack stays on screen.",
        )}
        className="absolute bottom-0 right-[18px] top-0 z-[3] w-[14px] cursor-help opacity-[.35]"
        style={{
          background: 'repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0/7px 7px',
        }}
      />
      {ordered.map((r) => (
        <div
          key={r.login}
          data-testid="lane"
          className="relative my-[6px] flex h-[46px] items-center rounded-[6px] border-b border-line"
          style={{
            background: 'repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 56px)',
          }}
        >
          <div className="absolute bottom-[6px] left-[8px] top-[6px] w-[3px] bg-muted opacity-40" />
          <Car
            standing={r}
            topScore={topScore}
            live={live}
            reactor={reactor}
            displayScore={displayScoreFor?.(r.login)}
            onCheer={onCheer}
            cheerFx={cheerFxFor?.(r.login)}
          />
        </div>
      ))}
    </div>
  );
}
