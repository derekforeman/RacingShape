import type {
  RaceToday,
  StatsResponse,
  RaceListItem,
  RaceArchive,
  CreateReactionBody,
  CreateReactionResponse,
} from './types';
import type { HeartbeatBody, HeartbeatResponse, CheerBody, CheerResponse } from '@racingshape/shared';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function getRaceToday(): Promise<RaceToday> {
  return getJson<RaceToday>('/api/race/today');
}

export function getStats(range: string): Promise<StatsResponse> {
  return getJson<StatsResponse>(`/api/stats?range=${encodeURIComponent(range)}`);
}

export function getRaces(): Promise<RaceListItem[]> {
  return getJson<RaceListItem[]>('/api/races');
}

export function getArchive(date: string): Promise<RaceArchive> {
  return getJson<RaceArchive>(`/api/race/${encodeURIComponent(date)}`);
}

export async function postReaction(body: CreateReactionBody): Promise<CreateReactionResponse> {
  const res = await fetch('/api/race/today/reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to /api/race/today/reactions failed: ${res.status}`);
  }
  return (await res.json()) as CreateReactionResponse;
}

export async function postHeartbeat(body: HeartbeatBody): Promise<HeartbeatResponse> {
  const res = await fetch('/api/spectators/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`heartbeat ${res.status}`);
  return res.json() as Promise<HeartbeatResponse>;
}

export async function postCheer(body: CheerBody): Promise<CheerResponse> {
  const res = await fetch('/api/spectators/cheer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  return res.json() as Promise<CheerResponse>;
}
