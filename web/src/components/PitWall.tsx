import type { StatsResponse } from '../lib/types';
import { completionText, streakText } from '../lib/format';
import { tip } from '../lib/tooltip';

export function PitWall({ stats }: { stats: StatsResponse }) {
  const { totalTasks, completion, streak, crowd } = stats;
  const delta = totalTasks.deltaVsPriorWeek;
  const deltaSign = delta >= 0 ? `▲ +${delta}` : `▼ ${delta}`;
  const pct = Math.round(completion.rate * 100);

  const crowdPeaks = crowd.peaks.map((p) => p.peak);
  const crowdAvg = crowdPeaks.length
    ? Math.round(crowdPeaks.reduce((a, b) => a + b, 0) / crowdPeaks.length)
    : 0;
  const crowdMax = Math.max(1, ...crowdPeaks);

  return (
    <aside className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">📊</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">PIT WALL</h2>
      </div>

      <div className="border-b border-line px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          🗂️ Total tasks touched
        </div>
        <div
          data-testid="stat-tasks"
          data-tip={tip(
            'Tasks touched · 14d',
            `${totalTasks.issues} issues + ${totalTasks.prs} pull requests the team opened, updated, or closed in the window.`,
          )}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none"
        >
          {totalTasks.total}
        </div>
        <div className="mt-[5px] text-[11px] font-semibold text-green">{deltaSign} vs prior week</div>
      </div>

      <div className="border-b border-line px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          ✅ Completion rate
        </div>
        <div
          data-testid="stat-completion"
          data-tip={tip('Completion rate', completionText(completion))}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none"
        >
          {pct}%
        </div>
        <div
          data-testid="completion-gauge"
          data-tip={`${completion.closed} / ${completion.opened} closed or merged`}
          className="mt-[9px] h-[7px] cursor-help overflow-hidden rounded-[4px] bg-panel2"
        >
          <div
            data-testid="completion-fill"
            className="h-full rounded-[4px] bg-gradient-to-r from-cyan to-green"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-[5px] text-[11px] text-muted">closed / opened · 14d window</div>
      </div>

      <div className="border-b border-line px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          🔥 Team streak
        </div>
        <div
          data-testid="stat-streak"
          data-tip={tip('Team streak', streakText(streak))}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none text-amber"
        >
          {streak.current} <span className="text-[14px] text-muted">DAYS</span>
        </div>
        <div className="mt-[5px] text-[11px] text-muted">
          {streak.startDate ? `active every day since ${streak.startDate}` : 'start a run today'}
        </div>
      </div>

      <div className="px-[16px] py-[14px]">
        <div className="flex items-center gap-[7px] font-head text-[12px] font-semibold uppercase tracking-[1px] text-muted">
          👥 Biggest crowd
        </div>
        <div
          data-testid="stat-crowd"
          data-tip={tip(
            'Biggest crowd today',
            `${crowd.peakToday} concurrent viewers\n14-day average ${crowdAvg}`,
          )}
          className="mono mt-[4px] inline-block cursor-help text-[32px] font-bold leading-none"
        >
          {crowd.peakToday}
        </div>
        <div
          data-testid="crowd-sparkline"
          className="mt-[9px] flex h-[28px] items-end gap-[2px]"
        >
          {crowd.peaks.map((p, i) => (
            <span
              key={p.date ?? i}
              data-testid="crowd-bar"
              className="flex-1 rounded-t-[2px] bg-cyan opacity-70"
              style={{ height: `${Math.max(1, Math.round((p.peak / crowdMax) * 100))}%` }}
            />
          ))}
        </div>
        <div className="mt-[5px] text-[11px] text-muted">peak concurrent viewers · 14d</div>
      </div>
    </aside>
  );
}
