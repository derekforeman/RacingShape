import type { RaceListItem } from '../lib/types';
import { tip } from '../lib/tooltip';

export interface DateSelectorProps {
  races: RaceListItem[];
  /** "today" for the live day, or a YYYY-MM-DD archived date. */
  selected: string;
  onSelect: (value: string) => void;
}

export function DateSelector({ races, selected, onSelect }: DateSelectorProps) {
  return (
    <select
      data-testid="date-selector"
      aria-label="Race day"
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      data-tip={tip(
        'Race day',
        "Switch between today's live race and any archived day. Archived days replay as a ~15s fast-forward.",
      )}
      className="cursor-pointer appearance-none rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink hover:border-cyan"
    >
      <option value="today">TODAY · LIVE</option>
      {races.map((r) => (
        <option key={r.raceDate} value={r.raceDate}>
          {r.raceDate}
        </option>
      ))}
    </select>
  );
}
