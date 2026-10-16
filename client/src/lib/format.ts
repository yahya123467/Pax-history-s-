import type { WorldState } from '../../../shared/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDate(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export const monthName = (m: number) => MONTHS[m - 1];

export function relation(state: WorldState, a: string, b: string): number {
  if (a === b) return 100;
  return state.nations[a]?.relations[b] ?? 0;
}

export function relationLabel(v: number): string {
  if (v <= -70) return 'Hostile';
  if (v <= -30) return 'Unfriendly';
  if (v < 10) return 'Neutral';
  if (v < 50) return 'Cordial';
  return 'Friendly';
}

export function relationColor(v: number): string {
  if (v <= -30) return 'var(--bad)';
  if (v < 10) return 'var(--muted)';
  return 'var(--good)';
}

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** localStorage can throw (private mode, blocked storage) — never let that break the game. */
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};
