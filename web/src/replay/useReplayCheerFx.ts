import { useEffect, useRef, useState } from 'react';
import type { ArchivedReaction, SnapshotFrame } from '../lib/types';
import type { CheerFx } from '../lib/useSpectators';

const BUBBLE_DURATION_MS = 1600;

/**
 * Fires transient CheerFx bubbles for source:'cheer' archived reactions as the
 * replay playhead (t, 0..1) crosses each reaction's createdAt timestamp.
 *
 * source:'boost' reactions are ignored here — they follow the existing boost path.
 * Call from App when isLive===false and frames.length>=2.
 */
export function useReplayCheerFx(
  t: number,
  frames: SnapshotFrame[],
  reactions: ArchivedReaction[],
  enabled: boolean,
): CheerFx[] {
  const [cheerFx, setCheerFx] = useState<CheerFx[]>([]);
  const fxId = useRef(0);
  const prevT = useRef<number>(0);

  // Reset when disabled (day switch / back to live)
  useEffect(() => {
    if (!enabled) {
      setCheerFx([]);
      prevT.current = 0;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || frames.length < 2 || reactions.length === 0) {
      prevT.current = t;
      return;
    }

    const cheers = reactions.filter((r) => r.source === 'cheer');
    if (cheers.length === 0) {
      prevT.current = t;
      return;
    }

    const first = new Date(frames[0]!.capturedAt).getTime();
    const last = new Date(frames[frames.length - 1]!.capturedAt).getTime();
    const span = Math.max(last - first, 1);

    const lo = prevT.current;
    const hi = t;
    prevT.current = hi;

    // If t moved backwards (replay restart), skip — will catch up naturally next tick
    if (hi < lo) return;

    const fired: CheerFx[] = [];
    for (const rxn of cheers) {
      const rT = (new Date(rxn.createdAt).getTime() - first) / span;
      if (rT > lo && rT <= hi) {
        const id = ++fxId.current;
        fired.push({ id, targetLogin: rxn.targetLogin, label: rxn.reactor });
      }
    }
    if (fired.length === 0) return;

    setCheerFx((prev) => [...prev, ...fired]);
    const timers = fired.map((fx) =>
      setTimeout(() => setCheerFx((prev) => prev.filter((f) => f.id !== fx.id)), BUBBLE_DURATION_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [t, enabled, frames, reactions]);

  return cheerFx;
}
