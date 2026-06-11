import { describe, it, expect } from 'vitest';
import { flagEmoji } from '../src/flag.js';

describe('flagEmoji', () => {
  it('maps a country code to a regional-indicator emoji', () => {
    expect(flagEmoji('CA')).toBe('🇨🇦');
    expect(flagEmoji('us')).toBe('🇺🇸'); // case-insensitive
  });
  it('returns null for invalid input', () => {
    expect(flagEmoji('')).toBeNull();
    expect(flagEmoji('USA')).toBeNull();
    expect(flagEmoji('1!')).toBeNull();
  });
});
