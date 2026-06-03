import { useCallback, useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from './lib/tooltip';
import { usePolling } from './lib/usePolling';
import { getRaceToday, getStats, getRaces, getArchive } from './lib/api';
import type { RaceArchive, RaceListItem, RaceToday, RacerStanding, StatsResponse, Cosmetic } from './lib/types';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { TelemetryChart } from './components/TelemetryChart';
import { PitWall } from './components/PitWall';
import { Recap } from './components/Recap';
import { useReplay } from './replay/useReplay';
import { exportNodeToPng } from './lib/exportPng';

const POLL_MS = 60_000;
const REACTOR = 'you'; // free-text handle for v1 (PRD §5.7)

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const [races, setRaces] = useState<RaceListItem[]>([]);
  const [archive, setArchive] = useState<RaceArchive | null>(null);
  const isLive = selectedDate === 'today';

  // available archived days
  useEffect(() => {
    void getRaces()
      .then(setRaces)
      .catch(() => setRaces([]));
  }, []);

  // live polling (always running; we just ignore its output off the live day)
  const today = usePolling<RaceToday>(() => getRaceToday(), POLL_MS, []);
  const stats = usePolling<StatsResponse>(() => getStats('14d'), POLL_MS, []);

  // fetch the archive when a past day is selected
  useEffect(() => {
    if (isLive) {
      setArchive(null);
      return;
    }
    let cancelled = false;
    void getArchive(selectedDate).then((a) => {
      if (!cancelled) setArchive(a);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isLive]);

  // replay engine over the archive frames (empty when live)
  const frames = useMemo(() => archive?.frames ?? [], [archive]);
  const replay = useReplay(frames);

  // which standings + per-racer display score to render
  const standings: RacerStanding[] = isLive ? today.data?.standings ?? [] : archive?.standings ?? [];
  const topScore = isLive ? today.data?.topScore ?? 1 : archive?.topScore ?? 1;
  const displayScoreFor = useCallback(
    (login: string): number | undefined => (isLive ? undefined : replay.scores[login] ?? 0),
    [isLive, replay.scores],
  );

  // cosmetics earned that day, for the recap card
  const cosmeticsByLogin: Record<string, Cosmetic[]> = useMemo(() => {
    const src = isLive ? [] : archive?.standings ?? [];
    return Object.fromEntries(src.filter((s) => s.cosmetics.length > 0).map((s) => [s.login, s.cosmetics]));
  }, [isLive, archive]);

  const onExportPng = useCallback(() => {
    void exportNodeToPng(document.getElementById('recap-card'), `racingshape-${selectedDate}.png`);
  }, [selectedDate]);
  const replayLink = `${window.location.origin}/race/${selectedDate}`;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1320px]">
        <Header
          live={isLive}
          races={races}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          replay={{
            enabled: !isLive && frames.length > 0,
            playing: replay.playing,
            speed: replay.speed,
            onPlay: replay.play,
            onPause: replay.pause,
            onSpeed: replay.setSpeed,
          }}
        />

        <div className="mt-[16px] grid grid-cols-[1fr_310px] gap-[16px] max-[940px]:grid-cols-1">
          <div>
            <RaceControl
              standings={standings}
              topScore={topScore}
              live={isLive}
              reactor={REACTOR}
              displayScoreFor={displayScoreFor}
            />
            <div className="mt-[16px]">{stats.data && <TelemetryChart stats={stats.data} />}</div>
            {!isLive && archive && (
              <Recap
                recap={archive.recap}
                cosmeticsByLogin={cosmeticsByLogin}
                onExportPng={onExportPng}
                replayLink={replayLink}
              />
            )}
          </div>
          {stats.data && <PitWall stats={stats.data} />}
        </div>
      </div>
    </TooltipProvider>
  );
}
