/**
 * Pure stat calculations for research, tank/jet designs and division templates.
 * Used by the server (simulation, validation) and by the client (live previews).
 */
import type { DivisionTemplate, JetDesign, JetSlot, ModKey, NationMilitary, TankDesign, TankSlot, TechDef } from '../types';
import {
  AHEAD_OF_TIME_PENALTY, AIRFRAME_BY_ID, BATTALION_BY_ID, EQUIPMENT_BY_ID, GRID_COLS, GRID_ROWS, JET_MODULE_BY_ID, JET_SPECIAL_SLOTS,
  JET_WEAPON_SLOTS, STD_JETS, STD_TANKS, SUPPORT_SLOTS, TANK_CHASSIS, TANK_MODULE_BY_ID, TANK_SLOTS, TECH_BY_ID, TECHS,
  type DivisionEffect,
} from './catalog';

export type Mods = Record<ModKey, number>;
const ZERO_MODS: Mods = {
  inf_soft: 0, inf_hard: 0, inf_def: 0, inf_pierce: 0, art_soft: 0, art_hard: 0, org: 0, attack: 0, defense: 0, breakthrough: 0,
  entrench: 0, recon: 0, air_defense: 0, air_ground: 0, air_support: 0, industry: 0, research: 0, recovery: 0, manpower: 0,
};

export function techMods(completed: Iterable<string>): Mods {
  const m = { ...ZERO_MODS };
  for (const id of completed) {
    const tech = TECH_BY_ID.get(id);
    if (!tech?.mods) continue;
    for (const [k, v] of Object.entries(tech.mods)) m[k as ModKey] += v ?? 0;
  }
  return m;
}

const has = (completed: string[] | Set<string>, id: string | undefined) =>
  !id || (Array.isArray(completed) ? completed.includes(id) : completed.has(id));

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export function techState(tech: TechDef, nm: NationMilitary): 'done' | 'researching' | 'available' | 'locked' {
  if (nm.completed.includes(tech.id)) return 'done';
  if (nm.research.some((s) => s?.tech === tech.id)) return 'researching';
  return tech.requires.every((r) => nm.completed.includes(r)) ? 'available' : 'locked';
}

/** Research cost including the ahead-of-time penalty. */
export function techCost(tech: TechDef, date: string): number {
  const year = Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12;
  const ahead = Math.max(0, tech.year - year);
  return Math.round(tech.cost * (1 + ahead * AHEAD_OF_TIME_PENALTY));
}

/** Research points per slot per month. */
export function researchSpeed(nm: NationMilitary, economy: number): number {
  return 10 * (0.7 + economy / 170) * (1 + techMods(nm.completed).research);
}

export const availableTechs = (nm: NationMilitary) => TECHS.filter((t) => techState(t, nm) === 'available');

/** Multiplier on factory output from research, economy and stability. */
export function productionEfficiency(nm: NationMilitary, economy: number, stability: number): number {
  return (1 + techMods(nm.completed).industry) * (0.7 + economy / 200) * (0.6 + stability / 250);
}

// ---------------------------------------------------------------------------
// Designs lookup
// ---------------------------------------------------------------------------

export function findTank(nm: NationMilitary | undefined, id: string): TankDesign | undefined {
  return nm?.tankDesigns.find((d) => d.id === id) ?? STD_TANKS.find((d) => d.id === id);
}
export function findJet(nm: NationMilitary | undefined, id: string): JetDesign | undefined {
  return nm?.jetDesigns.find((d) => d.id === id) ?? STD_JETS.find((d) => d.id === id);
}
export function allTanks(nm: NationMilitary): TankDesign[] {
  return [...STD_TANKS, ...nm.tankDesigns];
}
export function allJets(nm: NationMilitary): JetDesign[] {
  return [...STD_JETS, ...nm.jetDesigns];
}

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

export interface TankStats {
  soft: number;
  hard: number;
  piercing: number;
  armor: number;
  defense: number;
  breakthrough: number;
  speed: number;
  reliability: number;
  /** IC per tank. */
  cost: number;
}

export interface DesignCheck<S> {
  stats: S;
  errors: string[];
  /** True if every part is unlocked by research. */
  researched: boolean;
  missing: string[];
}

export function tankStats(design: TankDesign, completed: string[] | Set<string> = []): DesignCheck<TankStats> {
  const errors: string[] = [];
  const missing = new Set<string>();
  const ch = TANK_CHASSIS.find((c) => c.id === design.chassis);
  const s: TankStats = { soft: 0, hard: 0, piercing: 0, armor: 0, defense: 0, breakthrough: 0, speed: 0, reliability: 0, cost: 0 };
  if (!ch) return { stats: s, errors: [`Unknown chassis "${design.chassis}"`], researched: false, missing: [] };
  if (!has(completed, ch.requires)) missing.add(ch.requires!);

  let attackPct = 0, hardPct = 0;
  s.soft = ch.soft; s.hard = ch.hard; s.defense = ch.defense; s.breakthrough = ch.breakthrough; s.armor = ch.armor;
  s.speed = ch.speed; s.reliability = ch.reliability; s.cost = ch.cost;
  let specials = 0;
  for (const { slot, kind, label } of TANK_SLOTS) {
    const id = design.modules[slot];
    const isSpecial = kind === 'special';
    if (isSpecial) {
      specials++;
      if (specials > ch.specialSlots) {
        if (id) errors.push(`${ch.name} has only ${ch.specialSlots} special slots`);
        continue;
      }
    }
    if (!id) {
      if (!isSpecial) errors.push(`${label} is required`);
      continue;
    }
    const m = TANK_MODULE_BY_ID.get(id);
    if (!m || m.slot !== kind) { errors.push(`${label}: invalid module "${id}"`); continue; }
    if (m.gunClass && !ch.gunClasses.includes(m.gunClass)) errors.push(`${ch.name} cannot mount the ${m.name}`);
    if (m.chassis && !m.chassis.includes(ch.id)) errors.push(`${m.name} does not fit the ${ch.name}`);
    if (!has(completed, m.requires)) missing.add(m.requires!);
    s.soft += m.soft ?? 0;
    s.hard += m.hard ?? 0;
    s.piercing += m.piercing ?? 0;
    s.armor += (m.armor ?? 0) * (m.slot === 'armor' ? ch.armorMult : 1);
    s.defense += m.defense ?? 0;
    s.breakthrough += m.breakthrough ?? 0;
    s.speed += m.speed ?? 0;
    s.reliability += m.reliability ?? 0;
    s.cost += m.cost;
    attackPct += m.attackPct ?? 0;
    hardPct += m.hardPct ?? 0;
  }
  const specialIds = TANK_SLOTS.filter((x) => x.kind === 'special').map((x) => design.modules[x.slot]).filter(Boolean);
  if (new Set(specialIds).size !== specialIds.length) errors.push('The same special module cannot be fitted twice');
  s.soft *= 1 + attackPct;
  s.hard *= 1 + attackPct + hardPct;
  s.breakthrough += (s.soft + s.hard) * 0.5 + s.armor * 0.1;
  s.defense += s.armor * 0.05;
  s.reliability = Math.min(0.99, Math.max(0.5, s.reliability));
  s.speed = Math.max(3, s.speed);
  return { stats: round(s), errors, researched: missing.size === 0, missing: [...missing] };
}

// ---------------------------------------------------------------------------
// Jets
// ---------------------------------------------------------------------------

export interface JetStats {
  airAttack: number;
  groundAttack: number;
  agility: number;
  speed: number;
  range: number;
  stealth: number;
  detection: number;
  reliability: number;
  /** IC per aircraft. */
  cost: number;
  weaponSlots: number;
}

export function jetStats(design: JetDesign, completed: string[] | Set<string> = []): DesignCheck<JetStats> {
  const errors: string[] = [];
  const missing = new Set<string>();
  const af = AIRFRAME_BY_ID.get(design.airframe);
  const s: JetStats = { airAttack: 0, groundAttack: 0, agility: 0, speed: 0, range: 0, stealth: 0, detection: 0, reliability: 0, cost: 0, weaponSlots: 0 };
  if (!af) return { stats: s, errors: [`Unknown airframe "${design.airframe}"`], researched: false, missing: [] };
  if (!has(completed, af.requires)) missing.add(af.requires!);
  s.airAttack = af.airAttack; s.groundAttack = af.groundAttack; s.agility = af.agility; s.speed = af.speed; s.range = af.range;
  s.stealth = af.stealth; s.reliability = af.reliability; s.cost = af.cost;
  let rangePct = 0, airPct = 0, groundPct = 0, extraWeapons = 0;

  const use = (slot: JetSlot, kind: 'engine' | 'radar' | 'weapon' | 'special', required: boolean, label: string) => {
    const id = design.modules[slot];
    if (!id) { if (required) errors.push(`${label} is required`); return; }
    const m = JET_MODULE_BY_ID.get(id);
    if (!m || m.slot !== kind) { errors.push(`${label}: invalid module "${id}"`); return; }
    if (!has(completed, m.requires)) missing.add(m.requires!);
    s.agility += m.agility ?? 0;
    s.speed += m.speed ?? 0;
    s.stealth += m.stealth ?? 0;
    s.detection += m.detection ?? 0;
    s.airAttack += m.airAttack ?? 0;
    s.groundAttack += m.groundAttack ?? 0;
    s.reliability += m.reliability ?? 0;
    s.cost += m.cost;
    rangePct += m.rangePct ?? 0;
    airPct += m.airPct ?? 0;
    groundPct += m.groundPct ?? 0;
    extraWeapons += m.extraWeapons ?? 0;
  };
  use('engine', 'engine', true, 'Engine');
  use('radar', 'radar', true, 'Radar');
  const specials = JET_SPECIAL_SLOTS.slice(0, af.specialSlots);
  for (const [i, slot] of specials.entries()) use(slot, 'special', false, `Special ${i + 1}`);
  for (const slot of JET_SPECIAL_SLOTS.slice(af.specialSlots)) if (design.modules[slot]) errors.push(`${af.name} has only ${af.specialSlots} special slots`);
  const specialIds = specials.map((x) => design.modules[x]).filter(Boolean);
  if (new Set(specialIds).size !== specialIds.length) errors.push('The same special module cannot be fitted twice');
  if (extraWeapons && !af.stealthy) errors.push('External hardpoints only make sense on a stealth airframe');

  s.weaponSlots = Math.min(JET_WEAPON_SLOTS.length, af.weaponSlots + extraWeapons);
  JET_WEAPON_SLOTS.forEach((slot, i) => {
    if (i < s.weaponSlots) use(slot, 'weapon', false, `Weapon ${i + 1}`);
    else if (design.modules[slot]) errors.push(`${af.name} has only ${s.weaponSlots} weapon slots`);
  });
  if (!JET_WEAPON_SLOTS.some((w) => design.modules[w])) errors.push('Fit at least one weapon');

  s.range *= 1 + rangePct;
  s.airAttack *= 1 + airPct;
  s.groundAttack *= 1 + groundPct;
  s.stealth = Math.max(0, Math.min(100, s.stealth));
  s.agility = Math.max(10, s.agility);
  s.reliability = Math.min(0.99, Math.max(0.5, s.reliability));
  return { stats: round(s), errors, researched: missing.size === 0, missing: [...missing] };
}

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export interface DivisionStats {
  width: number;
  manpower: number;
  hp: number;
  org: number;
  soft: number;
  hard: number;
  defense: number;
  breakthrough: number;
  armor: number;
  piercing: number;
  hardness: number;
  speed: number;
  airAttack: number;
  /** Soft attack contributed by artillery battalions (for counter-battery). */
  artillerySoft: number;
  effects: Record<DivisionEffect, number>;
  equipment: Record<string, number>;
  /** Total IC value of the full equipment set. */
  cost: number;
  combatBattalions: number;
}

const ZERO_EFFECTS: Record<DivisionEffect, number> = {
  initiative: 0, attack: 0, defense: 0, terrain: 0, entrench: 0, recovery: 0, enemyAttack: 0, enemyArtillery: 0, casualties: 0, amphibious: 0,
};

export function equipmentCost(item: string, nm: NationMilitary | undefined): number {
  if (item.startsWith('tank:')) {
    const d = findTank(nm, item.slice(5));
    return d ? tankStats(d).stats.cost : 10;
  }
  if (item.startsWith('jet:')) {
    const d = findJet(nm, item.slice(4));
    return d ? jetStats(d).stats.cost : 30;
  }
  return EQUIPMENT_BY_ID.get(item)?.cost ?? 1;
}

export function equipmentName(item: string, nm: NationMilitary | undefined): string {
  if (item.startsWith('tank:')) return findTank(nm, item.slice(5))?.name ?? 'Unknown tank';
  if (item.startsWith('jet:')) return findJet(nm, item.slice(4))?.name ?? 'Unknown aircraft';
  return EQUIPMENT_BY_ID.get(item)?.name ?? item;
}

export function divisionStats(tpl: DivisionTemplate, nm: NationMilitary | undefined, mods?: Mods): DivisionStats & { errors: string[] } {
  const errors: string[] = [];
  const m = mods ?? techMods(nm?.completed ?? []);
  const completed = nm?.completed ?? [];
  const s: DivisionStats = {
    width: 0, manpower: 0, hp: 0, org: 0, soft: 0, hard: 0, defense: 0, breakthrough: 0, armor: 0, piercing: 0, hardness: 0,
    speed: 99, airAttack: 0, artillerySoft: 0, effects: { ...ZERO_EFFECTS }, equipment: {}, cost: 0, combatBattalions: 0,
  };
  const addEq = (item: string, n: number) => { s.equipment[item] = (s.equipment[item] ?? 0) + n; };
  let orgSum = 0, hardSum = 0;
  const armors: number[] = [], pierces: number[] = [];

  if (tpl.combat.length !== GRID_COLS * GRID_ROWS) errors.push('Combat grid must have 25 slots');
  if (tpl.support.length > SUPPORT_SLOTS) errors.push(`At most ${SUPPORT_SLOTS} support companies`);

  for (const slot of tpl.combat) {
    if (!slot) continue;
    const def = BATTALION_BY_ID.get(slot.type);
    if (!def || def.kind !== 'combat') { errors.push(`Unknown battalion "${slot.type}"`); continue; }
    if (!has(completed, def.requires)) errors.push(`${def.name} needs ${TECH_BY_ID.get(def.requires!)?.name}`);
    let soft = def.soft, hard = def.hard, defense = def.defense, bt = def.breakthrough, armor = def.armor, pierce = def.piercing, speed = def.speed;
    if (def.usesTank) {
      const design = slot.design ? findTank(nm, slot.design) : undefined;
      if (!design) { errors.push('Armored battalion needs a tank design'); continue; }
      const ts = tankStats(design, completed);
      soft = ts.stats.soft; hard = ts.stats.hard; defense = ts.stats.defense; bt = ts.stats.breakthrough;
      armor = ts.stats.armor; pierce = ts.stats.piercing; speed = ts.stats.speed;
      addEq(`tank:${design.id}`, def.tanks ?? 40);
      bt *= 1 + m.breakthrough;
    }
    if (def.group === 'infantry') { soft *= 1 + m.inf_soft; hard *= 1 + m.inf_hard; defense *= 1 + m.inf_def; pierce *= 1 + m.inf_pierce; }
    if (def.group === 'artillery') { soft *= 1 + m.art_soft; hard *= 1 + m.art_hard; s.artillerySoft += soft; }
    for (const [item, n] of Object.entries(def.equipment)) addEq(item, n);
    s.width += def.width;
    s.manpower += def.manpower;
    s.hp += def.hp;
    orgSum += def.org;
    s.soft += soft;
    s.hard += hard;
    s.defense += defense;
    s.breakthrough += bt;
    s.airAttack += def.airAttack * (1 + m.air_defense);
    hardSum += def.hardness;
    armors.push(armor);
    pierces.push(pierce);
    s.speed = Math.min(s.speed, speed);
    s.combatBattalions++;
  }
  const seen = new Set<string>();
  for (const id of tpl.support) {
    if (!id) continue;
    const def = BATTALION_BY_ID.get(id);
    if (!def || def.kind !== 'support') { errors.push(`Unknown support company "${id}"`); continue; }
    if (seen.has(id)) { errors.push(`${def.name} can only be attached once`); continue; }
    seen.add(id);
    if (!has(completed, def.requires)) errors.push(`${def.name} needs ${TECH_BY_ID.get(def.requires!)?.name}`);
    for (const [item, n] of Object.entries(def.equipment)) addEq(item, n);
    s.manpower += def.manpower;
    s.hp += def.hp;
    s.soft += def.soft;
    s.hard += def.hard;
    s.defense += def.defense;
    s.breakthrough += def.breakthrough;
    s.airAttack += def.airAttack * (1 + m.air_defense);
    pierces.push(def.piercing * 0.5);
    for (const [k, v] of Object.entries(def.effects ?? {})) s.effects[k as DivisionEffect] += v ?? 0;
  }
  if (s.combatBattalions === 0) errors.push('A division needs at least one combat battalion');
  const n = Math.max(1, s.combatBattalions);
  s.org = (orgSum / n) * (1 + m.org);
  s.hardness = hardSum / n;
  const weighted = (xs: number[]) => (xs.length ? 0.4 * Math.max(...xs) + 0.6 * (xs.reduce((a, x) => a + x, 0) / xs.length) : 0);
  s.armor = weighted(armors.slice(0, s.combatBattalions));
  s.piercing = weighted(pierces);
  s.soft *= 1 + m.attack + s.effects.attack;
  s.hard *= 1 + m.attack + s.effects.attack;
  s.defense *= 1 + m.defense + s.effects.defense;
  s.breakthrough *= 1 + m.attack;
  s.effects.initiative += m.recon;
  s.effects.entrench += m.entrench;
  s.effects.recovery += m.recovery;
  if (s.speed === 99) s.speed = 0;
  s.cost = Object.entries(s.equipment).reduce((a, [item, k]) => a + k * equipmentCost(item, nm), 0);
  if (s.width > 40) errors.push('Combat width cannot exceed 40');
  return { ...round(s), effects: s.effects, equipment: s.equipment, errors };
}

function round<T extends object>(o: T): T {
  const out = { ...o } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (typeof v === 'number') out[k] = Math.round(v * 100) / 100;
  return out as T;
}

/** Is everything a design/template needs researched? */
export const tankUnlocked = (d: TankDesign, completed: string[]) => tankStats(d, completed).researched;
export const jetUnlocked = (d: JetDesign, completed: string[]) => jetStats(d, completed).researched;
