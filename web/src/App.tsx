import { useCallback } from 'react';
import { TooltipProvider } from './lib/tooltip';
import { usePolling } from './lib/usePolling';
import { getRaceToday, getStats } from './lib/api';
import type { RaceToday, StatsResponse } from './lib/types';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { TelemetryChart } from './components/TelemetryChart';
import { PitWall } from './components/PitWall';

const POLL_MS = 60_000;

export default function App() {
  const fetchRace = useCallback(() => getRaceToday(), []);
  const fetchStats = useCallback(() => getStats('14d'), []);

  const race = usePolling<RaceToday>(fetchRace, POLL_MS, []);
  const stats = usePolling<StatsResponse>(fetchStats, POLL_MS, []);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1320px]">
        <Header />

        <div className="mt-[16px] grid grid-cols-[1fr_310px] gap-[16px] max-[940px]:grid-cols-1">
          <div>
            {race.error ? (
              <div
                data-testid="race-error"
                className="rounded-[10px] border border-line bg-panel px-[20px] py-[40px] text-center font-head tracking-[1px] text-accent2"
              >
                Lost the telemetry feed. Retrying on the next poll…
              </div>
            ) : race.data ? (
              <RaceControl standings={race.data.standings} topScore={race.data.topScore} />
            ) : (
              <div
                data-testid="race-loading"
                className="rounded-[10px] border border-line bg-panel px-[20px] py-[40px] text-center font-head tracking-[1px] text-muted"
              >
                Warming up the grid…
              </div>
            )}

            <div className="mt-[16px]">{stats.data && <TelemetryChart stats={stats.data} />}</div>
          </div>

          {stats.data && <PitWall stats={stats.data} />}
        </div>

        {/* PLAN 04: <Recap /> mounts here for completed/archived days. */}
        {/* <Recap raceDate={...} /> */}
      </div>
    </TooltipProvider>
  );
}
