import type { RacerStanding } from '../lib/types';
import { TimingTower } from './TimingTower';
import { Track } from './Track';
import { tip } from '../lib/tooltip';

export function RaceControl({
  standings,
  topScore,
  live,
  reactor,
  displayScoreFor,
}: {
  standings: RacerStanding[];
  topScore: number;
  live?: boolean;
  reactor?: string;
  displayScoreFor?: (login: string) => number | undefined;
}) {
  const empty = standings.length === 0;

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">🏎️</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">RACE CONTROL — TODAY</h2>
        <span
          data-testid="lap-badge"
          data-tip={tip(
            'Race window',
            '00:00:00 → 23:59:59 America/New_York. Resets at midnight; prior day is archived.',
          )}
          className="mono ml-auto cursor-help rounded-[5px] border border-accent px-[8px] py-[3px] text-[10px] tracking-[1px] text-accent"
        >
          LAP: LIVE
        </span>
      </div>

      {empty ? (
        <div
          data-testid="empty-state"
          className="px-[20px] py-[40px] text-center font-head text-[15px] tracking-[1px] text-muted"
        >
          The grid is set — no laps yet today.
          <br />
          The first commit of the day takes pole. 🏁
        </div>
      ) : (
        <div className="grid grid-cols-[230px_1fr] max-[640px]:grid-cols-1">
          <TimingTower standings={standings} />
          <Track
            standings={standings}
            topScore={topScore}
            live={live}
            reactor={reactor}
            displayScoreFor={displayScoreFor}
          />
        </div>
      )}
    </div>
  );
}
