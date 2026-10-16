/**
 * SQLite persistence (better-sqlite3, synchronous — ideal for a single-process v1).
 *
 * Design decision: the whole WorldState is stored as one JSON TEXT column. The few
 * columns duplicated next to it (date, turn, nation) exist only for listing screens.
 * Migrating to PostgreSQL later means: same two tables, TEXT -> JSONB, and swapping
 * this file's ~10 functions for `pg` queries — nothing else in the app touches SQL.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { SaveSummary, WorldState } from '../../../shared/types';
import { config } from '../config';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  scenario_id   TEXT NOT NULL,
  player_nation TEXT NOT NULL,
  date          TEXT NOT NULL,
  turn          INTEGER NOT NULL,
  state         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS saves (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  player_nation TEXT NOT NULL,
  date          TEXT NOT NULL,
  turn          INTEGER NOT NULL,
  state         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saves_game ON saves(game_id);
`);

export interface GameRow {
  id: string;
  name: string;
  state: WorldState;
  updatedAt: string;
}

export function insertGame(id: string, name: string, state: WorldState) {
  db.prepare(
    `INSERT INTO games (id, name, scenario_id, player_nation, date, turn, state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, state.scenarioId, state.playerNation, state.date, state.turn, JSON.stringify(state));
}

export function updateGame(id: string, state: WorldState) {
  db.prepare(`UPDATE games SET date = ?, turn = ?, state = ?, updated_at = datetime('now') WHERE id = ?`).run(
    state.date, state.turn, JSON.stringify(state), id,
  );
}

export function getGame(id: string): GameRow | undefined {
  const r = db.prepare(`SELECT id, name, state, updated_at FROM games WHERE id = ?`).get(id) as
    | { id: string; name: string; state: string; updated_at: string }
    | undefined;
  return r && { id: r.id, name: r.name, state: JSON.parse(r.state), updatedAt: r.updated_at };
}

export function listGames(limit = 20) {
  return db
    .prepare(`SELECT id, name, player_nation AS playerNation, date, turn, updated_at AS updatedAt FROM games ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as { id: string; name: string; playerNation: string; date: string; turn: number; updatedAt: string }[];
}

export function insertSave(gameId: string, name: string, state: WorldState): number {
  const info = db
    .prepare(`INSERT INTO saves (game_id, name, player_nation, date, turn, state) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(gameId, name, state.playerNation, state.date, state.turn, JSON.stringify(state));
  return Number(info.lastInsertRowid);
}

export function listSaves(): SaveSummary[] {
  return db
    .prepare(
      `SELECT id, name, game_id AS gameId, player_nation AS playerNation, date, turn, created_at AS createdAt FROM saves ORDER BY id DESC`,
    )
    .all() as SaveSummary[];
}

export function getSave(id: number): { id: number; name: string; gameId: string; state: WorldState } | undefined {
  const r = db.prepare(`SELECT id, name, game_id, state FROM saves WHERE id = ?`).get(id) as
    | { id: number; name: string; game_id: string; state: string }
    | undefined;
  return r && { id: r.id, name: r.name, gameId: r.game_id, state: JSON.parse(r.state) };
}

export function deleteSave(id: number): boolean {
  return db.prepare(`DELETE FROM saves WHERE id = ?`).run(id).changes > 0;
}
