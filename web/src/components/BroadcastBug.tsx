import { tip } from '../lib/tooltip';

interface Props {
  count: number;
  peak: number;
  peakAt: string | null;
  namedCount: number;
}

export function BroadcastBug({ count, peak, peakAt, namedCount }: Props) {
  const anon = Math.max(0, count - namedCount);
  const peakTime = peakAt
    ? new Date(peakAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—';
  return (
    <div
      data-testid="broadcast-bug"
      className="flex cursor-help items-center gap-[7px] rounded-[7px] border border-cyan bg-cyan/10 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-cyan"
      data-tip={tip(
        'Spectators',
        `${count} watching now · peak ${peak} at ${peakTime}\n${namedCount} named, ${anon} anonymous`,
      )}
    >
      <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-cyan" />
      {count} WATCHING · PEAK {peak}
    </div>
  );
}
