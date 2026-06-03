import type { StatsResponse } from '../lib/types';
import { chartDayBody } from '../lib/format';
import { tip } from '../lib/tooltip';

function dayLabel(raceDate: string): string {
  // 'YYYY-MM-DD' -> single-letter weekday, matching the mockup's compact labels
  const d = new Date(`${raceDate}T12:00:00`);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}

export function TelemetryChart({ stats }: { stats: StatsResponse }) {
  const { chart, repoUrl } = stats;
  const totals = chart.map((d) => d.commits + d.prsOpened + d.issuesClosed);
  const max = Math.max(1, ...totals);

  const commitsUrl = `${repoUrl}/commits`;
  const prsUrl = `${repoUrl}/pulls`;
  const issuesUrl = `${repoUrl}/issues?q=is%3Aissue+is%3Aclosed`;

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center gap-[10px] border-b border-line bg-panel2 px-[16px] py-[13px]">
        <span className="text-[16px]">📈</span>
        <h2 className="font-head text-[15px] font-bold tracking-[2px]">
          TELEMETRY — 14 DAY ACTIVITY
        </h2>
        <a
          data-testid="github-badge"
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          data-tip={tip('Source', 'Every series links to the matching view on S2AI/s2shape — click through to commits, PRs, or issues.')}
          className="mono ml-auto rounded-[5px] border border-cyan px-[8px] py-[3px] text-[10px] tracking-[1px] text-cyan"
        >
          ↗ GITHUB
        </a>
      </div>

      <div className="p-[16px]">
        <div className="relative flex h-[170px] items-end gap-[5px] px-[4px] pt-[10px]">
          {[0.25, 0.5, 0.75].map((g) => (
            <div
              key={g}
              className="absolute left-0 right-0 border-t border-dashed border-line"
              style={{ bottom: `${g * 100}%` }}
            />
          ))}
          {chart.map((d, i) => {
            const total = totals[i];
            const h = (total / max) * 100;
            return (
              <div
                key={d.raceDate}
                data-testid="chart-col"
                className="z-[1] flex h-full flex-1 flex-col items-center justify-end gap-[4px]"
              >
                <div
                  data-testid="chart-stack"
                  data-tip={tip(d.raceDate, chartDayBody(d))}
                  className="flex w-[70%] cursor-help flex-col-reverse overflow-hidden rounded-[3px_3px_0_0] transition-[height_.7s_cubic-bezier(.4,.8,.3,1)] hover:brightness-[1.2]"
                  style={{ height: `${h}%` }}
                >
                  <div data-testid="seg-commits" className="bg-cyan" style={{ flexGrow: d.commits }} />
                  <div data-testid="seg-prs" className="bg-accent" style={{ flexGrow: d.prsOpened }} />
                  <div data-testid="seg-issues" className="bg-amber" style={{ flexGrow: d.issuesClosed }} />
                </div>
                <div className="mono text-[9px] text-muted">{dayLabel(d.raceDate)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-[16px] border-t border-line px-[16px] py-[10px] font-head text-[11px] font-semibold tracking-[.5px] text-muted">
        <a data-testid="link-commits" href={commitsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-cyan" />
          Commits
        </a>
        <a data-testid="link-prs" href={prsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-accent" />
          PRs opened
        </a>
        <a data-testid="link-issues" href={issuesUrl} target="_blank" rel="noreferrer" className="flex items-center gap-[6px] hover:text-ink">
          <i className="h-[11px] w-[11px] rounded-[2px] bg-amber" />
          Issues closed
        </a>
        <span className="ml-auto">Hover a bar for the day · click → s2shape</span>
      </div>
    </div>
  );
}
