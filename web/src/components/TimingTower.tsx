import type { RacerStanding } from '../lib/types';
import { standingTip, gapText } from '../lib/format';

const PALETTE = ['#e10600', '#15d6e0', '#34d399', '#ffb300', '#9b5de5', '#ff7849'];

/** Deterministic per-login color so the tower tile and track pod match. */
export function colorFor(login: string): string {
  let h = 0;
  for (let i = 0; i < login.length; i++) h = (h * 31 + login.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsFor(login: string): string {
  const cleaned = login.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/);
  if (cleaned.length >= 2) return (cleaned[0][0] + cleaned[1][0]).toUpperCase();
  return login.slice(0, 2).toUpperCase();
}

export function TimingTower({ standings }: { standings: RacerStanding[] }) {
  const ordered = [...standings].sort((a, b) => a.position - b.position);
  return (
    <div className="border-r border-line p-[10px]">
      <div className="mono flex gap-[9px] px-[8px] pb-[6px] text-[9px] tracking-[1px] text-muted">
        <span className="w-[18px]">P</span>
        <span className="w-[26px]" />
        <span>DRIVER</span>
        <span className="ml-auto">PTS</span>
        <span className="w-[34px] text-right">GAP</span>
      </div>
      {ordered.map((r) => (
        <div
          key={r.login}
          data-testid="tower-row"
          data-tip={standingTip(r)}
          className={`mb-[3px] flex cursor-help items-center gap-[9px] rounded-[7px] border-l-[3px] px-[8px] py-[7px] transition-[.2s] hover:bg-panel2 ${
            r.isLeader
              ? 'border-l-amber bg-gradient-to-r from-[rgba(255,179,0,.1)] to-transparent'
              : 'border-l-transparent'
          }`}
        >
          <span className={`mono w-[18px] text-[14px] font-bold ${r.isLeader ? 'text-amber' : 'text-muted'}`}>
            {r.position}
          </span>
          <span
            className="mono grid h-[26px] w-[26px] place-items-center rounded-[6px] text-[11px] font-bold text-white"
            style={{ background: colorFor(r.login) }}
          >
            {initialsFor(r.login)}
          </span>
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">
            {r.login}
          </span>
          <span className="mono text-[14px] font-bold">{r.score}</span>
          <span className="mono w-[34px] text-right text-[10px] text-cyan">{gapText(r)}</span>
        </div>
      ))}
    </div>
  );
}
