/** HTTP routes. Thin: parse + validate input, call the service, map errors. */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { AIError } from '../ai/client';
import { config } from '../config';
import * as db from '../db/database';
import { listScenarios, ScenarioError } from '../scenarios';
import * as game from '../services/gameService';
import { geoForClient } from '../military/world';
import type { MilitaryCommand } from '../../../shared/types';

const id = z.string().max(64);
const name = z.string().max(60);
const modules = z.record(z.string().max(20), z.string().max(40).nullable());
const order = z.object({ kind: z.enum(['move', 'attack', 'naval']), to: id });
const mission = z.enum(['superiority', 'ground_support']);
const militaryCommandSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('research'), slot: z.number().int(), tech: id.nullable() }),
  z.object({ op: z.literal('save_tank'), design: z.object({ id: id.default(''), name, chassis: id, modules }) }),
  z.object({ op: z.literal('save_jet'), design: z.object({ id: id.default(''), name, airframe: id, modules }) }),
  z.object({ op: z.literal('obsolete_design'), kind: z.enum(['tank', 'jet']), id, obsolete: z.boolean() }),
  z.object({
    op: z.literal('save_template'),
    template: z.object({
      id: id.default(''),
      name,
      combat: z.array(z.object({ type: id, design: id.optional() }).nullable()).max(25),
      support: z.array(id.nullable()).max(5),
    }),
  }),
  z.object({ op: z.literal('delete_template'), id }),
  z.object({ op: z.literal('set_production'), lines: z.array(z.object({ id: id.default(''), item: z.string().max(64), factories: z.number().min(0) })).max(40) }),
  z.object({ op: z.literal('recruit'), template: id, province: id, count: z.number().int().min(1).max(10) }),
  z.object({ op: z.literal('order'), divisions: z.array(id).min(1).max(100), order: order.nullable() }),
  z.object({ op: z.literal('disband'), division: id }),
  z.object({ op: z.literal('create_wing'), design: id, count: z.number().int().min(1), province: id, mission }),
  z.object({ op: z.literal('wing'), id, province: id.optional(), mission: mission.optional(), count: z.number().int().min(0).optional() }),
  z.object({ op: z.literal('declare_war'), target: id }),
  z.object({ op: z.literal('propose_peace'), target: id }),
]);

export const api = Router();

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res))
    .then((body) => res.json(body))
    .catch(next);
};
const body = <T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) throw new game.HttpError(400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
};

// Only non-secret info is exposed: never the key.
api.get('/health', h(() => ({ ok: true, aiMode: config.ai.mock ? 'mock' : 'live', model: config.ai.mock ? null : config.ai.model })));

api.get('/scenarios', h(() => listScenarios()));

api.get('/geo', h(() => geoForClient()));

api.get('/games', h(() => db.listGames()));

api.post(
  '/games',
  h((req) => {
    const b = body(
      z.object({ scenarioId: z.string(), nation: z.string(), startMonth: z.string().optional(), name: z.string().max(80).optional() }),
      req,
    );
    return game.createGame(b.scenarioId, b.nation, b.startMonth, b.name);
  }),
);

api.get('/games/:id', h((req) => game.getGame(req.params.id)));

api.post(
  '/games/:id/turn',
  h((req) => game.endTurn(req.params.id, body(z.object({ action: z.string().max(4000).default('') }), req).action)),
);

api.post(
  '/games/:id/chat/:nation',
  h((req) => game.sendChat(req.params.id, req.params.nation, body(z.object({ message: z.string().min(1).max(3000) }), req).message)),
);

api.post('/games/:id/chat/:nation/conclude', h((req) => game.concludeChat(req.params.id, req.params.nation)));

api.post('/games/:id/military', h((req) => game.militaryCommand(req.params.id, body(militaryCommandSchema, req) as MilitaryCommand)));

api.post('/games/:id/saves', h((req) => game.saveGame(req.params.id, body(z.object({ name: z.string().max(80).default('') }), req).name)));

api.get('/saves', h(() => db.listSaves()));

api.post('/saves/:id/load', h((req) => game.loadSave(Number(req.params.id))));

api.delete(
  '/saves/:id',
  h((req) => {
    if (!db.deleteSave(Number(req.params.id))) throw new game.HttpError(404, 'Save not found');
    return { ok: true };
  }),
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof game.HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ScenarioError) return res.status(400).json({ error: err.message });
  if (err instanceof AIError) return res.status(502).json({ error: `The AI engine failed: ${err.message}` });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
