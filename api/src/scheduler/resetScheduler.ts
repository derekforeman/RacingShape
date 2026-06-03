export interface ResetSchedulerDeps {
  clock: () => Date;
  msUntilNextNyMidnight: (now: Date) => number;
  raceDateFor: (date: Date) => string;
  /** Capture a final snapshot for the closing day. */
  snapshot: (raceDate: string, at: Date) => void;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * Fires at NY midnight to seal the closing day with a final snapshot, then re-arms.
 * NOT destructive: events already carry their own race_date, so the next day's
 * getToday simply reads the new date key. Reset == rollover + final snapshot.
 */
export class ResetScheduler {
  private handle: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: ResetSchedulerDeps) {}

  start(): void {
    this.stopped = false;
    this.arm();
  }

  stop(): void {
    this.stopped = true;
    if (this.handle != null) {
      this.deps.clearTimer(this.handle);
      this.handle = null;
    }
  }

  private arm(): void {
    if (this.stopped) return;
    const ms = this.deps.msUntilNextNyMidnight(this.deps.clock());
    this.handle = this.deps.setTimer(() => this.onMidnight(), ms);
  }

  private onMidnight(): void {
    if (this.stopped) return;
    const at = this.deps.clock();
    // The closing day = the NY date one millisecond before "now" (we just crossed midnight).
    const closing = this.deps.raceDateFor(new Date(at.getTime() - 1));
    this.deps.snapshot(closing, at);
    this.arm();
  }
}
