import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { getViewerPeak, upsertViewerPeak } from '../../../src/db/repositories/viewerPeaks.js';

function freshDb() { const db = openDb(':memory:'); migrate(db); return db; }

describe('viewerPeaks repository', () => {
  it('returns null when no peak recorded', () => {
    expect(getViewerPeak(freshDb(), '2026-06-10')).toBeNull();
  });

  it('records and reads a peak', () => {
    const db = freshDb();
    upsertViewerPeak(db, '2026-06-10', 5, '2026-06-10T14:40:00.000Z');
    expect(getViewerPeak(db, '2026-06-10')).toEqual({ peakCount: 5, peakAt: '2026-06-10T14:40:00.000Z' });
  });

  it('raises the peak but never lowers it', () => {
    const db = freshDb();
    upsertViewerPeak(db, '2026-06-10', 5, '2026-06-10T14:40:00.000Z');
    upsertViewerPeak(db, '2026-06-10', 3, '2026-06-10T15:00:00.000Z'); // lower -> ignored
    expect(getViewerPeak(db, '2026-06-10')?.peakCount).toBe(5);
    upsertViewerPeak(db, '2026-06-10', 8, '2026-06-10T16:00:00.000Z'); // higher -> wins
    expect(getViewerPeak(db, '2026-06-10')).toEqual({ peakCount: 8, peakAt: '2026-06-10T16:00:00.000Z' });
  });
});
