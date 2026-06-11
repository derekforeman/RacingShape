import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSessionId, getIdentity, setName, setFlag } from '../lib/spectatorId';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('getSessionId', () => {
  it('generates a UUID on first call', () => {
    const id = getSessionId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('persists the id to localStorage', () => {
    const id = getSessionId();
    expect(localStorage.getItem('racingshape-spectator-id')).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const first = getSessionId();
    const second = getSessionId();
    expect(second).toBe(first);
  });

  it('reuses an existing id from localStorage', () => {
    const stored = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    localStorage.setItem('racingshape-spectator-id', stored);
    expect(getSessionId()).toBe(stored);
  });
});

describe('getIdentity', () => {
  it('returns null name and flag when nothing is stored', () => {
    expect(getIdentity()).toEqual({ name: null, flag: null });
  });

  it('returns stored name and flag', () => {
    localStorage.setItem('racingshape-spectator-name', 'Alice');
    localStorage.setItem('racingshape-spectator-flag', '🇺🇸');
    expect(getIdentity()).toEqual({ name: 'Alice', flag: '🇺🇸' });
  });
});

describe('setName', () => {
  it('stores a trimmed name', () => {
    setName('  Bob  ');
    expect(getIdentity().name).toBe('Bob');
  });

  it('clears the name when given null', () => {
    setName('Bob');
    setName(null);
    expect(getIdentity().name).toBeNull();
  });

  it('clears the name when given an empty string', () => {
    setName('Bob');
    setName('');
    expect(getIdentity().name).toBeNull();
  });

  it('clears the name when given whitespace only', () => {
    setName('Bob');
    setName('   ');
    expect(getIdentity().name).toBeNull();
  });
});

describe('setFlag', () => {
  it('stores a flag emoji', () => {
    setFlag('🇨🇦');
    expect(getIdentity().flag).toBe('🇨🇦');
  });

  it('clears the flag when given null', () => {
    setFlag('🇨🇦');
    setFlag(null);
    expect(getIdentity().flag).toBeNull();
  });
});
