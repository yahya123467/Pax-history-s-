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
}

// ---------------------------------------------------------------------------
// AI contract — what the engine model must return each turn.
// ---------------------------------------------------------------------------

export type StateChange =
  | { type: 'transfer_province'; province: string; to: string }
  | { type: 'relation_change'; a: string; b: string; delta: number }
  | { type: 'new_event'; text: string }
  /** Extension to the base contract: nudge a nation's stability or economy. */
  | { type: 'stat_change'; nation: string; stat: 'stability' | 'economy'; delta: number };

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
