import { useCallback, useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from './lib/tooltip';
import { usePolling } from './lib/usePolling';
import { getRaceToday, getStats, getRaces, getArchive } from './lib/api';
import type {
  RaceArchive,
  RaceListItem,
  RaceToday,
  RacerStanding,
  StatsResponse,
  Cosmetic,
  Recap as RecapData,
  ScoreBreakdown,
} from './lib/types';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { TelemetryChart } from './components/TelemetryChart';
import { PitWall } from './components/PitWall';
import { Recap } from './components/Recap';
import { GrandPrixReveal } from './components/GrandPrixReveal';
import { useReplay } from './replay/useReplay';
import { exportNodeToPng } from './lib/exportPng';

const POLL_MS = 60_000;
const REACTOR = 'you'; // free-text handle for v1 (PRD §5.7)
const REVEAL_SEEN_KEY = 'racingshape-recap-seen';

interface RevealState {
  date: string;
  recap: RecapData;
  teamTotal: number;
  teamBreakdown: ScoreBreakdown;
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const [races, setRaces] = useState<RaceListItem[]>([]);
  const [archive, setArchive] = useState<RaceArchive | null>(null);
  const [seenRecap, setSeenRecap] = useState<string | null>(() => {
    try {
      return localStorage.getItem(REVEAL_SEEN_KEY);
    } catch {
      return null;
    }
  });
  const [reveal, setReveal] = useState<RevealState | null>(null);
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

  // One-time celebratory reveal when a newly-completed day is available (the most recent
  // archived date the viewer hasn't seen yet). Shown only on the live view.
  useEffect(() => {
    const latest = races[0]?.raceDate;
    if (!latest || latest === seenRecap) {
      setReveal(null);
      return;
    }
    let cancelled = false;
    void getArchive(latest)
      .then((a) => {
        if (cancelled || a.recap.podium.length === 0) return;
        const teamTotal = a.standings.reduce((n, s) => n + s.score, 0);
        const teamBreakdown = a.standings.reduce<ScoreBreakdown>(
          (acc, s) => ({
            commit: acc.commit + s.breakdown.commit,
            pr_opened: acc.pr_opened + s.breakdown.pr_opened,
            pr_merged: acc.pr_merged + s.breakdown.pr_merged,
            issue_closed: acc.issue_closed + s.breakdown.issue_closed,
          }),
          { commit: 0, pr_opened: 0, pr_merged: 0, issue_closed: 0 },
        );
        setReveal({ date: latest, recap: a.recap, teamTotal, teamBreakdown });
      })
      .catch(() => {
        /* reveal is non-critical; ignore fetch errors */
      });
    return () => {
      cancelled = true;
    };
  }, [races, seenRecap]);

  const markRecapSeen = useCallback((date: string) => {
    try {
      localStorage.setItem(REVEAL_SEEN_KEY, date);
    } catch {
      /* ignore storage errors */
    }
    setSeenRecap(date);
    setReveal(null);
  }, []);

  const dismissReveal = useCallback(() => {
    if (reveal) markRecapSeen(reveal.date);
  }, [reveal, markRecapSeen]);

  const viewRevealResults = useCallback(() => {
    if (reveal) {
      setSelectedDate(reveal.date);
      markRecapSeen(reveal.date);
    }
  }, [reveal, markRecapSeen]);

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

        {isLive && reveal && (
          <GrandPrixReveal
            recap={reveal.recap}
            teamTotal={reveal.teamTotal}
            teamBreakdown={reveal.teamBreakdown}
            onDismiss={dismissReveal}
            onViewResults={viewRevealResults}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
