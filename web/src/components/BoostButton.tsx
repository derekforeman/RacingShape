import { useState, useCallback } from 'react';
import type { ReactionKind, ReactionSummary } from '../lib/types';
import { postReaction } from '../lib/api';
import { tip } from '../lib/tooltip';

/** Friendly affirmations — ported verbatim from the mockup's CHEERS array. */
const CHEERS = ['Nice! 🎉', 'Boosted! ⚡', 'Send it! 🏎️', 'Let’s go! 🔥', 'Respect 🙌', 'On fire! 🔥'];
const SPARK_GLYPHS = ['⚡', '🔥', '💨'] as const;
const BOOST_KIND: ReactionKind = '⚡';

interface Particle {
  id: number;
  glyph: string;
  x: number;
  y: number;
}

export interface BoostButtonProps {
  targetLogin: string;
  reactor: string;
  live: boolean;
  /** Fired synchronously on click for an instant optimistic UI bump. */
  onClickOptimistic?: () => void;
  /** Fired when the POST resolves with the server's authoritative summary. */
  onBoosted?: (reactions: ReactionSummary) => void;
}

export function BoostButton({ targetLogin, reactor, live, onClickOptimistic, onBoosted }: BoostButtonProps) {
  const [sparks, setSparks] = useState<Particle[]>([]);
  const [cheer, setCheer] = useState<{ id: number; text: string } | null>(null);

  const onClick = useCallback(() => {
    if (!live) return;
    onClickOptimistic?.();

    // Particle burst — 5 sparks, glyphs cycling ⚡/🔥/💨, random scatter (mockup parity).
    const base = Date.now();
    const next: Particle[] = [];
    for (let k = 0; k < 5; k++) {
      next.push({
        id: base + k,
        glyph: SPARK_GLYPHS[k % SPARK_GLYPHS.length],
        x: Math.random() * 50 - 25,
        y: -Math.random() * 40 - 10,
      });
    }
    setSparks(next);
    window.setTimeout(() => setSparks([]), 800);

    // Friendly "cheer" affirmation naming the teammate.
    const phrase = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    const cheerId = base;
    setCheer({ id: cheerId, text: `${phrase} ${targetLogin}` });
    window.setTimeout(() => setCheer((c) => (c && c.id === cheerId ? null : c)), 1400);

    // Fire-and-forget POST; reconcile the count with the server's authoritative total.
    void postReaction({ targetLogin, kind: BOOST_KIND, reactor })
      .then((res) => onBoosted?.(res.reactions))
      .catch(() => {
        /* network hiccup: optimistic UI already showed the burst; count reconciles next poll */
      });
  }, [live, targetLogin, reactor, onClickOptimistic, onBoosted]);

  return (
    <>
      <button
        type="button"
        aria-label={`Boost ${targetLogin}`}
        disabled={!live}
        onClick={onClick}
        data-tip={tip('Drop a boost', 'Cosmetic hype only — never changes score.')}
        className="ml-[5px] cursor-pointer border-none bg-transparent p-0 text-[12px] leading-none opacity-[.55] transition-[.15s] hover:scale-[1.3] hover:opacity-100 disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100"
      >
        ⚡
      </button>
      {sparks.map((s) => (
        <span
          key={s.id}
          data-testid="spark"
          className="spark"
          style={{ ['--spark-x' as string]: `${s.x}px`, ['--spark-y' as string]: `${s.y}px`, top: '6px' }}
        >
          {s.glyph}
        </span>
      ))}
      {cheer && (
        <span data-testid="cheer" className="cheer">
          {cheer.text}
        </span>
      )}
    </>
  );
}
