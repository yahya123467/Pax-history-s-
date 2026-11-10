/**
 * Military AI for every nation the player doesn't control. Deterministic heuristics:
 * research the cheapest useful tech, design the best tank/jet it can build, keep factories
 * busy, recruit when threatened, feed the front, and attack where it has the advantage.
 */
import type { Division, JetDesign, NationMilitary, TankDesign, WorldState } from '../../../shared/types';
import {
  AIRFRAMES, JET_MODULES, JET_SPECIAL_SLOTS, JET_WEAPON_SLOTS, TANK_CHASSIS, TANK_MODULES, TANK_SLOTS, TECHS,
} from '../../../shared/military/catalog';
import { findJet, findTank, jetStats, jetUnlocked, tankStats, tankUnlocked, techCost, techState } from '../../../shared/military/stats';
import { getRelation } from '../state/world';
import type { Rng } from './combat';
import {
  atWar, canEnter, divisionPower, enemiesOf, findTemplate, friendlyGround, hostileIn, isAdjacent, mil, nationMil,
  neighbours, newId, ordinal, seaNeighbours, StatCache,
} from './world';

// ---- research ---------------------------------------------------------------

export function aiResearch(state: WorldState, nation: string, rng: Rng) {
  const nm = nationMil(state, nation);
  for (let i = 0; i < nm.research.length; i++) {
    if (nm.research[i]) continue;
    const taken = new Set(nm.research.map((s) => s?.tech));
    const options = TECHS.filter((t) => techState(t, nm) === 'available' && !taken.has(t.id));
    if (!options.length) return;
    // Cheapest first, with a little randomness so nations diverge.
    options.sort((a, b) => techCost(a, state.date) * (0.8 + rng() * 0.4) - techCost(b, state.date) * (0.8 + rng() * 0.4));
    nm.research[i] = { tech: options[0].id, progress: 0 };
  }
}

// ---- designs ----------------------------------------------------------------

const tankScore = (d: TankDesign, completed: string[]) => {
  const s = tankStats(d, completed).stats;
  return s.hard * 2 + s.soft + s.piercing * 0.3 + s.armor * 0.5 + s.defense + s.breakthrough * 0.5 + s.speed - s.cost * 1.5;
};
const jetScore = (d: JetDesign, completed: string[]) => {
  const s = jetStats(d, completed).stats;
  return s.airAttack * (1 + s.agility / 100) * (1 + s.stealth / 100) + s.groundAttack * 0.3 - s.cost * 0.2;
};

/** Best tank this nation can build from its research. */
export function autoTank(completed: string[], name: string, id: string): TankDesign {
  const ok = (req?: string) => !req || completed.includes(req);
  const chassis = [...TANK_CHASSIS].filter((c) => ok(c.requires) && c.id !== 'wheeled' && c.id !== 'light').pop()!;
  const design: TankDesign = { id, name, chassis: chassis.id, modules: {} };
  const pick = (kind: string, score: (m: (typeof TANK_MODULES)[number]) => number, extra?: (m: (typeof TANK_MODULES)[number]) => boolean) =>
    TANK_MODULES.filter((m) => m.slot === kind && ok(m.requires) && (!m.gunClass || chassis.gunClasses.includes(m.gunClass)) && (!extra || extra(m)))
      .sort((a, b) => score(b) - score(a));
  design.modules.gun = pick('gun', (m) => (m.piercing ?? 0) + (m.hard ?? 0) * 2)[0]?.id;
  design.modules.turret = pick('turret', (m) => (m.defense ?? 0) + (m.armor ?? 0) + (m.hardPct ?? 0) * 30)[0]?.id;
  design.modules.engine = pick('engine', (m) => (m.speed ?? 0) * 2 + (m.reliability ?? 0) * 40 + (m.defense ?? 0))[0]?.id;
  design.modules.armor = pick('armor', (m) => m.armor ?? 0)[0]?.id;
  design.modules.fcs = pick('fcs', (m) => (m.attackPct ?? 0) * 100 + (m.defense ?? 0))[0]?.id;
  const specials = pick('special', (m) => (m.armor ?? 0) + (m.defense ?? 0) * 1.5 + (m.hard ?? 0) + (m.soft ?? 0) * 0.6 + (m.attackPct ?? 0) * 60 - m.cost);
  TANK_SLOTS.filter((s) => s.kind === 'special').slice(0, chassis.specialSlots).forEach((s, i) => (design.modules[s.slot] = specials[i]?.id ?? null));
  return design;
}

/** Best air-superiority fighter this nation can build. */
export function autoJet(completed: string[], name: string, id: string): JetDesign {
  const ok = (req?: string) => !req || completed.includes(req);
  const frames = AIRFRAMES.filter((a) => ok(a.requires) && a.id !== 'ucav' && a.id !== 'strike');
  const frame = frames.sort((a, b) => (b.airAttack + b.stealth / 5) - (a.airAttack + a.stealth / 5))[0] ?? AIRFRAMES[0];
  const design: JetDesign = { id, name, airframe: frame.id, modules: {} };
  const best = (kind: string, score: (m: (typeof JET_MODULES)[number]) => number) =>
    JET_MODULES.filter((m) => m.slot === kind && ok(m.requires)).sort((a, b) => score(b) - score(a));
  design.modules.engine = best('engine', (m) => (m.agility ?? 0) + (m.speed ?? 0) / 50)[0]?.id;
  design.modules.radar = best('radar', (m) => m.detection ?? 0)[0]?.id;
  const aam = best('weapon', (m) => m.airAttack ?? 0)[0]?.id;
  JET_WEAPON_SLOTS.slice(0, frame.weaponSlots).forEach((s) => (design.modules[s] = aam));
  const specials = best('special', (m) => (m.stealth ?? 0) * (frame.stealthy ? 1 : 0.3) + (m.airPct ?? 0) * 100 - (m.extraWeapons ? 100 : 0) - (m.groundPct ? 20 : 0));
  JET_SPECIAL_SLOTS.slice(0, frame.specialSlots).forEach((s, i) => (design.modules[s] = specials[i]?.id ?? null));
  return design;
}

/** Majors refresh their designs when research makes something better possible. */
export function aiDesigns(state: WorldState, nation: string) {
  const nm = nationMil(state, nation);
  const name = state.nations[nation].name;
  const year = state.date.slice(0, 4);

  const bestTankId = currentBestTank(nm);
  const cand = autoTank(nm.completed, `${name} MBT-${year.slice(2)}`, `${nation.toLowerCase()}_t${nm.tankDesigns.length + 1}`);
  const cur = findTank(nm, bestTankId);
  if (tankStats(cand, nm.completed).errors.length === 0 && (!cur || tankScore(cand, nm.completed) > tankScore(cur, nm.completed) + 3)) {
    nm.tankDesigns.forEach((d) => (d.obsolete = true));
    nm.tankDesigns.push(cand);
    for (const tpl of nm.templates) for (const s of tpl.combat) if (s?.type === 'armored') s.design = cand.id;
    for (const l of nm.production) if (l.item.startsWith('tank:')) l.item = `tank:${cand.id}`;
    // Old tank stock still counts: convert it so existing divisions can reinforce.
    for (const [item, k] of Object.entries(nm.stockpile)) if (item.startsWith('tank:') && item !== `tank:${cand.id}`) {
      nm.stockpile[`tank:${cand.id}`] = (nm.stockpile[`tank:${cand.id}`] ?? 0) + k * 0.8;
      delete nm.stockpile[item];
    }
  }

  const jetCand = autoJet(nm.completed, `${name} F-${year.slice(2)}`, `${nation.toLowerCase()}_j${nm.jetDesigns.length + 1}`);
  const curJet = findJet(nm, bestJet(nm));
  if (jetStats(jetCand, nm.completed).errors.length === 0 && (!curJet || jetScore(jetCand, nm.completed) > jetScore(curJet, nm.completed) * 1.08)) {
    nm.jetDesigns.forEach((d) => (d.obsolete = true));
    nm.jetDesigns.push(jetCand);
  }
}

function currentBestTank(nm: NationMilitary): string {
  for (const tpl of nm.templates) for (const s of tpl.combat) if (s?.type === 'armored' && s.design) return s.design;
  return 'std_mbt_legacy';
}
function bestJet(nm: NationMilitary): string {
  const custom = nm.jetDesigns.filter((d) => !d.obsolete).pop();
  if (custom) return custom.id;
  for (const id of ['std_stealth_g5', 'std_multirole_g45', 'std_multirole_g4', 'std_fighter_g4']) {
    const d = findJet(nm, id)!;
    if (jetUnlocked(d, nm.completed)) return id;
  }
  return 'std_fighter_g4';
}

// ---- production & recruitment -------------------------------------------------

export function aiProduction(state: WorldState, nation: string) {
  const nm = nationMil(state, nation);
  const minor = state.nations[nation].minor;
  const war = enemiesOf(state, nation).length > 0;
  const tank = currentBestTank(nm);
  const tankOk = findTank(nm, tank) && tankUnlocked(findTank(nm, tank)!, nm.completed);
  const shares: [string, number][] = minor
    ? [['small_arms', 0.5], ['artillery', 0.3], ['atgm', 0.2]]
    : war
      ? [[`tank:${tank}`, tankOk ? 0.3 : 0], ['small_arms', 0.18], ['artillery', 0.15], ['ifv', 0.1], ['atgm', 0.05], ['drones', 0.07], ['air_defense', 0.05], [`jet:${bestJet(nm)}`, 0.1]]
      : [[`tank:${tank}`, tankOk ? 0.22 : 0], ['small_arms', 0.15], ['artillery', 0.12], ['ifv', 0.1], ['atgm', 0.05], ['drones', 0.06], ['air_defense', 0.1], [`jet:${bestJet(nm)}`, 0.2]];
  const lines = shares.filter(([, s]) => s > 0).map(([item, s]) => ({ id: newId(state, 'p'), item, factories: Math.floor(nm.factories * s) }));
  const used = lines.reduce((a, l) => a + l.factories, 0);
  if (lines.length) lines[1 % lines.length].factories += nm.factories - used;
  nm.production = lines.filter((l) => l.factories > 0);
}

/** Can the nation afford to equip `count` divisions of this template right now? */
export function canEquip(nm: NationMilitary, equipment: Record<string, number>, manpower: number, count = 1): boolean {
  if (nm.manpower < manpower * count) return false;
  return Object.entries(equipment).every(([item, k]) => (nm.stockpile[item] ?? 0) >= k * count);
}

export function consume(nm: NationMilitary, equipment: Record<string, number>, manpower: number, count = 1) {
  nm.manpower -= manpower * count;
  for (const [item, k] of Object.entries(equipment)) nm.stockpile[item] = Math.max(0, (nm.stockpile[item] ?? 0) - k * count);
}

export function aiRecruit(state: WorldState, nation: string, cache: StatCache, rng: Rng) {
  const nm = nationMil(state, nation);
  const n = state.nations[nation];
  const war = enemiesOf(state, nation).length > 0;
  const threatened = war || Object.values(n.relations).some((r) => r <= -70);
  if (!threatened) return;
  const own = mil(state).divisions.filter((d) => d.owner === nation).length;
  const cap = n.minor ? 6 : Math.min(120, Math.round(10 + nm.factories * 0.3 + nm.manpower / 80_000));
  if (own >= cap) return;
  const options = n.minor ? ['tpl_light_inf', 'tpl_infantry'] : ['tpl_infantry', 'tpl_infantry', 'tpl_mech', 'tpl_armored'];
  const perTurn = war ? (n.minor ? 1 : 3) : 1;
  for (let i = 0; i < perTurn; i++) {
    const tplId = options[Math.floor(rng() * options.length)];
    const tpl = findTemplate(nm, tplId);
    if (!tpl) continue;
    const st = cache.div({ owner: nation, template: tpl.id });
    if (!canEquip(nm, st.equipment, st.manpower)) continue;
    consume(nm, st.equipment, st.manpower);
    const number = mil(state).divisions.filter((d) => d.owner === nation && d.template === tpl.id).length + 1;
    mil(state).divisions.push({
      id: newId(state, 'd'), name: `${ordinal(number)} ${tpl.name}`, owner: nation, template: tpl.id, province: n.capital,
      strength: 1, org: 0, status: 'training', readyIn: 2, entrench: 0, experience: 0, order: null,
    });
  }
}

export function aiAir(state: WorldState, nation: string) {
  const m = mil(state);
  const nm = nationMil(state, nation);
  const wings = m.airWings.filter((w) => w.owner === nation);
  // Put produced planes into existing wings of the same design, or form a new wing.
  for (const [item, k] of Object.entries(nm.stockpile)) {
    if (!item.startsWith('jet:') || k < 1) continue;
    const design = item.slice(4);
    let wing = wings.find((w) => w.design === design);
    if (!wing && k >= 12) {
      wing = { id: newId(state, 'w'), name: `${ordinal(wings.length + 1)} Air Wing`, owner: nation, design, count: 0, province: state.nations[nation].capital, mission: 'superiority' };
      m.airWings.push(wing);
      wings.push(wing);
    }
    if (wing) {
      wing.count += Math.floor(k);
      nm.stockpile[item] = k - Math.floor(k);
    }
  }
  // At war: base wings next to the busiest front.
  const fronts = frontProvinces(state, nation);
  if (fronts.length) {
    const ownDivs = new Map<string, number>();
    for (const d of m.divisions) if (d.owner === nation) ownDivs.set(d.province, (ownDivs.get(d.province) ?? 0) + 1);
    const base = fronts.filter((p) => canEnter(state, nation, p) === 'friendly').sort((a, b) => (ownDivs.get(b) ?? 0) - (ownDivs.get(a) ?? 0))[0];
    if (base) for (const w of wings) w.province = base;
  }
}

// ---- land warfare -------------------------------------------------------------

/** Provinces we hold that touch an enemy-held province, plus contested ones. */
export function frontProvinces(state: WorldState, nation: string): string[] {
  const m = mil(state);
  const enemies = new Set(enemiesOf(state, nation));
  if (!enemies.size) return [];
  const held = new Set<string>();
  for (const p of Object.values(state.provinces)) if (canEnter(state, nation, p.id) === 'friendly') held.add(p.id);
  for (const d of m.divisions) if (d.owner === nation) held.add(d.province);
  return [...held].filter((p) =>
    hostileIn(state, nation, p) || neighbours(p).some((n) => enemies.has(state.provinces[n]?.owner ?? '') || hostileIn(state, nation, n)),
  );
}

export function aiMoves(state: WorldState, nation: string, cache: StatCache, rng: Rng) {
  const m = mil(state);
  const enemies = enemiesOf(state, nation);
  if (!enemies.length) return;
  const mine = m.divisions.filter((d) => d.owner === nation && d.status === 'ready');
  if (!mine.length) return;
  const power = (divs: Division[]) => divs.reduce((a, d) => a + divisionPower(d, cache.div(d)), 0);
  const enemyPowerIn = (p: string) => power(m.divisions.filter((d) => d.province === p && atWar(state, nation, d.owner)));
  const fronts = new Set(frontProvinces(state, nation));
  const capital = state.nations[nation].capital;

  // 1a. Feed ongoing battles: reinforce contested provinces where we're outnumbered.
  for (const c of fronts) {
    if (!hostileIn(state, nation, c)) continue;
    const ours = power(m.divisions.filter((d) => d.province === c && d.owner === nation && d.status === 'ready'));
    let need = enemyPowerIn(c) * 1.3 - ours;
    if (need <= 0) continue;
    for (const from of neighbours(c)) {
      if (from === c || canEnter(state, nation, from) !== 'friendly' || hostileIn(state, nation, from)) continue;
      const pool = mine.filter((d) => d.province === from && !d.order).sort((a, b) => divisionPower(b, cache.div(b)) - divisionPower(a, cache.div(a)));
      const keep = from === capital ? 2 : 0;
      for (const d of pool.slice(0, Math.max(0, pool.length - keep))) {
        if (need <= 0) break;
        if (d.org < cache.div(d).org * 0.5) continue;
        d.order = { kind: 'attack', to: c };
        need -= divisionPower(d, cache.div(d));
      }
    }
  }

  // 1b. Attacks from each front province into the weakest adjacent enemy province.
  for (const p of fronts) {
    if (hostileIn(state, nation, p)) continue; // contested: keep fighting here
    const here = mine.filter((d) => d.province === p && !d.order);
    if (!here.length) continue;
    const targets = neighbours(p).filter((n) => canEnter(state, nation, n) === 'hostile' || (hostileIn(state, nation, n) && canEnter(state, nation, n)));
    if (!targets.length) continue;
    const scored = targets.map((t) => ({ t, ratio: power(here) / Math.max(1, enemyPowerIn(t)) })).sort((a, b) => b.ratio - a.ratio);
    const best = scored[0];
    const aggressive = state.nations[nation].minor ? 2.5 : 1.3;
    if (best.ratio < aggressive && enemyPowerIn(best.t) > 0) continue;
    // Keep one division home if the province is our capital or touches another enemy.
    const keep = p === capital || targets.length > 1 ? 1 : 0;
    const sorted = here.sort((a, b) => divisionPower(b, cache.div(b)) - divisionPower(a, cache.div(a)));
    for (const d of sorted.slice(0, Math.max(0, sorted.length - keep))) {
      if (d.org < cache.div(d).org * 0.5) continue;
      d.order = { kind: 'attack', to: best.t };
    }
  }

  // 2. Naval invasion when no land front exists.
  if (!fronts.size && !state.nations[nation].minor) {
    // From any province we hold, across a strait to an enemy province.
    const options: { from: string; to: string; ratio: number }[] = [];
    for (const from of new Set(mine.map((d) => d.province))) {
      if (canEnter(state, nation, from) !== 'friendly') continue;
      for (const to of seaNeighbours(from)) {
        if (!enemies.includes(state.provinces[to]?.owner ?? '')) continue;
        const ready = mine.filter((d) => d.province === from && !d.order);
        options.push({ from, to, ratio: power(ready) / Math.max(1, enemyPowerIn(to)) });
      }
    }
    const t = options.sort((a, b) => b.ratio - a.ratio)[0];
    if (t && t.ratio > 1.6) {
      const ready = mine.filter((d) => d.province === t.from && !d.order).sort((a, b) => divisionPower(b, cache.div(b)) - divisionPower(a, cache.div(a)));
      ready.slice(0, Math.max(1, ready.length - 2)).slice(0, 10).forEach((d) => (d.order = { kind: 'naval', to: t.to }));
    }
  }

  // 3. Reserves move one step toward the nearest front or contested province.
  if (!fronts.size) return;
  const dist = bfs(state, nation, [...fronts]);
  for (const d of mine) {
    if (d.order || fronts.has(d.province)) continue;
    if (d.province === capital && mine.filter((x) => x.province === capital && !x.order).length <= 1 && rng() < 0.7) continue;
    const here = dist.get(d.province);
    const next = neighbours(d.province).filter((n) => dist.has(n) && (here === undefined || dist.get(n)! < here)).sort((a, b) => dist.get(a)! - dist.get(b)!)[0];
    if (next) d.order = { kind: 'move', to: next };
  }
}

/** Distance (in steps through friendly ground) to the nearest of `targets`. */
function bfs(state: WorldState, nation: string, targets: string[]): Map<string, number> {
  const dist = new Map<string, number>(targets.map((t) => [t, 0]));
  const queue = [...targets];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbours(cur)) {
      if (dist.has(n) || !friendlyGround(state, nation, n)) continue;
      dist.set(n, dist.get(cur)! + 1);
      queue.push(n);
    }
  }
  return dist;
}

// ---- peace ------------------------------------------------------------------------

/** Would `nation` accept peace with `other` right now? */
export function aiAcceptsPeace(state: WorldState, nation: string, other: string, cache: StatCache, rng: Rng): boolean {
  const m = mil(state);
  const power = (id: string) => m.divisions.filter((d) => d.owner === id).reduce((a, d) => a + divisionPower(d, cache.div(d)), 0);
  const ratio = power(nation) / Math.max(1, power(other));
  const losing = Object.entries(m.occupation).some(([p, o]) => state.provinces[p]?.owner === nation && o.by === other && o.progress > 30);
  const winning = Object.entries(m.occupation).some(([p, o]) => state.provinces[p]?.owner === other && o.by === nation && o.progress > 20);
  const rel = getRelation(state, nation, other);
  let chance = 0.15 + (ratio < 0.7 ? 0.35 : 0) + (losing ? 0.3 : 0) - (winning ? 0.4 : 0) - (ratio > 1.5 ? 0.3 : 0) + (rel + 100) / 800;
  if (state.nations[nation].stability < 30) chance += 0.2;
  return rng() < chance;
}

export { isAdjacent };
