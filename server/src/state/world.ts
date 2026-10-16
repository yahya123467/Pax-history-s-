/** Pure helpers that read and mutate a WorldState. No I/O, no AI. */
import type { EventKind, GameEvent, Nation, Province, WorldState } from '../../../shared/types';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function getRelation(state: WorldState, a: string, b: string): number {
  if (a === b) return 100;
  return state.nations[a]?.relations[b] ?? 0;
}

/** Relations are symmetric: always write both sides. */
export function setRelation(state: WorldState, a: string, b: string, value: number) {
  if (a === b) return;
  const v = Math.round(clamp(value, -100, 100));
  const na = state.nations[a];
  const nb = state.nations[b];
  if (!na || !nb) throw new Error(`setRelation: unknown nation ${!na ? a : b}`);
  if (v === 0) {
    delete na.relations[b];
    delete nb.relations[a];
  } else {
    na.relations[b] = v;
    nb.relations[a] = v;
  }
}

export function addEvent(state: WorldState, kind: EventKind, text: string): GameEvent {
  const ev: GameEvent = { id: state.nextEventId++, turn: state.turn, date: state.date, kind, text: text.trim() };
  state.events.push(ev);
  return ev;
}

/** "1936-03-01" -> "1936-04-01" */
export function nextMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDate(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function provincesOf(state: WorldState, nation: string): Province[] {
  return Object.values(state.provinces).filter((p) => p.owner === nation);
}

/** Marks nations with no provinces as dead (and revives ones that regained land). Returns newly dead/alive ids. */
export function refreshAlive(state: WorldState): { died: string[]; revived: string[] } {
  const owning = new Set(Object.values(state.provinces).map((p) => p.owner));
  const died: string[] = [];
  const revived: string[] = [];
  for (const n of Object.values(state.nations)) {
    const alive = owning.has(n.id);
    if (n.alive && !alive) died.push(n.id);
    if (!n.alive && alive) revived.push(n.id);
    n.alive = alive;
  }
  return { died, revived };
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

/** Resolve an AI-supplied nation reference (id or name, case/diacritic-insensitive). */
export function resolveNation(state: WorldState, ref: unknown): Nation | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return undefined;
  const direct = state.nations[ref.trim().toUpperCase()];
  if (direct) return direct;
  const key = norm(ref);
  return Object.values(state.nations).find((n) => norm(n.name) === key || norm(n.id) === key);
}

/** Resolve an AI-supplied province reference (id or name). */
export function resolveProvince(state: WorldState, ref: unknown): Province | undefined {
  if (typeof ref !== 'string' || !ref.trim()) return undefined;
  const direct = state.provinces[ref.trim().toUpperCase()];
  if (direct) return direct;
  const key = norm(ref);
  return Object.values(state.provinces).find((p) => norm(p.name) === key);
}

export function majorNations(state: WorldState): Nation[] {
  return Object.values(state.nations).filter((n) => !n.minor);
}
