import { afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from '../lib/usePolling';

// Flush pending promise microtasks under fake timers (RTL's waitFor can't detect
// vitest fake timers, so we advance them explicitly instead).
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePolling', () => {
  it('fetches once immediately and exposes data', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.loading).toBe(false);
  });

  it('refetches on the interval', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('captures errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    await flush();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('clears the interval on unmount', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { unmount } = renderHook(() => usePolling(fn, 1000, []));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on the interval while the document is hidden', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('refetch() triggers an immediate fetch', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => usePolling(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
