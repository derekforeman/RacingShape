import { describe, it, expect } from 'vitest';
import { raceDateFor, nyParts, msUntilNextNyMidnight } from '../../src/time/raceDate.js';

describe('raceDateFor', () => {
  it('keys on the NY calendar date for a daytime UTC instant', () => {
    // 2026-07-15 16:00 UTC = 12:00 EDT same day
    expect(raceDateFor(new Date('2026-07-15T16:00:00.000Z'))).toBe('2026-07-15');
  });

  it('rolls back to the previous NY day for a late-UTC instant that is still "yesterday" in NY', () => {
    // 2026-07-15 03:00 UTC = 2026-07-14 23:00 EDT (UTC-4) -> still the 14th in NY
    expect(raceDateFor(new Date('2026-07-15T03:00:00.000Z'))).toBe('2026-07-14');
  });

  it('handles the instant just before NY midnight (EDT, summer, UTC-4)', () => {
    // 2026-07-16 03:59:59 UTC = 2026-07-15 23:59:59 EDT
    expect(raceDateFor(new Date('2026-07-16T03:59:59.000Z'))).toBe('2026-07-15');
  });

  it('handles the instant at NY midnight (EDT, summer, UTC-4)', () => {
    // 2026-07-16 04:00:00 UTC = 2026-07-16 00:00:00 EDT -> new day
    expect(raceDateFor(new Date('2026-07-16T04:00:00.000Z'))).toBe('2026-07-16');
  });

  it('uses UTC-5 in winter (EST): a January instant rolls correctly', () => {
    // 2026-01-15 04:59:59 UTC = 2026-01-14 23:59:59 EST (UTC-5) -> still the 14th
    expect(raceDateFor(new Date('2026-01-15T04:59:59.000Z'))).toBe('2026-01-14');
    // 2026-01-15 05:00:00 UTC = 2026-01-15 00:00:00 EST -> new day
    expect(raceDateFor(new Date('2026-01-15T05:00:00.000Z'))).toBe('2026-01-15');
  });

  it('proves the offset differs by season (DST vs EST)', () => {
    // Same wall-clock NY midnight maps to a different UTC hour in summer vs winter.
    // Summer (EDT, UTC-4): NY midnight = 04:00 UTC
    expect(raceDateFor(new Date('2026-07-16T04:00:00.000Z'))).toBe('2026-07-16');
    expect(raceDateFor(new Date('2026-07-16T03:59:59.000Z'))).toBe('2026-07-15');
    // Winter (EST, UTC-5): NY midnight = 05:00 UTC
    expect(raceDateFor(new Date('2026-01-16T05:00:00.000Z'))).toBe('2026-01-16');
    expect(raceDateFor(new Date('2026-01-16T04:59:59.000Z'))).toBe('2026-01-15');
  });
});

describe('nyParts', () => {
  it('returns the NY local Y/M/D/H/M/S parts (summer)', () => {
    expect(nyParts(new Date('2026-07-15T16:30:45.000Z'))).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 12,
      minute: 30,
      second: 45,
    });
  });

  it('returns the NY local parts across a day boundary (winter)', () => {
    // 2026-01-15 04:59:59 UTC = 2026-01-14 23:59:59 EST
    expect(nyParts(new Date('2026-01-15T04:59:59.000Z'))).toEqual({
      year: 2026,
      month: 1,
      day: 14,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });
});

describe('msUntilNextNyMidnight', () => {
  it('counts the ms to the next NY midnight (summer)', () => {
    // 2026-07-15 23:00:00 EDT = 2026-07-16 03:00:00 UTC; next NY midnight is 1h later.
    const now = new Date('2026-07-16T03:00:00.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(60 * 60 * 1000);
  });

  it('counts the ms to the next NY midnight (winter)', () => {
    // 2026-01-15 23:30:00 EST = 2026-01-16 04:30:00 UTC; next NY midnight (05:00 UTC) is 30m later.
    const now = new Date('2026-01-16T04:30:00.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(30 * 60 * 1000);
  });

  it('returns a full day just after a NY midnight', () => {
    // 2026-07-16 00:00:00 EDT = 2026-07-16 04:00:00 UTC; one second past -> ~24h minus 1s.
    const now = new Date('2026-07-16T04:00:01.000Z');
    expect(msUntilNextNyMidnight(now)).toBe(24 * 60 * 60 * 1000 - 1000);
  });

  it('always returns a positive value within (0, 24h]', () => {
    const ms = msUntilNextNyMidnight(new Date('2026-03-10T12:00:00.000Z'));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
