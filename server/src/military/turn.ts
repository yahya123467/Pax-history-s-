/**
 * The monthly military phase, run at End Turn before the AI narrator:
 *   1. research   2. production   3. AI decisions   4. movement   5. battles
 *   6. occupation of undefended ground   7. recovery, reinforcement, training, war exhaustion
 * Returns short lines describing what happened, for the event log and the narrator prompt.
 */
import type { BattleReport, Division, WorldState } from '../../../shared/types';
import { IC_PER_FACTORY, TECH_BY_ID } from '../../../shared/military/catalog';
import { equipmentCost, productionEfficiency, researchSpeed, techCost } from '../../../shared/military/stats';
import { addEvent, clamp, formatDate } from '../state/world';
import { aiAir, aiDesigns, aiMoves, aiProduction, aiRecruit, aiResearch } from './ai';
import { resolveBattle, wingsInRange, type BattleContext, type Rng } from './combat';
import {
  atWar, canEnter, canLand, cleanupPositions, hostileIn, isAdjacent, mil, nationMil, StatCache,
} from './world';

export function seededRng(seed: number): Rng {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MilitaryTurnResult {
  battles: BattleReport[];
  lines: string[];
}

export function processMilitaryTurn(state: WorldState): MilitaryTurnResult {
  const m = mil(state);
  const rng = seededRng(state.turn * 7919 + m.nextId * 31 + state.date.length);
  const cache = new StatCache(state);
  const player = state.playerNation;
  const lines: string[] = [];
  const alive = Object.values(state.nations).filter((n) => n.alive);

  // 1. Research
  for (const n of alive) {
    const nm = nationMil(state, n.id);
    const speed = researchSpeed(nm, n.economy);
    nm.research = nm.research.map((slot) => {
      if (!slot) return null;
      const tech = TECH_BY_ID.get(slot.tech);
      if (!tech || nm.completed.includes(tech.id)) return null;
      slot.progress += speed;
      if (slot.progress >= techCost(tech, state.date)) {
        nm.completed.push(tech.id);
        if (n.id === player) addEvent(state, 'system', `Research complete: ${tech.name}.`);
        return null;
      }
      return slot;
    });
  }

  // 2. Production + manpower growth
  for (const n of alive) {
    const nm = nationMil(state, n.id);
    const mods = cache.modsOf(n.id);
    const efficiency = productionEfficiency(nm, n.economy, n.stability);
    for (const line of nm.production) {
      const ic = line.factories * IC_PER_FACTORY * efficiency;
      nm.stockpile[line.item] = (nm.stockpile[line.item] ?? 0) + ic / Math.max(0.1, equipmentCost(line.item, nm));
    }
    nm.manpower += Math.round(nm.factories * 400 * (1 + mods.manpower) + (n.minor ? 500 : 3000));
  }

  // 3. AI decisions
  for (const n of alive) {
    if (n.id === player) continue;
    aiResearch(state, n.id, rng);
    if (!n.minor && (state.turn + n.id.charCodeAt(0)) % 4 === 0) aiDesigns(state, n.id);
    if (!n.minor || state.turn % 6 === 0) aiProduction(state, n.id);
    aiRecruit(state, n.id, cache, rng);
    if (!n.minor) aiAir(state, n.id);
    aiMoves(state, n.id, cache, rng);
  }

  // 4. Movement. Every order moves a division one province (or across the sea).
  const cameFrom = new Map<string, string>();
  const moved = new Set<string>();
  const ordered = m.divisions.filter((d) => d.order && d.status === 'ready');
  for (const d of ordered) {
    const o = d.order!;
    d.order = null;
    d.landed = false;
    const access = canEnter(state, d.owner, o.to);
    if (!access || o.to === d.province) continue;
    const adjacent = isAdjacent(d.province, o.to);
    if (!adjacent && !canLand(d.province, o.to)) continue;
    // Can't simply walk out of a province where you're locked in combat, except to retreat to friendly ground.
    if (hostileIn(state, d.owner, d.province) && access === 'hostile') continue;
    cameFrom.set(d.id, d.province);
    d.landed = !adjacent;
    d.seaSupplied = !adjacent;
    d.province = o.to;
    d.entrench = 0;
    moved.add(d.id);
  }

  // 5. Battles: every province where warring sides meet.
  const battleProvinces = new Set<string>();
  for (const d of m.divisions) {
    if (d.status !== 'ready') continue;
    const owner = state.provinces[d.province]?.owner;
    if (owner && atWar(state, d.owner, owner)) battleProvinces.add(d.province);
  }
  // Air wings split their effort between all battles they can reach.
  const wingLoad = new Map<string, number>();
  for (const p of battleProvinces) {
    const nations = new Set(m.divisions.filter((d) => d.province === p).map((d) => d.owner));
    nations.add(state.provinces[p].owner);
    for (const w of wingsInRange(state, p, nations)) wingLoad.set(w.id, (wingLoad.get(w.id) ?? 0) + 1);
  }
  const ctx: BattleContext = { rng, cache, cameFrom, wingLoad };
  const battles: BattleReport[] = [];
  for (const p of [...battleProvinces].sort(() => rng() - 0.5)) {
    const report = resolveBattle(state, p, ctx);
    if (!report) continue;
    battles.push(report);
    const involvesPlayer = report.attacker.nations.includes(player) || report.defender.nations.includes(player);
    if (involvesPlayer || battles.length <= 8) lines.push(describeBattle(state, report));
  }
  m.battles = battles;

  // 6. Clean up positions after captures, then recovery.
  for (const note of cleanupPositions(state)) lines.push(note);
  const fought = new Set(battles.flatMap((b) => [...b.attacker.divisions, ...b.defender.divisions].map((d) => d.id)));
  for (const d of m.divisions) recover(state, d, cache, fought.has(d.id), moved.has(d.id));
  for (const d of m.divisions) d.landed = false;

  // 7. War exhaustion: casualties wear down stability.
  const casualties = new Map<string, number>();
  for (const b of battles) {
    for (const side of [b.attacker, b.defender]) {
      const per = side.casualties / Math.max(1, side.nations.length);
      for (const n of side.nations) casualties.set(n, (casualties.get(n) ?? 0) + per);
    }
  }
  for (const [id, c] of casualties) {
    const n = state.nations[id];
    if (!n) continue;
    const hit = Math.min(3, Math.floor(c / 4000));
    if (hit > 0) n.stability = clamp(n.stability - hit, 0, 100);
  }

  for (const line of lines) addEvent(state, 'world', line);
  return { battles, lines };
}

function recover(state: WorldState, d: Division, cache: StatCache, fought: boolean, moved: boolean) {
  const st = cache.div(d);
  const nm = nationMil(state, d.owner);
  if (d.status === 'training') {
    d.readyIn -= 1;
    if (d.readyIn <= 0) {
      d.status = 'ready';
      d.org = st.org * 0.6;
      if (d.owner === state.playerNation) addEvent(state, 'system', `${d.name} has completed training.`);
    }
    return;
  }
  const rec = 0.6 * (1 + st.effects.recovery) * (fought ? 0.6 : 1);
  d.org = Math.min(st.org, d.org + st.org * rec);
  if (!moved && !fought) d.entrench = Math.min(5, d.entrench + 1);
  else if (!moved) d.entrench = Math.min(5, d.entrench + 0.5);

  // Reinforce from stockpile + manpower (up to 25% per month, 35% with logistics).
  if (d.strength < 1) {
    const want = Math.min(1 - d.strength, 0.25 + st.effects.recovery * 0.3);
    let ratio = 1;
    const needMp = st.manpower * want;
    if (needMp > 0) ratio = Math.min(ratio, nm.manpower / needMp);
    for (const [item, k] of Object.entries(st.equipment)) {
      const need = k * want;
      if (need > 0) ratio = Math.min(ratio, (nm.stockpile[item] ?? 0) / need);
    }
    ratio = clamp(ratio, 0, 1);
    if (ratio > 0) {
      const gain = want * ratio;
      nm.manpower -= st.manpower * gain;
      for (const [item, k] of Object.entries(st.equipment)) nm.stockpile[item] = Math.max(0, (nm.stockpile[item] ?? 0) - k * gain);
      d.strength = Math.min(1, d.strength + gain);
    }
  }
}

function describeBattle(state: WorldState, b: BattleReport): string {
  const names = (ids: string[]) => ids.map((id) => state.nations[id]?.name ?? id).join(' & ');
  const a = names(b.attacker.nations), d = names(b.defender.nations);
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  const outcome = b.captured
    ? `${a} captured ${b.provinceName}`
    : b.winner === 'attacker'
      ? `${a} gained ground in ${b.provinceName} (occupation ${b.occupationAfter}%)`
      : b.winner === 'defender'
        ? `${d} held ${b.provinceName}${b.occupationDelta < 0 ? ` and pushed back (occupation ${b.occupationAfter}%)` : ''}`
        : `Stalemate in ${b.provinceName} (occupation ${b.occupationAfter}%)`;
  const losses = b.defender.divisions.length ? ` Casualties: ${a} ${k(b.attacker.casualties)}, ${d} ${k(b.defender.casualties)}.` : '';
  return `Battle of ${b.provinceName} (${formatDate(b.date)}): ${outcome}.${losses}`;
}
