/**
 * Land combat with air support.
 *
 * A battle happens in a province whenever divisions of warring sides share it.
 * Invaders (at war with the province owner) attack; everyone else on the owner's
 * side defends. Each battle is 12 rounds (~2.5 days each):
 *
 *  - Frontage: terrain width (+30 per extra attack direction). Divisions deploy until
 *    the width is full; reserves rotate in as front divisions lose organisation.
 *  - Each front division picks a random enemy front division and fires
 *    soft attack × (1 − hardness) + hard attack × hardness at it.
 *  - Hits are blocked by the target's defense (when defending) or breakthrough
 *    (when attacking): blocked hits do 5% damage, unblocked ones 25%.
 *  - Armor vs piercing: armor that out-classes the enemy's piercing halves damage taken
 *    and adds shock; piercing that can't beat armor loses attack.
 *  - Air: air-superiority wings in range fight for control of the sky; ground-support
 *    wings add damage scaled by the superiority they enjoy and the enemy's air defense.
 *
 * The result moves the province's occupation progress. At 100% the province changes hands,
 * and defenders that cannot retreat to a friendly neighbour are destroyed (encircled).
 */
import type { AirWing, BattleDivisionResult, BattleReport, BattleSide, Division, WorldState } from '../../../shared/types';
import { findJet, jetStats, type DivisionStats } from '../../../shared/military/stats';
import { addEvent, clamp, refreshAlive } from '../state/world';
import {
  atWar, canEnter, distanceKm, friendlyGround, hostileIn, isAdjacent, mil, nationMil, neighbours, sameSide, sizeFactor, StatCache, terrainOf,
} from './world';

export const ROUNDS = 12;
export type Rng = () => number;

interface Fighter {
  div: Division;
  st: DivisionStats;
  maxOrg: number;
  maxHp: number;
  hp: number;
  org: number;
  startHp: number;
  startOrg: number;
  side: 'att' | 'def';
  fought: boolean;
}

interface AirSide {
  wings: { wing: AirWing; share: number }[];
  superiority: number;
  ground: number;
  planes: number;
}

export interface BattleContext {
  rng: Rng;
  cache: StatCache;
  /** division id -> province it attacked from this turn */
  cameFrom: Map<string, string>;
  /** wing id -> number of battles it supports this turn (to split its effort) */
  wingLoad: Map<string, number>;
}

/** Which wings (by side) can reach this province. */
export function wingsInRange(state: WorldState, province: string, nations: Set<string>): AirWing[] {
  return mil(state).airWings.filter((w) => {
    if (!nations.has(w.owner) || w.count <= 0) return false;
    const design = findJet(nationMil(state, w.owner), w.design);
    if (!design) return false;
    const radius = jetStats(design).stats.range / 2;
    // Adjacent provinces are always in range (huge provinces like Russia have far-off centroids).
    return w.province === province || isAdjacent(w.province, province) || distanceKm(w.province, province) <= radius;
  });
}

function airSide(state: WorldState, wings: AirWing[], ctx: BattleContext): AirSide {
  const out: AirSide = { wings: [], superiority: 0, ground: 0, planes: 0 };
  for (const wing of wings) {
    const share = 1 / Math.max(1, ctx.wingLoad.get(wing.id) ?? 1);
    const design = findJet(nationMil(state, wing.owner), wing.design);
    if (!design) continue;
    const js = jetStats(design).stats;
    const mods = ctx.cache.modsOf(wing.owner);
    const n = wing.count * share;
    const air = n * js.airAttack * (1 + js.agility / 100) * (1 + js.stealth / 100) * (1 + js.detection / 200);
    if (wing.mission === 'superiority') out.superiority += air;
    else {
      out.superiority += air * 0.25;
      out.ground += n * js.groundAttack * (1 + mods.air_ground + mods.air_support);
    }
    out.planes += n;
    out.wings.push({ wing, share });
  }
  return out;
}

const blockDamage = (attack: number, block: number) => Math.min(attack, block) * 0.05 + Math.max(0, attack - block) * 0.25;

export function resolveBattle(state: WorldState, province: string, ctx: BattleContext): BattleReport | null {
  const m = mil(state);
  const prov = state.provinces[province];
  const owner = prov.owner;
  const here = m.divisions.filter((d) => d.province === province && d.status === 'ready');
  const attackers = here.filter((d) => atWar(state, d.owner, owner));
  const defenders = here.filter((d) => !atWar(state, d.owner, owner) && attackers.some((a) => atWar(state, a.owner, d.owner)));
  const training = m.divisions.filter((d) => d.province === province && d.status === 'training' && sameSide(state, d.owner, owner));
  if (!attackers.length) return null;

  const terrain = terrainOf(province);
  const directions = new Set(attackers.map((d) => ctx.cameFrom.get(d.id)).filter(Boolean));
  // Long fronts in big provinces: up to 2.5x the terrain width (Ukraine ~1.9x, Russia 2.5x).
  const frontWidth = Math.round(terrain.width * clamp(Math.sqrt(sizeFactor(province)), 1, 2.5)) + 30 * Math.min(2, Math.max(0, directions.size - 1));
  const leader = mostPresent(attackers);
  const occ = (m.occupation[province] ??= { by: leader, progress: 0 });
  if (occ.by !== leader && !sameSide(state, occ.by, leader)) { occ.by = leader; occ.progress = 0; }
  // A contested battle can take at most 60% of a province: even small countries need two wins.
  const gainBase = 60 / sizeFactor(province);
  const notes: string[] = [];

  const mk = (div: Division, side: 'att' | 'def'): Fighter => {
    const st = ctx.cache.div(div);
    const maxHp = Math.max(1, st.hp);
    const hp = maxHp * div.strength;
    const org = Math.min(div.org, st.org);
    return { div, st, maxOrg: Math.max(1, st.org), maxHp, hp, org, startHp: hp, startOrg: org, side, fought: false };
  };
  const att = attackers.map((d) => mk(d, 'att'));
  const def = defenders.map((d) => mk(d, 'def'));

  // ---- air ----
  const attNations = new Set(attackers.map((d) => d.owner));
  const defNations = new Set([owner, ...defenders.map((d) => d.owner)]);
  const airA = airSide(state, wingsInRange(state, province, attNations), ctx);
  const airD = airSide(state, wingsInRange(state, province, defNations), ctx);
  const totalSup = airA.superiority + airD.superiority;
  const supA = totalSup > 0 ? airA.superiority / totalSup : 0.5;
  const supD = 1 - supA;

  if (!def.length) {
    // Unopposed advance.
    const width = att.reduce((a, f) => a + f.st.width, 0);
    const delta = (100 / sizeFactor(province)) * clamp(width / (frontWidth * 0.5), 0.25, 1);
    notes.push(training.length ? 'Only units still in training were present; they could not resist.' : 'No defending divisions: the attackers advanced unopposed.');
    return finish(state, province, ctx, att, def, training, { winner: 'attacker', delta, frontWidth, terrainName: terrain.name, airA, airD, supA, rounds: [], notes });
  }

  // Side-wide modifiers
  const sideInit = (fs: Fighter[]) => fs.reduce((a, f) => a + f.st.effects.initiative, 0) / Math.max(1, fs.length);
  const sideMin = (fs: Fighter[], k: 'enemyAttack' | 'enemyArtillery') => Math.min(0, ...fs.map((f) => f.st.effects[k]));
  const initDiff = sideInit(att) - sideInit(def);
  const ewOnAtt = sideMin(def, 'enemyAttack'), ewOnDef = sideMin(att, 'enemyAttack');
  const cbOnAtt = sideMin(def, 'enemyArtillery'), cbOnDef = sideMin(att, 'enemyArtillery');

  const front = (fs: Fighter[]) => {
    const out: Fighter[] = [];
    let w = 0;
    // Divisions with the most organisation go in first; once committed they stay while they can.
    const ready = fs.filter((f) => f.org > f.maxOrg * 0.05 && f.hp > 0).sort((a, b) => Number(b.fought) - Number(a.fought) || b.org - a.org);
    for (const f of ready) {
      if (w + f.st.width > frontWidth && out.length) continue;
      out.push(f);
      w += f.st.width;
    }
    return out;
  };

  const attackValue = (a: Fighter, t: Fighter, attacking: boolean): number => {
    const art = a.st.artillerySoft * -(attacking ? cbOnAtt : cbOnDef);
    const soft = Math.max(0, a.st.soft - art);
    let v = soft * (1 - t.st.hardness) + a.st.hard * t.st.hardness;
    v *= a.hp / a.maxHp; // fewer guns, less fire
    v *= 1 + (attacking ? ewOnAtt : ewOnDef);
    v *= 1 + (attacking ? initDiff : -initDiff) * 0.5;
    if (attacking) {
      v *= 1 + terrain.attack * (1 - Math.min(1, a.st.effects.terrain));
      const amph = 1 - Math.min(1, a.st.effects.amphibious);
      if (a.div.landed) v *= 1 - 0.5 * amph;
      else if (a.div.seaSupplied) v *= 1 - 0.2 * amph;
    }
    // Piercing vs armor
    if (t.st.armor > 0 && a.st.piercing < t.st.armor) v *= 1 - 0.45 * (1 - a.st.piercing / t.st.armor);
    // Armor shock
    if (a.st.armor > t.st.piercing && a.st.armor > 0) v *= 1 + 0.3 * ((a.st.armor - t.st.piercing) / a.st.armor) * terrain.armorEff;
    return v;
  };

  const rounds: { att: number; def: number }[] = [];
  const orgFrac = (fs: Fighter[]) => fs.reduce((a, f) => a + Math.max(0, f.org), 0) / Math.max(1, fs.reduce((a, f) => a + f.maxOrg, 0));
  const defMul = (f: Fighter) => 1 + f.div.entrench * 0.04 * (1 + f.st.effects.entrench);
  const aaOf = (fs: Fighter[]) => fs.reduce((a, f) => a + f.st.airAttack, 0);

  for (let r = 0; r < ROUNDS; r++) {
    const fa = front(att), fd = front(def);
    if (!fa.length || !fd.length) break;
    fa.forEach((f) => (f.fought = true));
    fd.forEach((f) => (f.fought = true));
    const dmg = new Map<Fighter, { org: number; hp: number }>();
    const hit = (t: Fighter, raw: number, attackerArmor: number, attackerPierce: number) => {
      // armor shield of the target vs attacker piercing
      const shield = t.st.armor > attackerPierce && t.st.armor > 0 ? 0.5 * ((t.st.armor - attackerPierce) / t.st.armor) * terrain.armorEff : 0;
      const roll = 0.6 + ctx.rng() * 0.8;
      const cur = dmg.get(t) ?? { org: 0, hp: 0 };
      cur.org += raw * 0.7 * roll * (1 - shield);
      cur.hp += raw * 0.12 * roll * (1 - shield) * (1 + t.st.effects.casualties);
      dmg.set(t, cur);
      void attackerArmor;
    };
    for (const a of fa) {
      const t = fd[Math.floor(ctx.rng() * fd.length)];
      hit(t, blockDamage(attackValue(a, t, true), t.st.defense * defMul(t)), a.st.armor, a.st.piercing);
    }
    for (const d of fd) {
      const t = fa[Math.floor(ctx.rng() * fa.length)];
      hit(t, blockDamage(attackValue(d, t, false), t.st.breakthrough), d.st.armor, d.st.piercing);
    }
    // Close air support
    const cas = (air: AirSide, sup: number, enemyFront: Fighter[]) => {
      if (air.ground <= 0 || !enemyFront.length) return;
      const aa = aaOf(enemyFront);
      const total = air.ground * sup * (100 / (100 + aa * 0.8)) * 0.006;
      for (let k = 0; k < 3; k++) {
        const t = enemyFront[Math.floor(ctx.rng() * enemyFront.length)];
        hit(t, blockDamage(total / 3, t.side === 'def' ? t.st.defense * defMul(t) * 0.3 : t.st.breakthrough * 0.3), 0, 60);
      }
    };
    cas(airA, supA, fd);
    cas(airD, supD, fa);
    for (const [f, d] of dmg) {
      f.org -= d.org;
      f.hp = Math.max(0, f.hp - d.hp);
    }
    rounds.push({ att: round2(orgFrac(att)), def: round2(orgFrac(def)) });
  }

  // ---- outcome ----
  const a = orgFrac(att), d = orgFrac(def);
  const defBroken = def.every((f) => f.org <= f.maxOrg * 0.05 || f.hp <= 0);
  const attBroken = att.every((f) => f.org <= f.maxOrg * 0.05 || f.hp <= 0);
  let winner: BattleReport['winner'];
  let delta: number;
  const widthUsed = Math.min(frontWidth, att.filter((f) => f.fought).reduce((s, f) => s + f.st.width, 0));
  // Mass matters: a big army in reserve slows the occupation down.
  const mass = (fs: Fighter[]) => fs.reduce((s, f) => s + f.st.width * (f.hp / f.maxHp), 0);
  const widthFactor = clamp(widthUsed / frontWidth, 0.3, 1) * clamp(mass(att) / Math.max(1, mass(att) + mass(def)) * 1.6, 0.25, 1);
  if (defBroken && !attBroken) {
    winner = 'attacker';
    delta = gainBase * widthFactor;
    notes.push('The defence collapsed.');
  } else if (attBroken && !defBroken) {
    winner = 'defender';
    delta = -gainBase * 0.5 * clamp(d, 0.3, 1);
    notes.push('The attack was thrown back.');
  } else if (a - d > 0.12) {
    winner = 'attacker';
    delta = gainBase * clamp(a - d + 0.2, 0.25, 0.8) * widthFactor;
  } else if (d - a > 0.12) {
    winner = 'defender';
    delta = -gainBase * 0.4 * clamp(d - a, 0.1, 0.6);
  } else {
    winner = 'stalemate';
    delta = gainBase * (a - d) * 0.5;
  }
  if (supA > 0.75 && totalSup > 0) notes.push('The attackers controlled the sky.');
  if (supD > 0.75 && totalSup > 0) notes.push('The defenders controlled the sky.');
  if (att.some((f) => f.div.landed)) notes.push('Amphibious assault: troops landing from the sea fought at a disadvantage.');
  else if (att.some((f) => f.div.seaSupplied)) notes.push('The invaders are supplied over the beaches and fight at a disadvantage.');

  // Beaten invaders who came from next door fall back there.
  if (winner === 'defender') {
    for (const f of att) {
      if (f.org > f.maxOrg * 0.1) continue;
      const back = ctx.cameFrom.get(f.div.id);
      if (back && canEnter(state, f.div.owner, back) === 'friendly' && !hostileIn(state, f.div.owner, back)) {
        f.div.province = back;
        (f as Fighter & { pushed?: boolean }).pushed = true;
      }
    }
  }
  return finish(state, province, ctx, att, def, training, {
    winner, delta, frontWidth, terrainName: terrain.name, airA, airD, supA, rounds, notes,
  });
}

function finish(
  state: WorldState, province: string, ctx: BattleContext, att: Fighter[], def: Fighter[], training: Division[],
  r: { winner: BattleReport['winner']; delta: number; frontWidth: number; terrainName: string; airA: AirSide; airD: AirSide; supA: number; rounds: { att: number; def: number }[]; notes: string[] },
): BattleReport {
  const m = mil(state);
  const prov = state.provinces[province];
  const occ = m.occupation[province]!;
  const oldOwner = prov.owner;
  occ.progress = clamp(occ.progress + r.delta, 0, 100);
  const captured = occ.progress >= 100;
  const fates = new Map<string, BattleDivisionResult['fate']>();

  // Write back strength/org.
  for (const f of [...att, ...def]) {
    f.div.strength = clamp(f.hp / f.maxHp, 0, 1);
    f.div.org = Math.max(0, f.org);
    if (f.fought) f.div.experience = Math.min(1, f.div.experience + 0.02);
    const pushed = (f as Fighter & { pushed?: boolean }).pushed;
    fates.set(f.div.id, pushed ? 'pushed_back' : f.fought ? (f.side === 'def' ? 'held' : 'fought') : 'reserve');
    if (f.div.strength < 0.05) fates.set(f.div.id, 'destroyed');
  }

  if (captured) {
    const newOwner = occ.by;
    prov.owner = newOwner;
    for (const f of att) f.div.seaSupplied = false;
    delete m.occupation[province];
    // Defenders (and units in training) must retreat or are encircled.
    for (const d of [...def.map((f) => f.div), ...training]) {
      const exit = neighbours(province).find((n) => friendlyGround(state, d.owner, n));
      if (exit) {
        d.province = exit;
        d.org = Math.min(d.org, ctx.cache.div(d).org * 0.2);
        d.strength *= 0.85;
        d.entrench = 0;
        d.order = null;
        fates.set(d.id, 'retreated');
      } else {
        fates.set(d.id, 'destroyed');
        d.strength = 0;
      }
    }
    const loser = state.nations[oldOwner];
    const winnerN = state.nations[newOwner];
    loser.stability = clamp(loser.stability - 4, 0, 100);
    winnerN.stability = clamp(winnerN.stability + 2, 0, 100);
    if (loser.capital === province) {
      const other = Object.values(state.provinces).find((p) => p.owner === loser.id);
      if (other) loser.capital = other.id;
    }
    const encircled = [...fates.values()].filter((f) => f === 'destroyed').length;
    r.notes.push(`${winnerN.name} took control of ${prov.name}.${encircled ? ` ${encircled} encircled division(s) were destroyed.` : ''}`);
    addEvent(state, 'world', `${winnerN.name} captured ${prov.name} from ${loser.name}.`);
    const { died } = refreshAlive(state);
    for (const id of died) {
      addEvent(state, 'system', `${state.nations[id].name} has been conquered.`);
      m.wars = m.wars.filter((w) => w.a !== id && w.b !== id);
    }
  } else if (occ.progress <= 0) {
    delete m.occupation[province];
  }

  // Remove destroyed divisions
  const destroyed = new Set([...fates].filter(([, f]) => f === 'destroyed').map(([id]) => id));
  m.divisions = m.divisions.filter((d) => !destroyed.has(d.id) && d.strength >= 0.05);

  // Air losses
  const airLoss = (side: AirSide, enemySup: number, enemyAA: number) => {
    let lost = 0;
    for (const { wing, share } of side.wings) {
      const design = findJet(nationMil(state, wing.owner), wing.design);
      const rel = design ? jetStats(design).stats.reliability : 0.85;
      const k = Math.min(wing.count, Math.round(wing.count * share * (0.025 * enemySup + 0.01 * Math.min(2, enemyAA / 100)) * (2 - rel)));
      wing.count -= k;
      lost += k;
    }
    m.airWings = m.airWings.filter((w) => w.count > 0);
    return lost;
  };
  const aaAtt = att.reduce((s, f) => s + f.st.airAttack, 0);
  const aaDef = def.reduce((s, f) => s + f.st.airAttack, 0);
  const lostA = airLoss(r.airA, 1 - r.supA, aaDef);
  const lostD = airLoss(r.airD, r.supA, aaAtt);

  const side = (fs: Fighter[], air: AirSide, sup: number, lost: number, extra: Division[] = []): BattleSide => {
    const divisions: BattleDivisionResult[] = fs.map((f) => ({
      id: f.div.id, name: f.div.name, owner: f.div.owner, template: f.div.template,
      startStrength: round2(f.startHp / f.maxHp), endStrength: destroyed.has(f.div.id) ? 0 : round2(f.div.strength),
      startOrg: Math.round(f.startOrg), endOrg: Math.round(Math.max(0, f.org)), maxOrg: Math.round(f.maxOrg), fate: fates.get(f.div.id) ?? 'fought',
    }));
    for (const d of extra) {
      divisions.push({ id: d.id, name: `${d.name} (training)`, owner: d.owner, template: d.template, startStrength: 1, endStrength: destroyed.has(d.id) ? 0 : 1, startOrg: 0, endOrg: 0, maxOrg: 0, fate: fates.get(d.id) ?? 'reserve' });
    }
    const casualties = fs.reduce((s, f) => s + ((f.startHp - Math.max(0, f.hp)) / f.maxHp) * f.st.manpower * (1 + f.st.effects.casualties), 0)
      + fs.filter((f) => destroyed.has(f.div.id)).reduce((s, f) => s + f.st.manpower * (f.hp / f.maxHp), 0);
    const equipmentLost = fs.reduce((s, f) => s + ((f.startHp - Math.max(0, f.hp)) / f.maxHp) * f.st.cost, 0);
    return {
      nations: [...new Set(fs.map((f) => f.div.owner))],
      divisions,
      casualties: Math.round(casualties),
      equipmentLost: Math.round(equipmentLost),
      widthUsed: fs.filter((f) => f.fought).reduce((s, f) => s + f.st.width, 0),
      air: { planes: Math.round(air.planes), superiority: round2(sup), planesLost: lost },
    };
  };

  const attackerSide = side(att, r.airA, r.supA, lostA);
  const defenderSide = side(def, r.airD, 1 - r.supA, lostD, training);
  if (!defenderSide.nations.length) defenderSide.nations = [oldOwner];
  const report: BattleReport = {
    id: `b${state.turn}-${province}`,
    turn: state.turn,
    date: state.date,
    province,
    provinceName: prov.name,
    terrain: r.terrainName,
    frontWidth: r.frontWidth,
    attacker: attackerSide,
    defender: defenderSide,
    winner: r.winner,
    occupationDelta: Math.round(r.delta),
    occupationAfter: captured ? 100 : Math.round(m.occupation[province]?.progress ?? 0),
    captured,
    rounds: r.rounds,
    notes: r.notes,
  };
  return report;
}

function mostPresent(divs: Division[]): string {
  const c = new Map<string, number>();
  for (const d of divs) c.set(d.owner, (c.get(d.owner) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0][0];
}
const round2 = (x: number) => Math.round(x * 100) / 100;
