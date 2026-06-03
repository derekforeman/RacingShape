import { useEffect } from 'react';
import type { Recap, PodiumStep, ScoreBreakdown } from '../lib/types';
import { breakdownBody } from '../lib/format';
import { tip } from '../lib/tooltip';
import { PodiumAvatar } from './PodiumAvatar';

/** The reveal auto-dismisses so it never sticks on an unattended wall display. */
const AUTO_DISMISS_MS = 8000;
const CONFETTI_COLORS = ['var(--accent)', 'var(--cyan)', 'var(--amber)', 'var(--green)', '#9b5de5'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.3 + 2) % 100,
  delay: (i % 9) * 0.07,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 3) * 2,
}));

/** Visual podium order: silver (P2) · gold (P1, raised) · bronze (P3). */
function visualOrder(podium: PodiumStep[]): PodiumStep[] {
  const byPos = new Map(podium.map((p) => [p.position, p]));
  return [byPos.get(2), byPos.get(1), byPos.get(3)].filter((p): p is PodiumStep => Boolean(p));
}

function pilStyle(position: number): React.CSSProperties {
  const height = position === 1 ? 96 : position === 2 ? 72 : 56;
  return position === 1
    ? { height, borderColor: 'var(--amber)', background: 'linear-gradient(180deg, rgba(255,179,0,.25), var(--panel))' }
    : { height, background: 'linear-gradient(180deg, var(--panel2), var(--panel))' };
}

export interface GrandPrixRevealProps {
  recap: Recap;
  teamTotal: number;
  teamBreakdown: ScoreBreakdown;
  onDismiss: () => void;
  onViewResults: () => void;
}

/**
 * Celebratory in-page "finish-line moment" shown once after a day completes. It dims the
 * dashboard but never hard-locks it — clicking the backdrop, the buttons, Escape, or the
 * 8s timer all dismiss it. Leads with the TEAM total (so it reads as a team win, not a
 * leaderboard callout per the "encouraging, never punitive" rule) before the podium.
 */
export function GrandPrixReveal({ recap, teamTotal, teamBreakdown, onDismiss, onViewResults }: GrandPrixRevealProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  if (recap.podium.length === 0) return null;

  const b = teamBreakdown;
  return (
    <div
      data-testid="grand-prix-reveal"
      role="dialog"
      aria-label="Grand Prix result"
      onClick={onDismiss}
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-[rgba(7,9,13,.78)] p-[16px]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="gp-confetti"
            style={{ left: `${c.left}%`, width: c.size, height: c.size + 4, background: c.color, animationDelay: `${c.delay}s` }}
          />
        ))}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="gp-pop relative w-full max-w-[560px] overflow-hidden rounded-[12px] border border-line bg-panel"
        style={{ borderTop: '4px solid var(--accent)' }}
      >
        <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[18px] py-[14px]">
          <span className="gp-flag text-[20px]">🏁</span>
          <h2 className="font-head text-[16px] font-bold tracking-[2px]">RACE OVER — {recap.raceDate}</h2>
        </div>

        <div data-testid="reveal-team-total" className="px-[18px] pt-[16px] text-center">
          <div className="font-head text-[12px] uppercase tracking-[2px] text-muted">The team shipped</div>
          <div className="mono text-[34px] font-bold leading-none text-ink">
            {teamTotal} <span className="text-[16px] text-muted">PTS</span>
          </div>
          <div className="mono mt-[4px] text-[11px] text-muted">
            {b.commit} commits · {b.pr_merged} merged · {b.pr_opened} PRs opened · {b.issue_closed} issues closed
          </div>
        </div>

        <div className="flex items-end justify-center gap-[14px] px-[18px] pb-[8px] pt-[16px]">
          {visualOrder(recap.podium).map((step) => (
            <div
              key={step.position}
              data-testid={`reveal-podium-${step.position}`}
              className={`text-center ${step.position === 1 ? 'raised' : ''}`}
            >
              <div
                data-tip={tip(`P${step.position} · ${step.login} — ${step.score} pts`, breakdownBody(step.breakdown))}
                className="flex w-[84px] cursor-help items-start justify-center rounded-[6px_6px_0_0] border border-line pt-[10px]"
                style={pilStyle(step.position)}
              >
                <PodiumAvatar login={step.login} avatarUrl={step.avatarUrl} position={step.position} size={44} />
              </div>
              <div className="mt-[7px] font-head text-[14px] font-bold tracking-[1px]">{step.login}</div>
              <div className="mono text-[11px] text-cyan">{step.score} PTS</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-[10px] border-t border-line px-[18px] py-[14px]">
          <button
            type="button"
            data-testid="reveal-view-results"
            onClick={onViewResults}
            className="rounded-[7px] border border-cyan bg-panel2 px-[14px] py-[8px] font-head text-[13px] font-semibold tracking-[1px] text-cyan hover:brightness-110"
          >
            VIEW FULL RESULTS
          </button>
          <button
            type="button"
            data-testid="reveal-dismiss"
            onClick={onDismiss}
            className="rounded-[7px] border border-line bg-panel2 px-[14px] py-[8px] font-head text-[13px] font-semibold tracking-[1px] text-ink hover:border-cyan"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
