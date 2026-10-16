import type { Nation, Province, ScenarioSummary, WorldState } from '../../../shared/types';
import { PROVINCES } from '../state/provinces';
import { addEvent, setRelation } from '../state/world';
import { europe1936 } from './europe1936';
import type { ScenarioDefinition } from './types';

export const SCENARIOS: Record<string, ScenarioDefinition> = { [europe1936.id]: europe1936 };

export function listScenarios(): ScenarioSummary[] {
  return Object.values(SCENARIOS).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    startDate: s.startDate,
    startRange: s.startRange,
    playableNations: s.nations
      .filter((n) => n.playable)
      .map((n) => ({ id: n.id, name: n.name, leader: n.leader, color: n.color, blurb: n.blurb })),
  }));
}

/** Deterministic muted colour for auto-generated minor nations. */
function minorColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return hslToHex(hue, 18 + (h % 12), 38 + ((h >> 4) % 10));
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export class ScenarioError extends Error {}

export function buildInitialState(scenarioId: string, playerNation: string, startMonth?: string): WorldState {
  const sc = SCENARIOS[scenarioId];
  if (!sc) throw new ScenarioError(`Unknown scenario "${scenarioId}"`);
  const seed = sc.nations.find((n) => n.id === playerNation);
  if (!seed?.playable) throw new ScenarioError(`"${playerNation}" is not a playable nation in ${sc.name}`);

  let date = sc.startDate;
  if (startMonth) {
    if (!/^\d{4}-\d{2}$/.test(startMonth) || startMonth < sc.startRange[0] || startMonth > sc.startRange[1])
      throw new ScenarioError(`Start date must be between ${sc.startRange[0]} and ${sc.startRange[1]}`);
    date = `${startMonth}-01`;
  }

  const nations: Record<string, Nation> = {};
  const capitals = new Map<string, string>();
  for (const [prov, owner] of Object.entries(sc.owners)) if (!capitals.has(owner)) capitals.set(owner, prov);
  for (const { blurb: _blurb, ...n } of sc.nations) {
    const capital = capitals.get(n.id);
    if (!capital) throw new ScenarioError(`Nation ${n.id} owns no provinces`);
    nations[n.id] = { ...n, capital, relations: {}, minor: false, alive: true };
  }

  const provinces: Record<string, Province> = {};
  for (const p of PROVINCES) {
    const name = sc.provinceNames[p.id] ?? p.name;
    let owner = sc.owners[p.id];
    if (!owner) {
      // Unassigned province -> its own minor nation, keyed by the province id.
      owner = p.id;
      nations[owner] = {
        id: owner, name, capital: p.id, leader: 'Local government', government: 'Independent minor state', color: minorColor(owner),
        relations: {}, stability: 50, economy: 30, goals: ['Survive and stay neutral'], playable: false, minor: true, alive: true,
      };
    }
    provinces[p.id] = { id: p.id, name, owner };
  }
  for (const id of Object.keys(sc.owners))
    if (!provinces[id]) throw new ScenarioError(`Scenario references unknown province ${id}`);

  const state: WorldState = {
    schemaVersion: 1,
    scenarioId,
    date,
    turn: 1,
    playerNation,
    nations,
    provinces,
    events: [],
    nextEventId: 1,
    historySummary: '',
    archivedEventCount: 0,
    chats: {},
    lastReport: null,
  };
  for (const [a, b, v] of sc.relations) setRelation(state, a, b, v);
  for (const text of sc.openingEvents) addEvent(state, 'world', text);
  addEvent(state, 'system', `You lead ${nations[playerNation].name}. The year is ${date.slice(0, 4)}.`);
  return state;
}
