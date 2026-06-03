const NY_TZ = 'America/New_York';

export interface NyParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** The NY-local calendar/clock parts of a UTC instant. */
export function nyParts(date: Date): NyParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * The race_date key (YYYY-MM-DD) for a UTC instant, derived from the NY local
 * calendar date. Correct year-round across the DST/EST flip because it reads the
 * actual NY date rather than applying a fixed offset.
 */
export function raceDateFor(date: Date): string {
  const { year, month, day } = nyParts(date);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Milliseconds from `now` until the next NY midnight (00:00:00 NY local). Returns a
 * value in (0, 24h]: at exactly NY midnight it returns a full day, not 0.
 */
export function msUntilNextNyMidnight(now: Date): number {
  const { hour, minute, second } = nyParts(now);
  const ms = now.getMilliseconds();
  const elapsedToday = ((hour * 60 + minute) * 60 + second) * 1000 + ms;
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = dayMs - elapsedToday;
  return remaining === 0 ? dayMs : remaining;
}
