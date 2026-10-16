/** Typed wrappers around the server API. The browser never sees the AI key — it only calls /api. */
import type { GameDTO, SaveSummary, ScenarioSummary } from '../../../shared/types';

export interface GameListItem {
  id: string;
  name: string;
  playerNation: string;
  date: string;
  turn: number;
  updatedAt: string;
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean; aiMode: 'live' | 'mock'; model: string | null }>('GET', '/health'),
  scenarios: () => req<ScenarioSummary[]>('GET', '/scenarios'),
  games: () => req<GameListItem[]>('GET', '/games'),
  createGame: (b: { scenarioId: string; nation: string; startMonth?: string; name?: string }) => req<GameDTO>('POST', '/games', b),
  getGame: (id: string) => req<GameDTO>('GET', `/games/${id}`),
  endTurn: (id: string, action: string) => req<GameDTO>('POST', `/games/${id}/turn`, { action }),
  chat: (id: string, nation: string, message: string) => req<GameDTO>('POST', `/games/${id}/chat/${nation}`, { message }),
  conclude: (id: string, nation: string) => req<GameDTO>('POST', `/games/${id}/chat/${nation}/conclude`),
  save: (id: string, name: string) => req<{ id: number }>('POST', `/games/${id}/saves`, { name }),
  saves: () => req<SaveSummary[]>('GET', '/saves'),
  loadSave: (id: number) => req<GameDTO>('POST', `/saves/${id}/load`),
  deleteSave: (id: number) => req<{ ok: true }>('DELETE', `/saves/${id}`),
};
