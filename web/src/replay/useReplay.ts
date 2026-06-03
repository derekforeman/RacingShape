import { useCallback, useEffect, useRef, useState } from 'react';
import type { SnapshotFrame } from '../lib/types';

/** A full archived day compresses to ~15s of wall time (roadmap §9, DESIGN §5.4). */
export const REPLAY_DURATION_MS = 15_000;
const TICK_MS = 1000 / 30; // ~30fps stepper

export type ReplayScores = Record<string, number>;

export interface ReplayState {
  playing: boolean;
  speed: number; // 1, 2, 4
  t: number; // 0..1 normalized progress through the day
  play: () => void;
  pause: () => void;
  setSpeed: (s: number) => void;
  scores: ReplayScores; // interpolated per-racer score at time t
}

/** Linear-interpolate every racer's score at normalized time t (0..1) across the frame span. */
function scoresAt(frames: SnapshotFrame[], t: number): ReplayScores {
  if (frames.length === 0) return {};
  if (frames.length === 1 || t <= 0) {
    const f = t <= 0 ? frames[0]! : frames[frames.length - 1]!;
    return Object.fromEntries(f.scores.map((s) => [s.login, s.score]));
  }
  const first = new Date(frames[0]!.capturedAt).getTime();
  const last = new Date(frames[frames.length - 1]!.capturedAt).getTime();
  const span = Math.max(last - first, 1);
  const target = first + t * span;

  // find the bracketing frames
  let lo = frames[0]!;
  let hi = frames[frames.length - 1]!;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = new Date(frames[i]!.capturedAt).getTime();
    const b = new Date(frames[i + 1]!.capturedAt).getTime();
    if (target >= a && target <= b) {
      lo = frames[i]!;
      hi = frames[i + 1]!;
      break;
    }
  }
  const aT = new Date(lo.capturedAt).getTime();
  const bT = new Date(hi.capturedAt).getTime();
  const frac = bT === aT ? 1 : (target - aT) / (bT - aT);

  const loMap = new Map(lo.scores.map((s) => [s.login, s.score]));
  const hiMap = new Map(hi.scores.map((s) => [s.login, s.score]));
  const logins = new Set<string>([...loMap.keys(), ...hiMap.keys()]);
  const out: ReplayScores = {};
  for (const login of logins) {
    const a = loMap.get(login) ?? 0;
    const b = hiMap.get(login) ?? a;
    out[login] = a + (b - a) * frac;
  }
  return out;
}

export function useReplay(frames: SnapshotFrame[]): ReplayState {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const play = useCallback(() => {
    setT((cur) => (cur >= 1 ? 0 : cur)); // restart if at the end
    setPlaying(true);
  }, []);
  const pause = useCallback(() => {
    setPlaying(false);
    clear();
  }, [clear]);

  useEffect(() => {
    if (!playing) {
      clear();
      return;
    }
    timer.current = setInterval(() => {
      setT((cur) => {
        const next = cur + (TICK_MS * speed) / REPLAY_DURATION_MS;
        if (next >= 1) {
          setPlaying(false);
          clear();
          return 1;
        }
        return next;
      });
    }, TICK_MS);
    return clear;
  }, [playing, speed, clear]);

  return { playing, speed, t, play, pause, setSpeed, scores: scoresAt(frames, t) };
}
