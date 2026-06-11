import { useEffect, useRef, useState, useCallback } from 'react';
import type { PresenceEvent, CheerEvent, SpectatorFan } from '@racingshape/shared';
import { getSessionId, getIdentity, setName as persistName, setFlag as persistFlag } from './spectatorId';
import { postHeartbeat, postCheer } from './api';

export interface CheerFx { id: number; targetLogin: string; label: string; }

export interface UseSpectators {
  count: number;
  peak: number;
  peakAt: string | null;
  fans: SpectatorFan[];
  cheerFx: CheerFx[];
  myName: string | null;
  myFlag: string | null;
  setMyName: (n: string | null) => void;
  setMyFlag: (f: string | null) => void;
  cheer: (targetLogin: string) => void;
}

export function useSpectators(): UseSpectators {
  const sessionId = getSessionId();
  const initial = getIdentity();
  const [count, setCount] = useState(0);
  const [peak, setPeak] = useState(0);
  const [peakAt, setPeakAt] = useState<string | null>(null);
  const [fans, setFans] = useState<SpectatorFan[]>([]);
  const [cheerFx, setCheerFx] = useState<CheerFx[]>([]);
  const [myName, setMyNameState] = useState<string | null>(initial.name);
  const [myFlag, setMyFlagState] = useState<string | null>(initial.flag);
  const myCheerFor = useRef<string | null>(null);
  const fxId = useRef(0);

  const sendHeartbeat = useCallback(async () => {
    try {
      const resp = await postHeartbeat({
        sessionId,
        name: myName,
        flag: myFlag,
        cheerForLogin: myCheerFor.current,
      });
      if (!myFlag && resp.flag) setMyFlagState(resp.flag);
    } catch { /* transient; next beat retries */ }
  }, [sessionId, myName, myFlag]);

  useEffect(() => {
    const es = new EventSource('/api/spectators/stream');
    es.addEventListener('presence', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as PresenceEvent;
      setCount(data.count); setPeak(data.peak); setPeakAt(data.peakAt);
      // Compute isSelf locally — broadcasts don't carry it.
      setFans(data.fans.map((f) => ({ ...f, isSelf: f.id === sessionId })));
    });
    es.addEventListener('cheer', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as CheerEvent;
      const id = ++fxId.current;
      setCheerFx((prev) => [...prev, { id, targetLogin: data.targetLogin, label: data.label }]);
      setTimeout(() => setCheerFx((prev) => prev.filter((f) => f.id !== id)), 1600);
    });
    return () => es.close();
  }, [sessionId]);

  useEffect(() => {
    void sendHeartbeat();
    const t = setInterval(() => void sendHeartbeat(), 20_000);
    return () => clearInterval(t);
  }, [sendHeartbeat]);

  const setMyName = useCallback((n: string | null) => { persistName(n); setMyNameState(n); }, []);
  const setMyFlag = useCallback((f: string | null) => { persistFlag(f); setMyFlagState(f); }, []);

  const cheer = useCallback((targetLogin: string) => {
    myCheerFor.current = targetLogin;
    void postCheer({ sessionId, targetLogin });
    void sendHeartbeat();
  }, [sessionId, sendHeartbeat]);

  return { count, peak, peakAt, fans, cheerFx, myName, myFlag, setMyName, setMyFlag, cheer };
}
