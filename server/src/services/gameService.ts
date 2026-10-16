/**
 * Game orchestration: the turn loop, diplomacy, memory and saves.
 * Routes stay thin; everything stateful happens here.
 */
import { randomUUID } from 'node:crypto';
import type { GameDTO, WorldState } from '../../../shared/types';
import { config } from '../config';
import * as db from '../db/database';
import { chatReply, summarizeTalks } from '../ai/diplomacy';
import { resolveTurn, summarizeHistory } from '../ai/engine';
import { buildInitialState, SCENARIOS } from '../scenarios';
import { addEvent, clamp, formatDate, nextMonth } from '../state/world';
import { applyChanges } from '../validation/changes';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Once the log passes this many entries, older ones are folded into the history summary. */
export const MEMORY_THRESHOLD = 30;
/** How many recent events stay verbatim after folding. */
export const MEMORY_KEEP = 15;

const aiMode = (): GameDTO['aiMode'] => (config.ai.mock ? 'mock' : 'live');
const dto = (id: string, name: string, state: WorldState): GameDTO => ({ id, name, state, aiMode: aiMode() });

// One in-flight AI operation per game: prevents double-clicked "End Turn" from resolving twice.
const busy = new Set<string>();
async function withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  if (busy.has(gameId)) throw new HttpError(409, 'This game is already processing a request. Please wait.');
  busy.add(gameId);
  try {
    return await fn();
  } finally {
    busy.delete(gameId);
  }
}

function load(gameId: string) {
  const row = db.getGame(gameId);
  if (!row) throw new HttpError(404, `Game ${gameId} not found`);
  return row;
}

export function createGame(scenarioId: string, nation: string, startMonth?: string, name?: string): GameDTO {
  const state = buildInitialState(scenarioId, nation, startMonth);
  const id = randomUUID();
  const gameName = name?.trim() || `${state.nations[nation].name} — ${SCENARIOS[scenarioId].name}`;
  db.insertGame(id, gameName, state);
  return dto(id, gameName, state);
}

export function getGame(gameId: string): GameDTO {
  const row = load(gameId);
  return dto(row.id, row.name, row.state);
}

/** End Turn: conclude open talks, resolve orders + AI initiatives, advance a month, compress memory, autosave. */
export async function endTurn(gameId: string, action: string): Promise<GameDTO> {
  return withLock(gameId, async () => {
    const row = load(gameId);
    const state = row.state;

    // 1. Any diplomacy left open is concluded first so agreements are in the log the engine sees.
    for (const thread of Object.values(state.chats))
      if (thread.messages.length > thread.concludedUpTo) await concludeThread(state, thread.nation);

    // 2. Ask the engine.
    const orders = action.trim().slice(0, 2000);
    if (orders) addEvent(state, 'player', `${state.nations[state.playerNation].name} orders: ${orders}`);
    const resolution = await resolveTurn(state, orders);

    // 3. Validate + apply every change against the rules.
    const { applied, rejected } = applyChanges(state, resolution.state_changes, 'world');
    if (rejected.length) console.info(`[turn] rejected ${rejected.length} change(s):\n  ${rejected.join('\n  ')}`);

    state.lastReport = {
      turn: state.turn,
      date: state.date,
      playerAction: orders,
      narrative: resolution.narrative.slice(0, 4000),
      nationReactions: resolution.nation_reactions
        .slice(0, 6)
        .map((r) => ({ nation: state.nations[r.nation.toUpperCase()]?.name ?? r.nation, reaction: r.reaction })),
      applied,
      rejected,
    };

    // 4. Advance time.
    state.turn += 1;
    state.date = nextMonth(state.date);
    addEvent(state, 'system', `— ${formatDate(state.date)} —`);

    // 5. Memory: keep prompts small.
    await compactMemory(state);

    db.updateGame(gameId, state);
    return dto(row.id, row.name, state);
  });
}

export async function compactMemory(state: WorldState) {
  if (state.events.length <= MEMORY_THRESHOLD) return;
  const fold = state.events.slice(0, state.events.length - MEMORY_KEEP);
  try {
    state.historySummary = await summarizeHistory(state.historySummary, fold);
    state.events = state.events.slice(fold.length);
    state.archivedEventCount += fold.length;
  } catch (e) {
    // Not fatal: try again next turn rather than failing the player's turn.
    console.warn(`[memory] summarisation failed, will retry next turn: ${(e as Error).message}`);
  }
}

function chatTarget(state: WorldState, nationId: string) {
  const nation = state.nations[nationId];
  if (!nation) throw new HttpError(404, `Unknown nation ${nationId}`);
  if (nation.id === state.playerNation) throw new HttpError(400, 'You cannot negotiate with yourself.');
  if (!nation.alive) throw new HttpError(400, `${nation.name} no longer exists.`);
  return nation;
}

export async function sendChat(gameId: string, nationId: string, message: string): Promise<GameDTO> {
  const text = message.trim().slice(0, 1500);
  if (!text) throw new HttpError(400, 'Message is empty');
  return withLock(gameId, async () => {
    const row = load(gameId);
    const state = row.state;
    const nation = chatTarget(state, nationId);
    const thread = (state.chats[nation.id] ??= { nation: nation.id, messages: [], concludedUpTo: 0 });
    thread.messages.push({ role: 'player', text, date: state.date });
    const reply = await chatReply(state, nation, thread); // on failure nothing is saved
    thread.messages.push({ role: 'nation', text: reply, date: state.date });
    db.updateGame(gameId, state);
    return dto(row.id, row.name, state);
  });
}

export async function concludeChat(gameId: string, nationId: string): Promise<GameDTO> {
  return withLock(gameId, async () => {
    const row = load(gameId);
    const state = row.state;
    const nation = chatTarget(state, nationId);
    const thread = state.chats[nation.id];
    if (!thread || thread.messages.length <= thread.concludedUpTo) throw new HttpError(400, 'There are no new talks to conclude.');
    await concludeThread(state, nation.id);
    db.updateGame(gameId, state);
    return dto(row.id, row.name, state);
  });
}

/** Summarise unsummarised messages into the event log and apply the relation effect. */
async function concludeThread(state: WorldState, nationId: string) {
  const thread = state.chats[nationId];
  const nation = state.nations[nationId];
  const outcome = await summarizeTalks(state, nation, thread);
  addEvent(state, 'diplomacy', outcome.summary);
  for (const a of outcome.agreements.slice(0, 5)) addEvent(state, 'diplomacy', `Agreement: ${a}`);
  const delta = Math.round(clamp(outcome.relation_delta, -15, 15));
  if (delta) applyChanges(state, [{ type: 'relation_change', a: state.playerNation, b: nationId, delta }]);
  thread.concludedUpTo = thread.messages.length;
}

// ---- saves ----

export function saveGame(gameId: string, name: string) {
  const row = load(gameId);
  const label = name.trim().slice(0, 80) || `${row.state.nations[row.state.playerNation].name}, ${formatDate(row.state.date)}`;
  return { id: db.insertSave(gameId, label, row.state) };
}

/** Loading a save forks it into a fresh game, so the save itself is never overwritten. */
export function loadSave(saveId: number): GameDTO {
  const save = db.getSave(saveId);
  if (!save) throw new HttpError(404, `Save ${saveId} not found`);
  if (save.state.schemaVersion !== 1) throw new HttpError(400, 'Save was made by an incompatible version');
  const id = randomUUID();
  db.insertGame(id, save.name, save.state);
  return dto(id, save.name, save.state);
}
