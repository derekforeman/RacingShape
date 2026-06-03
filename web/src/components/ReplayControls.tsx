import { tip } from '../lib/tooltip';

const SPEEDS = [1, 2, 4] as const;

export interface ReplayControlsProps {
  enabled: boolean;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (s: number) => void;
}

const chipClass =
  'flex items-center gap-[7px] rounded-[7px] border border-line bg-panel2 px-[13px] py-[9px] font-head text-[14px] font-semibold tracking-[1px] text-ink hover:border-cyan disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line';

export function ReplayControls({ enabled, playing, speed, onPlay, onPause, onSpeed }: ReplayControlsProps) {
  const nextSpeed = () => {
    const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    return SPEEDS[(i + 1) % SPEEDS.length];
  };
  return (
    <span className="inline-flex gap-[9px]">
      <button
        type="button"
        data-testid="replay-btn"
        aria-label={playing ? 'Pause replay' : 'Replay'}
        disabled={!enabled}
        onClick={() => (playing ? onPause() : onPlay())}
        data-tip={tip(
          'Replay',
          'Play the selected day back as a compressed fast-forward — full day in ~15 seconds.',
        )}
        className={chipClass}
      >
        {playing ? '❚❚ PAUSE' : '▶ REPLAY'}
      </button>
      <button
        type="button"
        data-testid="replay-speed"
        aria-label="Playback speed"
        disabled={!enabled}
        onClick={() => onSpeed(nextSpeed())}
        data-tip={tip('Replay speed', 'Cycle playback speed: 1× → 2× → 4×.')}
        className={chipClass}
      >
        {speed}×
      </button>
    </span>
  );
}
