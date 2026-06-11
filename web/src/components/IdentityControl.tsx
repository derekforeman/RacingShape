import { useState } from 'react';

interface Props {
  name: string | null;
  flag: string | null;
  onName: (n: string | null) => void;
  onFlag: (f: string | null) => void;
  onClose: () => void;
}

const FLAGS = ['🇺🇸', '🇨🇦', '🇬🇧', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🇩🇪', '🇫🇷', '🇮🇳', '🇧🇷', '🇯🇵', '🇦🇺', '🏎️', '🔥'];

export function IdentityControl({ name, flag, onName, onFlag, onClose }: Props) {
  const [draft, setDraft] = useState(name ?? '');

  return (
    <div
      data-testid="identity-control"
      className="absolute bottom-full left-1/2 z-[10] mb-[8px] w-[200px] -translate-x-1/2 rounded-[8px] border border-line bg-panel2 p-[10px] shadow-[0_10px_30px_rgba(0,0,0,.45)]"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="mono mb-[4px] block text-[9px] tracking-[1px] text-muted">YOUR NAME</label>
      <input
        data-testid="name-input"
        value={draft}
        placeholder="optional"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onName(draft.trim() || null)}
        className="mono mb-[8px] w-full rounded-[5px] border border-line bg-panel px-[7px] py-[4px] text-[11px] text-ink outline-none focus:border-cyan"
      />
      <div className="mono mb-[4px] text-[9px] tracking-[1px] text-muted">FLAG</div>
      <div className="mb-[8px] flex flex-wrap gap-[4px]">
        {FLAGS.map((f) => (
          <button
            key={f}
            data-testid={`flag-btn-${f}`}
            className={`rounded-[4px] p-[2px] text-[14px] transition duration-100 hover:bg-panel ${
              flag === f ? 'outline outline-1 outline-cyan' : ''
            }`}
            onClick={() => onFlag(f)}
          >
            {f}
          </button>
        ))}
        <button
          data-testid="flag-clear"
          className="mono rounded-[4px] px-[4px] py-[2px] text-[9px] text-muted hover:bg-panel hover:text-ink"
          onClick={() => onFlag(null)}
        >
          clear
        </button>
      </div>
      <button
        data-testid="identity-done"
        className="mono w-full rounded-[5px] border border-cyan py-[4px] text-[10px] tracking-[1px] text-cyan hover:bg-cyan hover:text-[#07090d]"
        onClick={onClose}
      >
        DONE
      </button>
    </div>
  );
}
