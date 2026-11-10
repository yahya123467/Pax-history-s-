/**
 * World-state schema shared by server and client.
 *
 * Design notes:
 * - Everything the game knows lives in ONE serialisable JSON object (`WorldState`).
 *   Saving is `JSON.stringify(state)`, loading is the reverse — no ORM, no joins.
 * - Nations and provinces are keyed by short stable IDs (ISO-like "GER", "DEU").
 *   The AI is told to use IDs, but the validator also accepts display names.
 * - Relations are stored per nation as a sparse map (missing = 0) and are always
 *   kept symmetric by the state helpers.
 * - This file is types only (no runtime code) so both sides can import it freely.
 */

export type NationId = string;
export type ProvinceId = string;

export interface Nation {
  id: NationId;
  name: string;
  leader: string;
  government: string;
  /** Province used to place the nation's map label (falls back to its largest province). */
  capital: ProvinceId;
  /** Hex colour used on the map ("flag colour"). */
  color: string;
  /** Sparse map of other nation id -> relation score, -100..100. Missing = 0. */
  relations: Record<NationId, number>;
  /** 0..100 */
  stability: number;
  /** 0..100 */
  economy: number;
  /** Strategic goals fed to the diplomacy persona and the engine. */
  goals: string[];
  /** Short personality / negotiating style for diplomacy. */
  persona?: string;
  playable: boolean;
  /** Minor nations are summarised briefly in prompts and never act on their own. */
  minor: boolean;
  /** False once a nation owns no provinces. It can be revived by a transfer. */
  alive: boolean;
}

export interface Province {
  id: ProvinceId;
  name: string;
  owner: NationId;
}

export type EventKind = 'player' | 'world' | 'diplomacy' | 'system';

export interface GameEvent {
  id: number;
  turn: number;
  date: string; // YYYY-MM-DD
  kind: EventKind;
  text: string;
}

export interface ChatMessage {
  role: 'player' | 'nation';
  text: string;
  date: string;
}

export interface ChatThread {
  nation: NationId;
  messages: ChatMessage[];
  /** Index into `messages` up to which talks have already been summarised. */
  concludedUpTo: number;
}

export interface NationReaction {
  nation: string;
  reaction: string;
}

export interface TurnReport {
  turn: number;
  date: string;
  playerAction: string;
  narrative: string;
  nationReactions: NationReaction[];
  applied: string[];
  rejected: string[];
}

export interface WorldState {
  schemaVersion: 1;
  scenarioId: string;
  /** Current in-game date, YYYY-MM-DD (always the 1st of a month). */
  date: string;
  turn: number;
  playerNation: NationId;
  nations: Record<NationId, Nation>;
  provinces: Record<ProvinceId, Province>;
  /** Recent events, oldest first. Older ones are folded into `historySummary`. */
  events: GameEvent[];
  nextEventId: number;
  /** "History so far" paragraph built from summarised old events. */
  historySummary: string;
  archivedEventCount: number;
  chats: Record<NationId, ChatThread>;
  lastReport: TurnReport | null;
  /** Military layer (research, designers, divisions, wars, battles). Absent in scenarios without it. */
  military?: MilitaryState;
}

// ---------------------------------------------------------------------------
// AI contract — what the engine model must return each turn.
// ---------------------------------------------------------------------------

export type StateChange =
  | { type: 'transfer_province'; province: string; to: string }
  | { type: 'relation_change'; a: string; b: string; delta: number }
  | { type: 'new_event'; text: string }
  /** Extension to the base contract: nudge a nation's stability or economy. */
  | { type: 'stat_change'; nation: string; stat: 'stability' | 'economy'; delta: number }
  /** Military scenarios only: start or end a war. Fighting itself is resolved by the combat system. */
  | { type: 'declare_war'; a: string; b: string }
  | { type: 'make_peace'; a: string; b: string };

export interface TurnResolution {
  narrative: string;
  nation_reactions: NationReaction[];
  state_changes: StateChange[];
}

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  startDate: string;
  /** Earliest and latest allowed start dates (YYYY-MM). */
  startRange: [string, string];
  /** True if the scenario has the military layer (research, designers, divisions, battles). */
  military: boolean;
  playableNations: { id: NationId; name: string; leader: string; color: string; blurb: string }[];
}

export interface GameDTO {
  id: string;
  name: string;
  state: WorldState;
  aiMode: 'live' | 'mock';
}

export interface SaveSummary {
  id: number;
  name: string;
  gameId: string;
  playerNation: string;
  date: string;
  turn: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Military layer
// ---------------------------------------------------------------------------

export type TechCategory = 'infantry' | 'armor' | 'artillery' | 'air' | 'doctrine' | 'industry';

/** Global modifiers a nation accumulates from research. Values are fractions (0.1 = +10%). */
export type ModKey =
  | 'inf_soft' | 'inf_hard' | 'inf_def' | 'inf_pierce'
  | 'art_soft' | 'art_hard'
  | 'org' | 'attack' | 'defense' | 'breakthrough' | 'entrench' | 'recon'
  | 'air_defense' | 'air_ground' | 'air_support'
  | 'industry' | 'research' | 'recovery' | 'manpower';

export interface TechDef {
  id: string;
  name: string;
  category: TechCategory;
  /** Historical/projected year. Researching ahead of time costs extra. */
  year: number;
  /** Research points. */
  cost: number;
  requires: string[];
  desc: string;
  mods?: Partial<Record<ModKey, number>>;
}

export interface ResearchSlot {
  tech: string;
  progress: number;
}

/** One battalion in a division template's combat grid. `design` is required for tank battalions. */
export interface BattalionSlot {
  type: string;
  design?: string;
}

export interface DivisionTemplate {
  id: string;
  name: string;
  /** 5 columns x 5 rows, row-major: index = row * 5 + col. */
  combat: (BattalionSlot | null)[];
  /** Up to 5 support companies. */
  support: (string | null)[];
}

export type TankSlot = 'gun' | 'turret' | 'engine' | 'armor' | 'fcs' | 'special1' | 'special2' | 'special3' | 'special4';
export interface TankDesign {
  id: string;
  name: string;
  chassis: string;
  modules: Partial<Record<TankSlot, string | null>>;
  obsolete?: boolean;
}

export type JetSlot = 'engine' | 'radar' | 'weapon1' | 'weapon2' | 'weapon3' | 'weapon4' | 'weapon5' | 'weapon6' | 'special1' | 'special2' | 'special3';
export interface JetDesign {
  id: string;
  name: string;
  airframe: string;
  modules: Partial<Record<JetSlot, string | null>>;
  obsolete?: boolean;
}

export interface ProductionLine {
  id: string;
  /** Equipment key, e.g. "small_arms", "tank:std_mbt_g3", "jet:std_multirole". */
  item: string;
  factories: number;
}

export interface NationMilitary {
  /** Military factories. Output also scales with the nation's economy. */
  factories: number;
  research: (ResearchSlot | null)[];
  completed: string[];
  /** Available manpower in people. */
  manpower: number;
  /** Equipment key -> units in storage (fractional while producing). */
  stockpile: Record<string, number>;
  production: ProductionLine[];
  templates: DivisionTemplate[];
  tankDesigns: TankDesign[];
  jetDesigns: JetDesign[];
}

export type DivisionOrder = { kind: 'move' | 'attack' | 'naval'; to: ProvinceId };

export interface Division {
  id: string;
  name: string;
  owner: NationId;
  template: string;
  province: ProvinceId;
  /** 0..1 — fraction of full equipment and manpower. */
  strength: number;
  /** Current organisation (absolute, max comes from the template). */
  org: number;
  status: 'ready' | 'training';
  /** Turns of training left. */
  readyIn: number;
  /** Months dug in at the current position (0..5). */
  entrench: number;
  experience: number;
  order?: DivisionOrder | null;
  /** Arrived by sea this turn: amphibious penalty in its first battle. */
  landed?: boolean;
  /** Supplied over a beachhead: a smaller penalty until the province is taken. */
  seaSupplied?: boolean;
}

export type AirMission = 'superiority' | 'ground_support';
export interface AirWing {
  id: string;
  name: string;
  owner: NationId;
  design: string;
  count: number;
  province: ProvinceId;
  mission: AirMission;
}

export interface War {
  a: NationId;
  b: NationId;
  since: string;
}

export interface BattleDivisionResult {
  id: string;
  name: string;
  owner: NationId;
  template: string;
  startStrength: number;
  endStrength: number;
  startOrg: number;
  endOrg: number;
  maxOrg: number;
  fate: 'held' | 'fought' | 'reserve' | 'pushed_back' | 'retreated' | 'destroyed';
}

export interface BattleSide {
  nations: NationId[];
  divisions: BattleDivisionResult[];
  casualties: number;
  equipmentLost: number;
  widthUsed: number;
  air: { planes: number; superiority: number; planesLost: number };
}

export interface BattleReport {
  id: string;
  turn: number;
  date: string;
  province: ProvinceId;
  provinceName: string;
  terrain: string;
  frontWidth: number;
  attacker: BattleSide;
  defender: BattleSide;
  winner: 'attacker' | 'defender' | 'stalemate';
  /** Occupation progress change for the attacker this battle (can be negative). */
  occupationDelta: number;
  occupationAfter: number;
  captured: boolean;
  /** Per round: average org fraction of attackers / defenders. */
  rounds: { att: number; def: number }[];
  notes: string[];
}

export interface Occupation {
  by: NationId;
  progress: number;
}

export interface MilitaryState {
  nations: Record<NationId, NationMilitary>;
  divisions: Division[];
  airWings: AirWing[];
  wars: War[];
  occupation: Record<ProvinceId, Occupation>;
  /** Battles fought in the most recent turn. */
  battles: BattleReport[];
  nextId: number;
}

/** Player military commands sent to POST /games/:id/military. */
export type MilitaryCommand =
  | { op: 'research'; slot: number; tech: string | null }
  | { op: 'save_tank'; design: TankDesign }
  | { op: 'save_jet'; design: JetDesign }
  | { op: 'obsolete_design'; kind: 'tank' | 'jet'; id: string; obsolete: boolean }
  | { op: 'save_template'; template: DivisionTemplate }
  | { op: 'delete_template'; id: string }
  | { op: 'set_production'; lines: ProductionLine[] }
  | { op: 'recruit'; template: string; province: string; count: number }
  | { op: 'order'; divisions: string[]; order: DivisionOrder | null }
  | { op: 'disband'; division: string }
  | { op: 'create_wing'; design: string; count: number; province: string; mission: AirMission }
  | { op: 'wing'; id: string; province?: string; mission?: AirMission; count?: number }
  | { op: 'declare_war'; target: string }
  | { op: 'propose_peace'; target: string };
