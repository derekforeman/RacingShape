import type { ReactionSummary } from '../lib/types';
import { reactionSummaryBody } from '../lib/format';
import { tip } from '../lib/tooltip';

export function ReactionCount({ reactions }: { reactions: ReactionSummary }) {
  return (
    <span
      data-testid="reaction-count"
      data-tip={tip('Pit-stop boosts', reactionSummaryBody(reactions))}
      className="mono cursor-help text-[10px] font-bold text-accent2"
    >
      {reactions.total}🔥
    </span>
  );
}
