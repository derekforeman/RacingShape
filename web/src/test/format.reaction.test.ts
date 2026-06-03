import { describe, it, expect } from 'vitest';
import { reactionSummaryBody } from '../lib/format';

describe('reactionSummaryBody', () => {
  it('lists non-zero kinds and the never-affects-score note', () => {
    expect(reactionSummaryBody({ total: 7, byKind: { '🔥': 4, '⚡': 2, '🏎️': 1 } })).toBe(
      '7 cosmetic reactions from teammates · 🔥 4 · ⚡ 2 · 🏎️ 1. Never affects score.',
    );
  });

  it('omits zero-count kinds', () => {
    expect(reactionSummaryBody({ total: 4, byKind: { '🔥': 2, '⚡': 2, '🏎️': 0 } })).toBe(
      '4 cosmetic reactions from teammates · 🔥 2 · ⚡ 2. Never affects score.',
    );
  });

  it('reads "No boosts yet" when empty', () => {
    expect(reactionSummaryBody({ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } })).toBe(
      '0 cosmetic reactions from teammates · No boosts yet. Never affects score.',
    );
  });
});
