/**
 * Static military catalog: research tree, battalions, support companies, equipment,
 * tank chassis/modules and jet airframes/modules.
 *
 * Shared by server (simulation) and client (designers + previews) so that the stats
 * the player sees while designing are exactly what the combat engine uses.
 *
 * All numbers are original to Pax History and tuned for monthly turns.
 */
import type { DivisionTemplate, JetDesign, JetSlot, ModKey, TankDesign, TankSlot, TechDef } from '../types';

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

const t = (
  id: string, name: string, category: TechDef['category'], year: number, cost: number, requires: string[], desc: string,
  mods?: Partial<Record<ModKey, number>>,
): TechDef => ({ id, name, category, year, cost, requires, desc, mods });

export const TECHS: TechDef[] = [
  // Infantry
  t('inf_digital', 'Digital Soldier Systems', 'infantry', 2020, 30, [], 'Networked radios, GPS and battle-management tablets down to squad level.', { inf_soft: 0.1 }),
  t('inf_mech', 'Modern Infantry Fighting Vehicles', 'infantry', 2020, 30, [], 'Unlocks Mechanized Infantry battalions.'),
  t('inf_special', 'Special Operations Forces', 'infantry', 2020, 30, [], 'Unlocks Special Forces battalions.'),
  t('inf_nvg', 'Thermal Night Optics', 'infantry', 2022, 35, ['inf_digital'], 'Every rifleman fights at night.', { inf_soft: 0.1, inf_def: 0.05 }),
  t('inf_atgm', 'Fire-and-Forget Anti-Tank Missiles', 'infantry', 2023, 40, ['inf_digital'], 'Top-attack missiles in every platoon.', { inf_hard: 0.35, inf_pierce: 0.25 }),
  t('inf_manpads', 'Next-Gen Shoulder-Fired Air Defense', 'infantry', 2024, 35, ['inf_nvg'], 'Infantry can shoot down drones and helicopters.', { air_defense: 0.2 }),
  t('inf_air_assault', 'Air Assault Doctrine', 'infantry', 2021, 35, ['inf_special'], 'Unlocks Air Assault battalions.'),
  t('inf_exo', 'Load-Bearing Exoskeletons', 'infantry', 2031, 60, ['inf_nvg'], 'Soldiers carry more and tire less.', { inf_def: 0.1, org: 0.05 }),
  t('inf_robot', 'Robotic Combat Teams', 'infantry', 2034, 80, ['inf_exo', 'inf_atgm'], 'Unmanned ground vehicles fight alongside infantry.', { inf_soft: 0.15, inf_def: 0.1 }),

  // Armor
  t('tank_gun_120', '120mm Smoothbore Guns', 'armor', 2020, 30, [], 'Unlocks the 120mm gun and 125mm autoloader.'),
  t('tank_armor_composite', 'Composite Armor Arrays', 'armor', 2020, 30, [], 'Unlocks composite armor.'),
  t('tank_eng_turbine', 'Gas Turbine Powerpacks', 'armor', 2020, 25, [], 'Unlocks the gas turbine engine.'),
  t('tank_fcs_digital', 'Hunter-Killer Fire Control', 'armor', 2021, 30, [], 'Unlocks the digital hunter-killer fire control system.'),
  t('tank_armor_era', 'Heavy Reactive Armor', 'armor', 2022, 40, ['tank_armor_composite'], 'Unlocks composite + heavy ERA.'),
  t('tank_aps', 'Active Protection Systems', 'armor', 2024, 45, ['tank_fcs_digital'], 'Unlocks soft-kill APS.'),
  t('tank_turret_unmanned', 'Unmanned Turrets', 'armor', 2027, 55, ['tank_fcs_digital', 'tank_aps'], 'Unlocks the unmanned turret with crew capsule.'),
  t('tank_gun_130', '130mm High-Pressure Guns', 'armor', 2028, 55, ['tank_gun_120'], 'Unlocks the 130mm gun.'),
  t('tank_eng_hybrid', 'Hybrid-Electric Drive', 'armor', 2029, 55, ['tank_eng_turbine'], 'Unlocks the hybrid-electric powerpack.'),
  t('tank_aps2', 'Hard-Kill APS (Gen 2)', 'armor', 2030, 65, ['tank_aps'], 'Unlocks hard-kill APS that defeats top-attack munitions.'),
  t('tank_chassis_next', 'Next-Generation MBT Chassis', 'armor', 2030, 75, ['tank_turret_unmanned', 'tank_armor_era'], 'Unlocks the next-gen heavy MBT chassis.'),
  t('tank_armor_nano', 'Nanoceramic Modular Armor', 'armor', 2031, 70, ['tank_armor_era'], 'Unlocks nanoceramic armor.'),
  t('tank_gun_140', '140mm Electrothermal Guns', 'armor', 2034, 80, ['tank_gun_130'], 'Unlocks the 140mm electrothermal gun (next-gen chassis only).'),

  // Artillery & air defense
  t('art_mlrs', 'Long-Range Rocket Systems', 'artillery', 2021, 30, [], 'Unlocks Rocket Artillery battalions.'),
  t('art_counter', 'Counter-Battery Radar', 'artillery', 2021, 30, [], 'Unlocks Counter-Battery support companies.'),
  t('art_guided', 'Guided Artillery Shells', 'artillery', 2022, 35, [], 'Precision rounds: fewer shells, more effect.', { art_soft: 0.2 }),
  t('art_ad', 'Layered Air Defense', 'artillery', 2022, 35, [], 'Integrated short- and medium-range air defense.', { air_defense: 0.3 }),
  t('art_loiter', 'Loitering Munitions', 'artillery', 2024, 45, ['art_guided'], 'Unlocks Loitering Munition companies.', { art_hard: 0.15 }),
  t('art_extended', 'Extended-Range Cannons', 'artillery', 2027, 50, ['art_guided'], 'Longer barrels, base-bleed and ramjet shells.', { art_soft: 0.2, art_hard: 0.1 }),
  t('art_laser', 'Directed-Energy Air Defense', 'artillery', 2032, 70, ['art_ad'], 'Lasers burn drones out of the sky for pennies a shot.', { air_defense: 0.5 }),

  // Air
  t('jet_gen4', '4th-Generation Airframes', 'air', 2020, 25, [], 'Unlocks light fighter, multirole and strike fighter airframes.'),
  t('missile_bvr', 'Beyond-Visual-Range Missiles', 'air', 2020, 25, [], 'Unlocks BVR air-to-air missiles.'),
  t('jet_eng_improved', 'Improved Turbofans', 'air', 2021, 30, [], 'Unlocks improved afterburning turbofans.'),
  t('jet_gen45', '4.5-Generation Airframes', 'air', 2022, 40, ['jet_gen4'], 'Unlocks the advanced multirole airframe.'),
  t('radar_aesa', 'AESA Radar', 'air', 2022, 35, [], 'Unlocks AESA radar.'),
  t('ew_suite', 'Integrated EW Suites', 'air', 2022, 35, [], 'Unlocks the integrated electronic warfare suite.'),
  t('ucav', 'Combat Drones', 'air', 2023, 40, [], 'Unlocks the UCAV airframe.'),
  t('stealth_ram', 'Radar-Absorbent Coatings', 'air', 2024, 45, ['jet_gen45'], 'Unlocks RAM coating.'),
  t('missile_ramjet', 'Ramjet BVR Missiles', 'air', 2025, 45, ['missile_bvr'], 'Unlocks ramjet BVR missiles with a huge no-escape zone.'),
  t('jet_gen5', '5th-Generation Stealth Airframes', 'air', 2026, 70, ['jet_gen45'], 'Unlocks the stealth fighter airframe.'),
  t('jet_eng_supercruise', 'Supercruise Engines', 'air', 2026, 55, ['jet_eng_improved'], 'Unlocks supercruise engines.'),
  t('radar_gan', 'Gallium-Nitride AESA', 'air', 2028, 55, ['radar_aesa'], 'Unlocks GaN AESA radar.'),
  t('missile_hypersonic', 'Hypersonic Strike Missiles', 'air', 2029, 70, ['missile_ramjet'], 'Unlocks air-launched hypersonic missiles.'),
  t('drone_swarm', 'Autonomous Drone Swarms', 'air', 2030, 65, ['ucav'], 'Swarms saturate enemy defenses.', { air_ground: 0.2 }),
  t('jet_eng_adaptive', 'Adaptive-Cycle Engines', 'air', 2032, 75, ['jet_eng_supercruise'], 'Unlocks adaptive-cycle engines.'),
  t('jet_gen6', '6th-Generation Adaptive Airframes', 'air', 2034, 100, ['jet_gen5', 'jet_eng_adaptive'], 'Unlocks the 6th-gen airframe.'),

  // Doctrine
  t('doc_combined', 'Combined Arms Manoeuvre', 'doctrine', 2020, 30, [], 'Tanks, infantry and fires move as one.', { breakthrough: 0.1 }),
  t('doc_depth', 'Defense in Depth', 'doctrine', 2020, 30, [], 'Layered positions trade space for time.', { defense: 0.1, entrench: 0.25 }),
  t('doc_mission', 'Mission Command', 'doctrine', 2022, 40, ['doc_combined'], 'Junior officers act on intent, not orders.', { org: 0.1 }),
  t('doc_air_land', 'Air-Land Battle', 'doctrine', 2023, 40, ['doc_combined'], 'Close air support integrated at brigade level.', { air_support: 0.25 }),
  t('doc_network', 'Network-Centric Warfare', 'doctrine', 2025, 50, ['doc_mission'], 'Every sensor feeds every shooter.', { attack: 0.1, recon: 0.1 }),
  t('doc_drone_war', 'Drone-Saturated Battlefield', 'doctrine', 2026, 55, ['art_loiter'], 'FPV drones everywhere: nothing moves unseen.', { attack: 0.05, defense: 0.05, recon: 0.15 }),
  t('doc_attrition', 'Attritional Fire Doctrine', 'doctrine', 2024, 45, ['doc_depth'], 'Grind the enemy down with massed fires.', { art_soft: 0.15, defense: 0.05 }),
  t('doc_mosaic', 'Mosaic Warfare', 'doctrine', 2033, 85, ['doc_network'], 'Swarms of cheap, recombinable units overwhelm the enemy.', { attack: 0.15, org: 0.1 }),

  // Industry
  t('ind_lean', 'Lean Defense Production', 'industry', 2020, 25, [], 'Streamlined defense contracting.', { industry: 0.1 }),
  t('ind_reserves', 'Reservist Mobilization System', 'industry', 2020, 25, [], 'Call up trained reserves faster.', { manpower: 0.25 }),
  t('ind_automation', 'Automated Assembly Lines', 'industry', 2024, 45, ['ind_lean'], 'Robotic welding and assembly.', { industry: 0.1 }),
  t('ind_ai_research', 'AI-Assisted R&D', 'industry', 2026, 50, [], 'Machine learning speeds up every lab.', { research: 0.15 }),
  t('ind_additive', 'Additive Manufacturing', 'industry', 2027, 60, ['ind_automation'], '3D-printed parts at the front and in the factory.', { industry: 0.15 }),
  t('ind_ai_logistics', 'AI Logistics', 'industry', 2028, 55, ['ind_ai_research'], 'Predictive supply keeps units fighting.', { recovery: 0.25 }),
];
export const TECH_BY_ID = new Map(TECHS.map((x) => [x.id, x]));

/** Base research points generated per slot per month (before economy and tech modifiers). */
export const RP_PER_SLOT = 10;
/** Extra cost per year a tech is researched ahead of its year. */
export const AHEAD_OF_TIME_PENALTY = 0.5;

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export interface EquipmentDef {
  id: string;
  name: string;
  /** Industry points (IC) per unit. */
  cost: number;
  requires?: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'small_arms', name: 'Infantry Equipment', cost: 0.4 },
  { id: 'trucks', name: 'Trucks & Light Vehicles', cost: 1.2 },
  { id: 'ifv', name: 'Infantry Fighting Vehicles', cost: 6, requires: 'inf_mech' },
  { id: 'artillery', name: 'Self-Propelled Guns', cost: 6 },
  { id: 'rocket_launchers', name: 'Rocket Launchers', cost: 8, requires: 'art_mlrs' },
  { id: 'atgm', name: 'Anti-Tank Missile Launchers', cost: 2 },
  { id: 'air_defense', name: 'Air Defense Systems', cost: 10 },
  { id: 'drones', name: 'Drones', cost: 1.5 },
  { id: 'helicopters', name: 'Helicopters', cost: 25 },
  { id: 'support_gear', name: 'Support Equipment', cost: 1 },
];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));

/** Industry points produced by one factory per month (before modifiers). */
export const IC_PER_FACTORY = 15;

// ---------------------------------------------------------------------------
// Battalions and support companies
// ---------------------------------------------------------------------------

export interface BattalionDef {
  id: string;
  name: string;
  short: string;
  kind: 'combat' | 'support';
  /** Which research modifiers apply. */
  group: 'infantry' | 'armor' | 'artillery' | 'air_defense' | 'support';
  requires?: string;
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
  equipment: Record<string, number>;
  /** Tank battalions take most combat stats from the chosen tank design. */
  usesTank?: boolean;
  /** Tanks per battalion. */
  tanks?: number;
  /** Division-wide effects (support companies). */
  effects?: Partial<Record<DivisionEffect, number>>;
  desc: string;
}

export type DivisionEffect =
  | 'initiative' | 'attack' | 'defense' | 'terrain' | 'entrench' | 'recovery' | 'enemyAttack' | 'enemyArtillery' | 'casualties' | 'amphibious';

const b = (d: Omit<BattalionDef, 'armor' | 'airAttack' | 'hardness'> & Partial<Pick<BattalionDef, 'armor' | 'airAttack' | 'hardness'>>): BattalionDef => ({
  armor: 0, airAttack: 0, hardness: 0, ...d,
});

export const BATTALIONS: BattalionDef[] = [
  b({ id: 'infantry', name: 'Infantry', short: 'INF', kind: 'combat', group: 'infantry', width: 2, manpower: 900, hp: 25, org: 60,
    soft: 6, hard: 3, defense: 24, breakthrough: 3, piercing: 40, speed: 4, airAttack: 1, equipment: { small_arms: 100, atgm: 6 },
    desc: 'Cheap, tough on defense, holds ground.' }),
  b({ id: 'motorized', name: 'Motorized Infantry', short: 'MOT', kind: 'combat', group: 'infantry', width: 2, manpower: 900, hp: 25, org: 60,
    soft: 6, hard: 3, defense: 23, breakthrough: 4, piercing: 40, hardness: 0.1, speed: 9, airAttack: 1,
    equipment: { small_arms: 100, atgm: 6, trucks: 35 }, desc: 'Infantry on wheels: same punch, twice the speed.' }),
  b({ id: 'mechanized', name: 'Mechanized Infantry', short: 'MECH', kind: 'combat', group: 'infantry', requires: 'inf_mech', width: 2, manpower: 900,
    hp: 30, org: 55, soft: 10, hard: 5, defense: 30, breakthrough: 10, armor: 25, piercing: 60, hardness: 0.6, speed: 9, airAttack: 2,
    equipment: { small_arms: 80, atgm: 6, ifv: 40 }, desc: 'Infantry in armored fighting vehicles. Keeps up with tanks.' }),
  b({ id: 'special_forces', name: 'Special Forces', short: 'SOF', kind: 'combat', group: 'infantry', requires: 'inf_special', width: 2, manpower: 500,
    hp: 20, org: 75, soft: 9, hard: 4, defense: 28, breakthrough: 8, piercing: 50, speed: 5, airAttack: 1,
    equipment: { small_arms: 80, atgm: 8, support_gear: 30 }, desc: 'Elite, high organisation, expensive to replace.' }),
  b({ id: 'air_assault', name: 'Air Assault', short: 'AASLT', kind: 'combat', group: 'infantry', requires: 'inf_air_assault', width: 2, manpower: 800,
    hp: 22, org: 65, soft: 7, hard: 3, defense: 22, breakthrough: 6, piercing: 40, speed: 12, airAttack: 1,
    equipment: { small_arms: 90, atgm: 6, helicopters: 8 }, desc: 'Helicopter-borne infantry. Fast, light, hard-hitting.' }),
  b({ id: 'marines', name: 'Marines', short: 'MAR', kind: 'combat', group: 'infantry', width: 2, manpower: 900, hp: 25, org: 65,
    soft: 7, hard: 3, defense: 24, breakthrough: 5, armor: 5, piercing: 45, hardness: 0.2, speed: 5, airAttack: 1,
    equipment: { small_arms: 100, atgm: 6, ifv: 10 }, effects: { amphibious: 0.6 }, desc: 'Amphibious specialists: shrug off most of the naval-landing penalty.' }),
  b({ id: 'armored', name: 'Armored', short: 'ARM', kind: 'combat', group: 'armor', width: 2, manpower: 400, hp: 8, org: 15,
    soft: 0, hard: 0, defense: 0, breakthrough: 0, piercing: 0, hardness: 0.9, speed: 0, airAttack: 1, equipment: {}, usesTank: true, tanks: 40,
    desc: 'Main battle tanks. Stats come from the tank design you pick.' }),
  b({ id: 'sp_artillery', name: 'Self-Propelled Artillery', short: 'ART', kind: 'combat', group: 'artillery', width: 3, manpower: 500,
    hp: 2, org: 0, soft: 28, hard: 3, defense: 8, breakthrough: 3, armor: 10, piercing: 15, hardness: 0.5, speed: 7,
    equipment: { artillery: 18, trucks: 10 }, desc: 'The god of war. Huge soft attack, no organisation of its own.' }),
  b({ id: 'rocket_artillery', name: 'Rocket Artillery', short: 'MLRS', kind: 'combat', group: 'artillery', requires: 'art_mlrs', width: 3, manpower: 400,
    hp: 2, org: 0, soft: 38, hard: 5, defense: 5, breakthrough: 3, piercing: 20, hardness: 0.4, speed: 8,
    equipment: { rocket_launchers: 12, trucks: 10 }, desc: 'Precision rockets that hit deep. Even more soft attack.' }),
  b({ id: 'anti_tank', name: 'Anti-Tank Missiles', short: 'AT', kind: 'combat', group: 'artillery', width: 1, manpower: 300,
    hp: 4, org: 0, soft: 2, hard: 24, defense: 6, breakthrough: 2, piercing: 140, hardness: 0.2, speed: 6,
    equipment: { atgm: 36, trucks: 8 }, desc: 'Raises the division\'s piercing so enemy tanks lose their armor advantage.' }),
  b({ id: 'air_defense', name: 'Air Defense', short: 'AD', kind: 'combat', group: 'air_defense', width: 1, manpower: 300,
    hp: 2, org: 0, soft: 2, hard: 6, defense: 5, breakthrough: 1, piercing: 30, hardness: 0.3, speed: 7, airAttack: 30,
    equipment: { air_defense: 12 }, desc: 'Shoots down enemy aircraft and blunts close air support.' }),

  // Support companies (width 0)
  b({ id: 'recon_drones', name: 'Recon Drone Company', short: 'RECON', kind: 'support', group: 'support', width: 0, manpower: 150,
    hp: 1, org: 0, soft: 1, hard: 0, defense: 1, breakthrough: 1, piercing: 0, speed: 0, equipment: { drones: 20 },
    effects: { initiative: 0.15, attack: 0.05 }, desc: '+15% initiative, +5% attack: you see them first.' }),
  b({ id: 'engineers', name: 'Combat Engineers', short: 'ENG', kind: 'support', group: 'support', width: 0, manpower: 300,
    hp: 2, org: 0, soft: 1, hard: 0, defense: 6, breakthrough: 2, piercing: 0, speed: 0, equipment: { support_gear: 25, trucks: 5 },
    effects: { defense: 0.1, terrain: 0.3, entrench: 0.25 }, desc: '+10% defense, -30% terrain penalty, digs in faster.' }),
  b({ id: 'signals_ew', name: 'Signals & EW Company', short: 'EW', kind: 'support', group: 'support', width: 0, manpower: 150,
    hp: 1, org: 0, soft: 0, hard: 0, defense: 1, breakthrough: 0, piercing: 0, speed: 0, equipment: { support_gear: 25, drones: 5 },
    effects: { initiative: 0.1, enemyAttack: -0.07 }, desc: 'Jams enemy coordination: enemy attack -7%.' }),
  b({ id: 'logistics', name: 'Logistics Company', short: 'LOG', kind: 'support', group: 'support', width: 0, manpower: 300,
    hp: 1, org: 0, soft: 0, hard: 0, defense: 1, breakthrough: 0, piercing: 0, speed: 0, equipment: { trucks: 30 },
    effects: { recovery: 0.3 }, desc: '+30% organisation recovery and faster reinforcement.' }),
  b({ id: 'counter_battery', name: 'Counter-Battery Company', short: 'CB', kind: 'support', group: 'support', requires: 'art_counter', width: 0,
    manpower: 150, hp: 1, org: 0, soft: 2, hard: 0, defense: 1, breakthrough: 0, piercing: 0, speed: 0, equipment: { support_gear: 15, artillery: 2 },
    effects: { enemyArtillery: -0.25 }, desc: 'Enemy artillery attack -25%.' }),
  b({ id: 'field_hospital', name: 'Field Hospital', short: 'MED', kind: 'support', group: 'support', width: 0, manpower: 200,
    hp: 1, org: 0, soft: 0, hard: 0, defense: 0, breakthrough: 0, piercing: 0, speed: 0, equipment: { support_gear: 10, trucks: 5 },
    effects: { casualties: -0.35 }, desc: '-35% casualties.' }),
  b({ id: 'loitering_munitions', name: 'Loitering Munition Company', short: 'LM', kind: 'support', group: 'support', requires: 'art_loiter', width: 0,
    manpower: 150, hp: 1, org: 0, soft: 6, hard: 8, defense: 1, breakthrough: 2, piercing: 90, speed: 0, equipment: { drones: 30 },
    desc: 'Kamikaze drones: +6 soft, +8 hard attack.' }),
  b({ id: 'shorad', name: 'SHORAD Company', short: 'SHO', kind: 'support', group: 'air_defense', width: 0, manpower: 150,
    hp: 1, org: 0, soft: 1, hard: 1, defense: 1, breakthrough: 0, piercing: 10, speed: 0, airAttack: 12, equipment: { air_defense: 4 },
    desc: 'Short-range air defense attached at division level.' }),
];
export const BATTALION_BY_ID = new Map(BATTALIONS.map((x) => [x.id, x]));

export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const SUPPORT_SLOTS = 5;

// ---------------------------------------------------------------------------
// Tank designer
// ---------------------------------------------------------------------------

export interface TankChassisDef {
  id: string;
  name: string;
  requires?: string;
  soft: number;
  hard: number;
  defense: number;
  breakthrough: number;
  armor: number;
  armorMult: number;
  speed: number;
  reliability: number;
  cost: number;
  specialSlots: number;
  /** Gun module ids this chassis can mount (by gun class). */
  gunClasses: GunClass[];
  desc: string;
}
export type GunClass = 'light' | 'medium' | 'heavy' | 'super';

export const TANK_CHASSIS: TankChassisDef[] = [
  { id: 'wheeled', name: 'Wheeled Fire-Support Vehicle', soft: 2, hard: 1, defense: 4, breakthrough: 8, armor: 15, armorMult: 0.3,
    speed: 16, reliability: 0.93, cost: 4, specialSlots: 2, gunClasses: ['light', 'medium'], desc: 'Fast and cheap, paper-thin.' },
  { id: 'light', name: 'Light Tank', soft: 2, hard: 2, defense: 5, breakthrough: 10, armor: 25, armorMult: 0.5,
    speed: 13, reliability: 0.9, cost: 5, specialSlots: 2, gunClasses: ['light', 'medium'], desc: 'Air-mobile and agile.' },
  { id: 'mbt', name: 'Main Battle Tank', soft: 3, hard: 3, defense: 7, breakthrough: 14, armor: 60, armorMult: 1,
    speed: 10, reliability: 0.86, cost: 9, specialSlots: 3, gunClasses: ['light', 'medium', 'heavy'], desc: 'The backbone of every armored force.' },
  { id: 'mbt_next', name: 'Next-Gen Heavy MBT', requires: 'tank_chassis_next', soft: 4, hard: 4, defense: 9, breakthrough: 18, armor: 80, armorMult: 1.2,
    speed: 9, reliability: 0.82, cost: 14, specialSlots: 4, gunClasses: ['medium', 'heavy', 'super'], desc: 'Heavier, smarter, deadlier, pricier.' },
];

export interface TankModuleDef {
  id: string;
  name: string;
  slot: 'gun' | 'turret' | 'engine' | 'armor' | 'fcs' | 'special';
  requires?: string;
  gunClass?: GunClass;
  soft?: number;
  hard?: number;
  piercing?: number;
  armor?: number;
  defense?: number;
  breakthrough?: number;
  speed?: number;
  reliability?: number;
  /** Fractional multiplier on soft & hard attack. */
  attackPct?: number;
  hardPct?: number;
  cost: number;
  /** Only allowed on these chassis. */
  chassis?: string[];
  desc?: string;
}

export const TANK_MODULES: TankModuleDef[] = [
  // Guns
  { id: 'gun_30mm', name: '30mm Autocannon', slot: 'gun', gunClass: 'light', soft: 10, hard: 4, piercing: 50, cost: 1, desc: 'Shreds infantry, tickles tanks.' },
  { id: 'gun_105', name: '105mm Rifled Gun', slot: 'gun', gunClass: 'medium', soft: 8, hard: 14, piercing: 85, cost: 2 },
  { id: 'gun_120', name: '120mm Smoothbore', slot: 'gun', gunClass: 'heavy', requires: 'tank_gun_120', soft: 10, hard: 22, piercing: 115, cost: 3 },
  { id: 'gun_125al', name: '125mm Autoloaded Gun', slot: 'gun', gunClass: 'heavy', requires: 'tank_gun_120', soft: 11, hard: 21, piercing: 110, reliability: -0.02, cost: 2.6, desc: 'Cheaper, three-man crew.' },
  { id: 'gun_130', name: '130mm High-Pressure Gun', slot: 'gun', gunClass: 'heavy', requires: 'tank_gun_130', soft: 12, hard: 28, piercing: 145, speed: -1, cost: 4.5 },
  { id: 'gun_140', name: '140mm Electrothermal Gun', slot: 'gun', gunClass: 'super', requires: 'tank_gun_140', soft: 14, hard: 35, piercing: 175, speed: -1, cost: 6.5 },
  // Turrets
  { id: 'turret_manned', name: 'Three-Man Turret', slot: 'turret', defense: 4, cost: 1 },
  { id: 'turret_autoloader', name: 'Autoloader Turret', slot: 'turret', defense: 3, hardPct: 0.1, reliability: -0.02, cost: 1.3, desc: '+10% hard attack (rate of fire).' },
  { id: 'turret_unmanned', name: 'Unmanned Turret + Crew Capsule', slot: 'turret', requires: 'tank_turret_unmanned', defense: 7, armor: 10, cost: 2.2 },
  // Engines
  { id: 'eng_diesel_1200', name: '1,200 hp Diesel', slot: 'engine', speed: 0, reliability: 0.04, cost: 1 },
  { id: 'eng_diesel_1500', name: '1,500 hp Diesel', slot: 'engine', speed: 2, reliability: 0.01, cost: 1.5 },
  { id: 'eng_turbine', name: '1,500 hp Gas Turbine', slot: 'engine', requires: 'tank_eng_turbine', speed: 3, breakthrough: 2, reliability: -0.04, cost: 2 },
  { id: 'eng_hybrid', name: 'Hybrid-Electric Drive', slot: 'engine', requires: 'tank_eng_hybrid', speed: 3, defense: 2, reliability: 0.03, cost: 3 },
  // Armor
  { id: 'armor_steel', name: 'Rolled Steel', slot: 'armor', armor: 0, cost: 0.5 },
  { id: 'armor_composite', name: 'Composite Arrays', slot: 'armor', requires: 'tank_armor_composite', armor: 30, speed: -1, cost: 2 },
  { id: 'armor_era', name: 'Composite + Heavy ERA', slot: 'armor', requires: 'tank_armor_era', armor: 45, speed: -1, cost: 2.8 },
  { id: 'armor_nano', name: 'Nanoceramic Modular Armor', slot: 'armor', requires: 'tank_armor_nano', armor: 65, speed: -1, cost: 4.5 },
  // Fire control
  { id: 'fcs_analog', name: 'Analog Fire Control', slot: 'fcs', cost: 0.3 },
  { id: 'fcs_thermal', name: 'Thermal Sights', slot: 'fcs', attackPct: 0.1, cost: 1 },
  { id: 'fcs_hunter', name: 'Hunter-Killer Digital FCS', slot: 'fcs', requires: 'tank_fcs_digital', attackPct: 0.18, defense: 3, cost: 2 },
  // Specials
  { id: 'sp_rws', name: 'Remote Weapon Station', slot: 'special', soft: 5, cost: 0.6 },
  { id: 'sp_atgm', name: 'Gun-Launched ATGM', slot: 'special', hard: 6, piercing: 10, cost: 1.2 },
  { id: 'sp_aps_soft', name: 'Soft-Kill APS', slot: 'special', requires: 'tank_aps', armor: 8, defense: 5, cost: 1 },
  { id: 'sp_aps_hard', name: 'Hard-Kill APS', slot: 'special', requires: 'tank_aps2', armor: 20, defense: 8, cost: 2.5 },
  { id: 'sp_cage', name: 'Anti-Drone Cage Armor', slot: 'special', defense: 3, armor: 3, speed: -0.5, cost: 0.2, desc: 'Ugly, cheap, saves crews.' },
  { id: 'sp_tether_drone', name: 'Tethered Recon Drone', slot: 'special', requires: 'art_loiter', attackPct: 0.06, breakthrough: 3, cost: 0.8 },
  { id: 'sp_mine_plow', name: 'Mine Plow', slot: 'special', breakthrough: 5, speed: -0.5, cost: 0.4 },
  { id: 'sp_smoke', name: 'Multispectral Smoke Launchers', slot: 'special', defense: 2, cost: 0.2 },
];
export const TANK_MODULE_BY_ID = new Map(TANK_MODULES.map((x) => [x.id, x]));
export const TANK_SLOTS: { slot: TankSlot; kind: TankModuleDef['slot']; label: string }[] = [
  { slot: 'gun', kind: 'gun', label: 'Main armament' },
  { slot: 'turret', kind: 'turret', label: 'Turret' },
  { slot: 'engine', kind: 'engine', label: 'Engine' },
  { slot: 'armor', kind: 'armor', label: 'Armor' },
  { slot: 'fcs', kind: 'fcs', label: 'Fire control' },
  { slot: 'special1', kind: 'special', label: 'Special 1' },
  { slot: 'special2', kind: 'special', label: 'Special 2' },
  { slot: 'special3', kind: 'special', label: 'Special 3' },
  { slot: 'special4', kind: 'special', label: 'Special 4' },
];

// ---------------------------------------------------------------------------
// Jet designer
// ---------------------------------------------------------------------------

export interface AirframeDef {
  id: string;
  name: string;
  requires?: string;
  agility: number;
  speed: number;
  range: number;
  stealth: number;
  airAttack: number;
  groundAttack: number;
  reliability: number;
  cost: number;
  weaponSlots: number;
  specialSlots: number;
  /** Internal bays: external hardpoints special trades stealth for weapon slots. */
  stealthy?: boolean;
  desc: string;
}

export const AIRFRAMES: AirframeDef[] = [
  { id: 'light_fighter', name: 'Light Fighter', requires: 'jet_gen4', agility: 75, speed: 1800, range: 1400, stealth: 5, airAttack: 6, groundAttack: 2,
    reliability: 0.9, cost: 18, weaponSlots: 2, specialSlots: 1, desc: 'Cheap and nimble point-defense fighter.' },
  { id: 'multirole', name: 'Multirole Fighter', requires: 'jet_gen4', agility: 62, speed: 2000, range: 2000, stealth: 5, airAttack: 8, groundAttack: 4,
    reliability: 0.88, cost: 26, weaponSlots: 3, specialSlots: 2, desc: 'Does everything adequately.' },
  { id: 'strike', name: 'Heavy Strike Fighter', requires: 'jet_gen4', agility: 45, speed: 1900, range: 3200, stealth: 2, airAttack: 7, groundAttack: 8,
    reliability: 0.86, cost: 34, weaponSlots: 5, specialSlots: 2, desc: 'Long legs, big payload.' },
  { id: 'adv_multirole', name: 'Advanced Multirole (4.5 Gen)', requires: 'jet_gen45', agility: 70, speed: 2100, range: 2400, stealth: 12, airAttack: 11, groundAttack: 6,
    reliability: 0.88, cost: 36, weaponSlots: 4, specialSlots: 2, desc: 'Modern avionics in a proven airframe.' },
  { id: 'stealth_fighter', name: 'Stealth Fighter (5th Gen)', requires: 'jet_gen5', agility: 68, speed: 1950, range: 2200, stealth: 60, airAttack: 14, groundAttack: 6,
    reliability: 0.82, cost: 60, weaponSlots: 2, specialSlots: 3, stealthy: true, desc: 'See first, shoot first. Weapons carried internally.' },
  { id: 'adaptive_fighter', name: 'Adaptive Fighter (6th Gen)', requires: 'jet_gen6', agility: 74, speed: 2300, range: 3600, stealth: 80, airAttack: 18, groundAttack: 9,
    reliability: 0.8, cost: 95, weaponSlots: 3, specialSlots: 3, stealthy: true, desc: 'Optionally manned, controls drone wingmen.' },
  { id: 'ucav', name: 'Combat Drone (UCAV)', requires: 'ucav', agility: 30, speed: 900, range: 3000, stealth: 25, airAttack: 1, groundAttack: 6,
    reliability: 0.92, cost: 6, weaponSlots: 2, specialSlots: 1, desc: 'Cheap, expendable, persistent ground attack.' },
];
export const AIRFRAME_BY_ID = new Map(AIRFRAMES.map((x) => [x.id, x]));

export interface JetModuleDef {
  id: string;
  name: string;
  slot: 'engine' | 'radar' | 'weapon' | 'special';
  requires?: string;
  agility?: number;
  speed?: number;
  rangePct?: number;
  stealth?: number;
  detection?: number;
  airAttack?: number;
  groundAttack?: number;
  airPct?: number;
  groundPct?: number;
  reliability?: number;
  extraWeapons?: number;
  cost: number;
  desc?: string;
}

export const JET_MODULES: JetModuleDef[] = [
  { id: 'je_turbofan', name: 'Afterburning Turbofan', slot: 'engine', cost: 2, reliability: 0.02 },
  { id: 'je_improved', name: 'Improved Turbofan', slot: 'engine', requires: 'jet_eng_improved', agility: 4, speed: 100, cost: 3 },
  { id: 'je_supercruise', name: 'Supercruise Engine', slot: 'engine', requires: 'jet_eng_supercruise', agility: 6, speed: 200, rangePct: 0.15, cost: 5 },
  { id: 'je_adaptive', name: 'Adaptive-Cycle Engine', slot: 'engine', requires: 'jet_eng_adaptive', agility: 8, speed: 250, rangePct: 0.35, cost: 8 },
  { id: 'jr_pulse', name: 'Pulse-Doppler Radar', slot: 'radar', detection: 30, cost: 1.5 },
  { id: 'jr_aesa', name: 'AESA Radar', slot: 'radar', requires: 'radar_aesa', detection: 55, airPct: 0.1, cost: 4 },
  { id: 'jr_gan', name: 'GaN AESA Radar', slot: 'radar', requires: 'radar_gan', detection: 75, airPct: 0.18, cost: 6 },
  { id: 'jw_srm', name: 'Short-Range AAMs', slot: 'weapon', airAttack: 6, cost: 1 },
  { id: 'jw_bvr', name: 'BVR AAMs', slot: 'weapon', requires: 'missile_bvr', airAttack: 11, cost: 2 },
  { id: 'jw_ramjet', name: 'Ramjet BVR AAMs', slot: 'weapon', requires: 'missile_ramjet', airAttack: 16, cost: 3.5 },
  { id: 'jw_rockets', name: 'Rocket Pods', slot: 'weapon', groundAttack: 5, cost: 0.5 },
  { id: 'jw_pgm', name: 'Precision-Guided Bombs', slot: 'weapon', groundAttack: 10, cost: 1.5 },
  { id: 'jw_standoff', name: 'Stand-off Cruise Missiles', slot: 'weapon', groundAttack: 13, cost: 3 },
  { id: 'jw_hypersonic', name: 'Hypersonic Strike Missiles', slot: 'weapon', requires: 'missile_hypersonic', groundAttack: 20, cost: 6 },
  { id: 'js_ram', name: 'RAM Coating', slot: 'special', requires: 'stealth_ram', stealth: 20, reliability: -0.03, cost: 4 },
  { id: 'js_ew', name: 'Integrated EW Suite', slot: 'special', requires: 'ew_suite', stealth: 12, airPct: 0.05, cost: 3 },
  { id: 'js_cft', name: 'Conformal Fuel Tanks', slot: 'special', rangePct: 0.3, agility: -5, cost: 1 },
  { id: 'js_pod', name: 'Targeting Pod', slot: 'special', groundPct: 0.2, stealth: -5, cost: 1.5 },
  { id: 'js_hmd', name: 'Helmet-Mounted Cueing', slot: 'special', airPct: 0.1, cost: 1 },
  { id: 'js_ext', name: 'External Hardpoints', slot: 'special', extraWeapons: 2, stealth: -40, agility: -6, cost: 0.5, desc: 'Two more weapons, but you lose most of your stealth.' },
];
export const JET_MODULE_BY_ID = new Map(JET_MODULES.map((x) => [x.id, x]));
export const JET_WEAPON_SLOTS: JetSlot[] = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5', 'weapon6'];
export const JET_SPECIAL_SLOTS: JetSlot[] = ['special1', 'special2', 'special3'];

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export interface TerrainDef {
  id: string;
  name: string;
  width: number;
  /** Attack modifier for the attacker (negative = penalty). */
  attack: number;
  /** How much of the armor advantage survives (1 = all). */
  armorEff: number;
}

export const TERRAIN: Record<string, TerrainDef> = {
  plains: { id: 'plains', name: 'Plains', width: 90, attack: 0, armorEff: 1 },
  desert: { id: 'desert', name: 'Desert', width: 90, attack: -0.05, armorEff: 1 },
  forest: { id: 'forest', name: 'Forest', width: 75, attack: -0.15, armorEff: 0.6 },
  hills: { id: 'hills', name: 'Hills', width: 75, attack: -0.2, armorEff: 0.7 },
  urban: { id: 'urban', name: 'Urban', width: 70, attack: -0.3, armorEff: 0.4 },
  jungle: { id: 'jungle', name: 'Jungle', width: 60, attack: -0.3, armorEff: 0.4 },
  mountains: { id: 'mountains', name: 'Mountains', width: 60, attack: -0.4, armorEff: 0.3 },
};

const TERRAIN_GROUPS: Record<string, string[]> = {
  mountains: ['CHE', 'AUT', 'NPL', 'BTN', 'AFG', 'KGZ', 'TJK', 'ARM', 'GEO', 'ALB', 'MNE', 'BIH', 'KOS', 'MKD', 'LSO', 'NOR', 'BOL', 'PER', 'CHL'],
  hills: ['ITA', 'ESP', 'GRC', 'TUR', 'IRN', 'PRK', 'SRB', 'SVN', 'HRV', 'SVK', 'CZE', 'PRT', 'ETH', 'ERI', 'YEM', 'MNG', 'MAR', 'AZE', 'ECU', 'MEX', 'LBN', 'SYR', 'MMR'],
  desert: ['SAU', 'EGY', 'LBY', 'DZA', 'MRT', 'MLI', 'NER', 'TCD', 'SDN', 'OMN', 'ARE', 'QAT', 'KWT', 'IRQ', 'JOR', 'SAH', 'TKM', 'NAM', 'UZB', 'DJI', 'SOM', 'SOL', 'AUS'],
  jungle: ['BRA', 'COD', 'COG', 'GAB', 'CMR', 'CAF', 'IDN', 'PNG', 'MYS', 'LAO', 'KHM', 'GUY', 'SUR', 'COL', 'VEN', 'GNQ', 'LBR', 'SLE', 'BRN', 'SLB', 'VUT', 'TLS', 'PHL'],
  forest: ['FIN', 'SWE', 'CAN', 'EST', 'LVA', 'LTU', 'BLR', 'EPR', 'GAB', 'NZL', 'ROU', 'MDA', 'VNM', 'THA', 'GRL', 'ISL'],
  urban: ['NLD', 'BEL', 'LUX', 'KOR', 'JPN', 'ISR', 'PSX', 'TWN', 'CYP', 'CYN', 'GBR'],
};
const TERRAIN_BY_PROVINCE = new Map<string, string>();
for (const [terrain, ids] of Object.entries(TERRAIN_GROUPS)) for (const id of ids) if (!TERRAIN_BY_PROVINCE.has(id)) TERRAIN_BY_PROVINCE.set(id, terrain);
export const terrainOf = (province: string): TerrainDef => TERRAIN[TERRAIN_BY_PROVINCE.get(province) ?? 'plains'];

// ---------------------------------------------------------------------------
// Standard designs and templates (available to every nation that has the techs)
// ---------------------------------------------------------------------------

export const STD_TANKS: TankDesign[] = [
  { id: 'std_mbt_legacy', name: 'Legacy MBT (105mm)', chassis: 'mbt',
    modules: { gun: 'gun_105', turret: 'turret_manned', engine: 'eng_diesel_1200', armor: 'armor_steel', fcs: 'fcs_thermal', special1: 'sp_cage' } },
  { id: 'std_mbt_g3', name: 'Gen-3 MBT', chassis: 'mbt',
    modules: { gun: 'gun_120', turret: 'turret_manned', engine: 'eng_diesel_1500', armor: 'armor_composite', fcs: 'fcs_thermal', special1: 'sp_rws', special2: 'sp_cage' } },
  { id: 'std_mbt_g3al', name: 'Gen-3 MBT (Autoloader)', chassis: 'mbt',
    modules: { gun: 'gun_125al', turret: 'turret_autoloader', engine: 'eng_diesel_1200', armor: 'armor_era', fcs: 'fcs_thermal', special1: 'sp_atgm', special2: 'sp_cage' } },
  { id: 'std_mbt_g3plus', name: 'Gen-3+ MBT', chassis: 'mbt',
    modules: { gun: 'gun_120', turret: 'turret_manned', engine: 'eng_turbine', armor: 'armor_era', fcs: 'fcs_hunter', special1: 'sp_aps_soft', special2: 'sp_rws', special3: 'sp_cage' } },
  { id: 'std_light', name: 'Light Tank', chassis: 'light',
    modules: { gun: 'gun_105', turret: 'turret_manned', engine: 'eng_diesel_1200', armor: 'armor_steel', fcs: 'fcs_thermal', special1: 'sp_rws' } },
];

export const STD_JETS: JetDesign[] = [
  { id: 'std_fighter_g4', name: 'Gen-4 Light Fighter', airframe: 'light_fighter',
    modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_srm', weapon2: 'jw_srm' } },
  { id: 'std_multirole_g4', name: 'Gen-4 Multirole', airframe: 'multirole',
    modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_bvr', weapon2: 'jw_srm', weapon3: 'jw_pgm', special1: 'js_pod' } },
  { id: 'std_strike_g4', name: 'Gen-4 Strike Fighter', airframe: 'strike',
    modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_bvr', weapon2: 'jw_pgm', weapon3: 'jw_pgm', weapon4: 'jw_standoff', weapon5: 'jw_rockets', special1: 'js_pod', special2: 'js_cft' } },
  { id: 'std_multirole_g45', name: 'Gen-4.5 Multirole', airframe: 'adv_multirole',
    modules: { engine: 'je_improved', radar: 'jr_aesa', weapon1: 'jw_bvr', weapon2: 'jw_bvr', weapon3: 'jw_srm', weapon4: 'jw_pgm', special1: 'js_ew', special2: 'js_hmd' } },
  { id: 'std_stealth_g5', name: 'Gen-5 Stealth Fighter', airframe: 'stealth_fighter',
    modules: { engine: 'je_supercruise', radar: 'jr_aesa', weapon1: 'jw_bvr', weapon2: 'jw_bvr', special1: 'js_ram', special2: 'js_ew', special3: 'js_hmd' } },
  { id: 'std_ucav', name: 'Strike Drone', airframe: 'ucav',
    modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_pgm', weapon2: 'jw_rockets' } },
];

const grid = (cols: (string | [string, string] | null)[][]): (DivisionTemplate['combat'][number])[] => {
  // cols[c][r] -> row-major combat grid
  const out: DivisionTemplate['combat'] = Array.from({ length: GRID_COLS * GRID_ROWS }, () => null);
  cols.forEach((col, c) =>
    col.forEach((cell, r) => {
      if (!cell) return;
      out[r * GRID_COLS + c] = typeof cell === 'string' ? { type: cell } : { type: cell[0], design: cell[1] };
    }),
  );
  return out;
};
const support = (...ids: string[]) => Array.from({ length: SUPPORT_SLOTS }, (_, i) => ids[i] ?? null);

/** Standard templates. Tank battalions use the given design id (nations swap in their own at game start). */
export function standardTemplates(tank = 'std_mbt_g3'): DivisionTemplate[] {
  return [
    { id: 'tpl_light_inf', name: 'Light Infantry Brigade', combat: grid([['infantry', 'infantry'], ['infantry', 'infantry'], ['sp_artillery']]), support: support('engineers') },
    { id: 'tpl_infantry', name: 'Infantry Division', combat: grid([['infantry', 'infantry', 'infantry'], ['infantry', 'infantry', 'infantry'], ['sp_artillery', 'sp_artillery'], ['anti_tank']]), support: support('recon_drones', 'engineers', 'field_hospital') },
    { id: 'tpl_mech', name: 'Mechanized Division', combat: grid([['mechanized', 'mechanized'], ['mechanized', 'mechanized'], [['armored', tank], ['armored', tank]], ['sp_artillery', 'sp_artillery'], ['air_defense']]), support: support('recon_drones', 'engineers', 'logistics', 'signals_ew') },
    { id: 'tpl_armored', name: 'Armored Division', combat: grid([[['armored', tank], ['armored', tank], ['armored', tank]], [['armored', tank], ['armored', tank]], ['mechanized', 'mechanized', 'mechanized'], ['sp_artillery', 'sp_artillery'], ['air_defense']]), support: support('recon_drones', 'engineers', 'logistics', 'signals_ew') },
  ];
}
