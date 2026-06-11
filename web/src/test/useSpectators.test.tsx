import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpectators } from '../lib/useSpectators';

// ---------------------------------------------------------------------------
// Mock the api module so we can control postHeartbeat / postCheer.
// ---------------------------------------------------------------------------
vi.mock('../lib/api', () => ({
  postHeartbeat: vi.fn().mockResolvedValue({ flag: null }),
  postCheer: vi.fn().mockResolvedValue({ ok: true }),
}));

import { postHeartbeat, postCheer } from '../lib/api';

// ---------------------------------------------------------------------------
// Minimal EventSource fake.
// The hook calls `new EventSource(url)`, then `es.addEventListener(type, fn)`
// and `es.close()`. We capture the handlers so tests can emit events.
// ---------------------------------------------------------------------------
type Handler = (e: MessageEvent) => void;

class FakeEventSource {
  static lastInstance: FakeEventSource | null = null;

  private handlers: Map<string, Handler[]> = new Map();
  public closed = false;

  constructor(public url: string) {
    FakeEventSource.lastInstance = this;
  }

  addEventListener(type: string, handler: Handler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  emit(type: string, data: unknown): void {
    const fns = this.handlers.get(type) ?? [];
    const event = { data: JSON.stringify(data) } as MessageEvent;
    fns.forEach((fn) => fn(event));
  }

  close(): void {
    this.closed = true;
  }
}

// ---------------------------------------------------------------------------
// Wire up the fake before each test and reset after.
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  FakeEventSource.lastInstance = null;
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.useFakeTimers();
  // Reset the mocks so call counts are fresh each test.
  (postHeartbeat as ReturnType<typeof vi.fn>).mockReset();
  (postHeartbeat as ReturnType<typeof vi.fn>).mockResolvedValue({ flag: null });
  (postCheer as ReturnType<typeof vi.fn>).mockReset();
  (postCheer as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

// Flush pending microtasks without advancing real time.
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('useSpectators', () => {
  it('starts with zero count and empty fans', () => {
    const { result } = renderHook(() => useSpectators());
    expect(result.current.count).toBe(0);
    expect(result.current.fans).toHaveLength(0);
  });

  it('fires an initial heartbeat on mount', async () => {
    renderHook(() => useSpectators());
    await flush();
    expect(postHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('sends a heartbeat every 20 seconds', async () => {
    renderHook(() => useSpectators());
    await flush(); // initial beat
    expect(postHeartbeat).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(postHeartbeat).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(postHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('updates count/peak/peakAt on a presence event', async () => {
    const { result } = renderHook(() => useSpectators());
    await flush();

    const presenceData = {
      type: 'presence',
      count: 5,
      peak: 8,
      peakAt: '2026-06-10T12:00:00Z',
      fans: [],
    };

    act(() => {
      FakeEventSource.lastInstance!.emit('presence', presenceData);
    });

    expect(result.current.count).toBe(5);
    expect(result.current.peak).toBe(8);
    expect(result.current.peakAt).toBe('2026-06-10T12:00:00Z');
  });

  it('marks isSelf true only for the fan whose id matches the session id', async () => {
    const { result } = renderHook(() => useSpectators());
    await flush();

    // Grab the session id that was registered.
    const sessionId = localStorage.getItem('racingshape-spectator-id')!;
    expect(sessionId).toBeTruthy();

    const fans = [
      { id: sessionId, name: 'Me', flag: '🇺🇸', cheerForLogin: null, watchingForSec: 30 },
      { id: 'other-session', name: 'Them', flag: null, cheerForLogin: null, watchingForSec: 10 },
    ];

    act(() => {
      FakeEventSource.lastInstance!.emit('presence', {
        type: 'presence',
        count: 2,
        peak: 2,
        peakAt: null,
        fans,
      });
    });

    expect(result.current.fans).toHaveLength(2);
    const self = result.current.fans.find((f) => f.id === sessionId);
    const other = result.current.fans.find((f) => f.id === 'other-session');
    expect(self?.isSelf).toBe(true);
    expect(other?.isSelf).toBe(false);
  });

  it('adds a cheerFx entry on a cheer event and removes it after 1600ms', async () => {
    const { result } = renderHook(() => useSpectators());
    await flush();

    act(() => {
      FakeEventSource.lastInstance!.emit('cheer', {
        type: 'cheer',
        targetLogin: 'devon-r',
        label: 'Alice',
      });
    });

    expect(result.current.cheerFx).toHaveLength(1);
    expect(result.current.cheerFx[0].targetLogin).toBe('devon-r');
    expect(result.current.cheerFx[0].label).toBe('Alice');

    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(result.current.cheerFx).toHaveLength(0);
  });

  it('cheer() calls postCheer and triggers a heartbeat', async () => {
    const { result } = renderHook(() => useSpectators());
    await flush();
    const callsBefore = (postHeartbeat as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      result.current.cheer('devon-r');
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(postCheer).toHaveBeenCalledTimes(1);
    expect((postCheer as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      targetLogin: 'devon-r',
    });
    expect((postHeartbeat as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('setMyName persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useSpectators());
    act(() => { result.current.setMyName('Alice'); });
    expect(result.current.myName).toBe('Alice');
    expect(localStorage.getItem('racingshape-spectator-name')).toBe('Alice');
  });

  it('setMyFlag persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useSpectators());
    act(() => { result.current.setMyFlag('🇨🇦'); });
    expect(result.current.myFlag).toBe('🇨🇦');
    expect(localStorage.getItem('racingshape-spectator-flag')).toBe('🇨🇦');
  });

  it('closes the EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useSpectators());
    await flush();
    const es = FakeEventSource.lastInstance!;
    unmount();
    expect(es.closed).toBe(true);
  });

  it('stops the heartbeat interval on unmount', async () => {
    const { unmount } = renderHook(() => useSpectators());
    await flush();
    const callsAfterMount = (postHeartbeat as ReturnType<typeof vi.fn>).mock.calls.length;
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
    expect((postHeartbeat as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterMount);
  });
});
