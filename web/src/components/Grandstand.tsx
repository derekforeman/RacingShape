import { useState } from 'react';
import type { SpectatorFan } from '@racingshape/shared';
import { tip } from '../lib/tooltip';
import { IdentityControl } from './IdentityControl';

interface Props {
  fans: SpectatorFan[];
  colorForLogin: (login: string) => string;
  myName: string | null;
  myFlag: string | null;
  onName: (n: string | null) => void;
  onFlag: (f: string | null) => void;
}

const CAP = 24;

export function Grandstand({ fans, colorForLogin, myName, myFlag, onName, onFlag }: Props) {
  const [editing, setEditing] = useState(false);
  const shown = fans.slice(0, CAP);
  const overflow = fans.length - shown.length;

  return (
    <div
      data-testid="grandstand"
      className="flex flex-wrap items-end gap-[13px] border-t border-line bg-gradient-to-t from-panel2 to-transparent px-[14px] py-[12px]"
    >
      <span className="mono self-center text-[9px] tracking-[1px] text-muted">FANS</span>
      {shown.map((f) => {
        const mins = Math.floor(f.watchingForSec / 60);
        const watching = mins < 1 ? 'just arrived' : `${mins}m`;
        const tipParts = [
          f.cheerForLogin ? `Cheering ${f.cheerForLogin}` : 'Watching the race',
          `Watching for ${watching}`,
        ];
        const fanLabel = [f.name ?? 'a fan', f.flag ?? ''].filter(Boolean).join(' ');
        return (
          <div
            key={f.id}
            data-testid={f.isSelf ? 'fan-self' : 'fan'}
            data-tip={tip(fanLabel, tipParts.join('\n'))}
            className={[
              'relative flex cursor-help flex-col items-center gap-[4px]',
              // Dim only OTHER anonymous fans (subtle, never shamed). Never dim your own
              // fan — it must stay readable and its identity popover is a child of this
              // node, so opacity here would make the popover translucent.
              !f.name && !f.isSelf ? 'opacity-40' : '',
              f.isSelf
                ? 'outline-1 outline-dashed outline-cyan rounded-[5px] px-[3px] cursor-pointer'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={f.isSelf ? () => setEditing((v) => !v) : undefined}
          >
            {/* head / flag */}
            {f.flag ? (
              <span className="text-[16px] leading-none">{f.flag}</span>
            ) : (
              <span className="h-[12px] w-[12px] rounded-full bg-muted" style={{ marginBottom: '-3px', zIndex: 1 }} />
            )}
            {/* body */}
            <span className="h-[14px] w-[17px] rounded-[8px_8px_4px_4px] bg-muted opacity-85" />
            {/* name */}
            {f.name && (
              <span
                data-testid="fan-name"
                className={`mono whitespace-nowrap text-[9px] ${f.isSelf ? 'text-cyan' : 'text-ink'}`}
              >
                {f.name}
              </span>
            )}
            {/* supporter dot — the car colour they're cheering for */}
            {f.cheerForLogin && (
              <span
                data-testid="supporter-dot"
                className="absolute right-[-6px] top-[-5px] h-[9px] w-[9px] rounded-full border-[1.5px] border-panel"
                style={{ background: colorForLogin(f.cheerForLogin) }}
              />
            )}
            {/* identity editor (only for self) */}
            {f.isSelf && editing && (
              <IdentityControl
                name={myName}
                flag={myFlag}
                onName={onName}
                onFlag={onFlag}
                onClose={() => setEditing(false)}
              />
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <span
          data-testid="fan-overflow"
          className="mono self-center text-[13px] text-cyan"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
