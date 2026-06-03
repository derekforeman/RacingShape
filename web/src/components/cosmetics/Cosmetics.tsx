import type { Cosmetic } from '../../lib/types';
import { tip } from '../../lib/tooltip';

const TOOLTIPS: Record<Cosmetic, [string, string]> = {
  flame_trail: ['Flame trail', 'Earned by a streak of 5+ consecutive active days. Cosmetic only.'],
  gold_rims: ['Gold rims', 'Earned for the first merge of the day. Cosmetic only.'],
  rookie_decal: ['Rookie of the Day', 'Earned for being most-improved vs yesterday. Cosmetic only.'],
};

/** A presentational layer painted over the existing pod (mockup pod is 50×22, rounded). */
export function Cosmetics({ cosmetics }: { cosmetics: Cosmetic[] }) {
  const has = (c: Cosmetic) => cosmetics.includes(c);

  return (
    <span
      data-testid="cosmetics-slot"
      data-count={cosmetics.length}
      className="pointer-events-none absolute left-0 top-0 z-[1] h-[22px] w-[50px]"
    >
      {has('flame_trail') && (
        <span
          data-testid="cosmetic-flame_trail"
          data-tip={tip(...TOOLTIPS.flame_trail)}
          className="pointer-events-auto absolute right-full top-1/2 mr-[2px] h-[14px] w-[26px] -translate-y-1/2 cursor-help rounded-[50%_0_0_50%] opacity-[.85]"
          style={{ background: 'linear-gradient(270deg, var(--amber), var(--accent), transparent)' }}
        />
      )}
      {has('gold_rims') && (
        <span
          data-testid="cosmetic-gold_rims"
          data-tip={tip(...TOOLTIPS.gold_rims)}
          className="pointer-events-auto absolute inset-[-2px] cursor-help rounded-[4px_11px_11px_4px] border-2 border-amber"
          style={{ boxShadow: '0 0 8px var(--amber)' }}
        />
      )}
      {has('rookie_decal') && (
        <span
          data-testid="cosmetic-rookie_decal"
          data-tip={tip(...TOOLTIPS.rookie_decal)}
          className="mono pointer-events-auto absolute left-[2px] top-[-7px] cursor-help rounded-[4px] bg-green px-[4px] py-[1px] text-[8px] font-bold tracking-[.5px] text-white"
        >
          ROOKIE
        </span>
      )}
    </span>
  );
}
