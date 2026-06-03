import type { RaceListItem } from '../lib/types';
import { tip } from '../lib/tooltip';
import { useTheme } from '../lib/useTheme';
import { DateSelector } from './DateSelector';
import { ReplayControls } from './ReplayControls';

export interface HeaderProps {
  live: boolean;
  races: RaceListItem[];
  selectedDate: string;
  onSelectDate: (value: string) => void;
  replay: {
    enabled: boolean;
    playing: boolean;
    speed: number;
    onPlay: () => void;
    onPause: () => void;
    onSpeed: (s: number) => void;
  };
}

export function Header({ live, races, selectedDate, onSelectDate, replay }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-line border-l-[5px] border-l-accent bg-gradient-to-r from-panel to-panel2 px-[18px] py-[14px]">
      <div className="flex items-center gap-[13px]">
        <div className="grid h-[46px] w-[46px] place-items-center rounded-[9px] bg-accent text-[24px] shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset]">
          🏁
        </div>
        <div>
          <h1 className="font-head text-[24px] font-bold leading-none tracking-[3px]">RACINGSHAPE</h1>
          <div className="mono mt-[3px] text-[10px] tracking-[2px] text-muted">
            SHIP CODE · RACE CARS · WIN THE DAY
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap items-center gap-[9px]">
        {live && (
          <div
            data-testid="live-chip"
            data-tip={tip(
              'Live race',
              'Polling GitHub every 60s. Scores recompute and cars animate to new positions on each poll.',
            )}
            className="flex cursor-help items-center gap-[7px] rounded-[7px] border border-accent bg-accent px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-white"
          >
            <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-white" />
            LIVE
          </div>
        )}

        <DateSelector races={races} selected={selectedDate} onSelect={onSelectDate} />
        <ReplayControls {...replay} />

        <button
          type="button"
          data-testid="theme-btn"
          onClick={toggle}
          data-tip={tip('Theme', 'Toggle dark / light. Choice persists across sessions.')}
          className="flex items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink transition-[.18s] hover:border-cyan"
        >
          {theme === 'dark' ? '🌙 DARK' : '☀️ LIGHT'}
        </button>
      </div>
    </header>
  );
}
