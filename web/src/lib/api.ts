import type { RaceToday, StatsResponse, RaceListItem, RaceArchive } from './types';

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
