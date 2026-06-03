import type { Cosmetic } from '../../lib/types';

/**
 * PLAN 04 fills this in (flame_trail, gold_rims, rookie_decal sprite/CSS layer).
 * For plan 03 it is intentionally inert so the seam exists and Car can import it.
 */
export function Cosmetics({ cosmetics }: { cosmetics: Cosmetic[] }) {
  return <span data-testid="cosmetics-slot" data-count={cosmetics.length} hidden />;
}
