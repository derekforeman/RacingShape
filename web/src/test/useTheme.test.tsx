import { afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, THEME_STORAGE_KEY } from '../lib/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});

afterEach(() => {
  localStorage.clear();
});

describe('useTheme', () => {
  it('defaults to dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle flips to light and sets the html attribute', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the choice to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('reads a persisted choice on init', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
