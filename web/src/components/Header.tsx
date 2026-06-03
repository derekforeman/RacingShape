import { tip } from '../lib/tooltip';
import { useTheme } from '../lib/useTheme';

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-line border-l-[5px] border-l-accent bg-gradient-to-r from-panel to-panel2 px-[18px] py-[14px]">
      <div className="flex items-center gap-[13px]">
        <div className="grid h-[46px] w-[46px] place-items-center rounded-[9px] bg-accent text-[24px] shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset]">
          🏁
        </div>
        <div>
          <h1 className="font-head text-[24px] font-bold leading-none tracking-[3px]">
            RACINGSHAPE
          </h1>
          <div className="mono mt-[3px] text-[10px] tracking-[2px] text-muted">
            SHIP CODE · RACE CARS · WIN THE DAY
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap items-center gap-[9px]">
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

        {/* PLAN 04: real date selector + archived days. Disabled stub for now. */}
        <select
          data-testid="date-selector"
          disabled
          defaultValue="JUN 02 · TODAY"
          data-tip={tip(
            'Race day',
            'Switch between today and archived days. (Coming soon — archived replay arrives in the next release.)',
          )}
          className="cursor-not-allowed appearance-none rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink opacity-60"
        >
          <option>JUN 02 · TODAY</option>
        </select>

        {/* PLAN 04: replay engine. Disabled stub for now. */}
        <button
          type="button"
          data-testid="replay-btn"
          disabled
          data-tip={tip('Replay', 'Play an archived day back as a ~15s fast-forward. (Coming soon.)')}
          className="flex cursor-not-allowed items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink opacity-60"
        >
          ▶ REPLAY
        </button>

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
