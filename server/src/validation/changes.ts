/**
 * Rule validation for AI-proposed state changes.
 *
 * Two layers:
 *  1. Shape (zod): is the reply the JSON contract at all? Failure here = retry the AI call.
 *  2. Rules (this file): is each individual change legal *in the current world*?
 *     Failure here = that one change is rejected and reported; the rest still apply.
 *
 * Changes are validated and applied one at a time, in order, against the live state,
 * so e.g. two transfers of the same province in one turn are judged correctly.
 */
import { z } from 'zod';
import type { EventKind, WorldState } from '../../../shared/types';
import { addEvent, clamp, getRelation, refreshAlive, resolveNation, resolveProvince, setRelation } from '../state/world';

export const RULES = {
  maxTransfersPerTurn: 6,
  maxRelationDelta: 40,
  maxStatDelta: 15,
  maxEventsPerTurn: 6,
  maxEventLength: 400,
  maxNarrativeLength: 4000,
};

// ---- Layer 1: shape --------------------------------------------------------

/** Each change is loosely typed here; unknown types are rejected by the rule layer instead of failing the whole reply. */
const looseChange = z.object({ type: z.string() }).passthrough();

export const turnResolutionSchema = z.object({
  narrative: z.string().min(1),
  nation_reactions: z
    .array(z.object({ nation: z.string(), reaction: z.string() }))
    .default([]),
  state_changes: z.array(looseChange).default([]),
});
export type ParsedResolution = z.infer<typeof turnResolutionSchema>;

// ---- Layer 2: rules --------------------------------------------------------

export interface ApplyResult {
  applied: string[];
  rejected: string[];
}

type Loose = Record<string, unknown> & { type: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validate and apply changes in order. Mutates `state`.
 * `eventKind` is the kind given to `new_event` entries (world events vs diplomacy).
 */
export function applyChanges(state: WorldState, changes: Loose[], eventKind: EventKind = 'world'): ApplyResult {
  const applied: string[] = [];
  const rejected: string[] = [];
  let transfers = 0;
  let events = 0;
  const reject = (c: Loose, why: string) => rejected.push(`${describe(c)} — ${why}`);

  for (const c of changes) {
    switch (c.type) {
      case 'transfer_province': {
        const prov = resolveProvince(state, c.province);
        const to = resolveNation(state, c.to);
        if (!prov) { reject(c, `unknown province "${String(c.province)}"`); break; }
        if (!to) { reject(c, `nonexistent nation "${String(c.to)}"`); break; }
        if (prov.owner === to.id) { reject(c, `${to.name} already owns ${prov.name}`); break; }
        if (transfers >= RULES.maxTransfersPerTurn) { reject(c, `more than ${RULES.maxTransfersPerTurn} transfers in one turn`); break; }
        const from = state.nations[prov.owner];
        prov.owner = to.id;
        transfers++;
        applied.push(`${prov.name} transferred from ${from?.name ?? prov.owner} to ${to.name}`);
        break;
      }
      case 'relation_change': {
        const a = resolveNation(state, c.a);
        const b = resolveNation(state, c.b);
        if (!a || !b) { reject(c, `nonexistent nation "${String(!a ? c.a : c.b)}"`); break; }
        if (a.id === b.id) { reject(c, 'a nation cannot change relations with itself'); break; }
        if (!isNum(c.delta)) { reject(c, 'delta must be a number'); break; }
        const delta = Math.round(clamp(c.delta, -RULES.maxRelationDelta, RULES.maxRelationDelta));
        if (delta === 0) { reject(c, 'delta is zero'); break; }
        const before = getRelation(state, a.id, b.id);
        setRelation(state, a.id, b.id, before + delta);
        const after = getRelation(state, a.id, b.id);
        const note = delta !== Math.round(c.delta) ? ` (clamped from ${c.delta})` : '';
        applied.push(`Relations ${a.name}–${b.name}: ${before} → ${after}${note}`);
        break;
      }
      case 'stat_change': {
        const n = resolveNation(state, c.nation);
        if (!n) { reject(c, `nonexistent nation "${String(c.nation)}"`); break; }
        if (c.stat !== 'stability' && c.stat !== 'economy') { reject(c, `unknown stat "${String(c.stat)}"`); break; }
        if (!isNum(c.delta)) { reject(c, 'delta must be a number'); break; }
        const delta = Math.round(clamp(c.delta, -RULES.maxStatDelta, RULES.maxStatDelta));
        const before = n[c.stat];
        n[c.stat] = clamp(before + delta, 0, 100);
        applied.push(`${n.name} ${c.stat}: ${before} → ${n[c.stat]}`);
        break;
      }
      case 'new_event': {
        if (typeof c.text !== 'string' || !c.text.trim()) { reject(c, 'event text is empty'); break; }
        if (events >= RULES.maxEventsPerTurn) { reject(c, `more than ${RULES.maxEventsPerTurn} events in one turn`); break; }
        addEvent(state, eventKind, c.text.trim().slice(0, RULES.maxEventLength));
        events++;
        applied.push(`Event: ${c.text.trim().slice(0, 80)}`);
        break;
      }
      default:
        reject(c, `unknown change type "${c.type}"`);
    }
  }

  const { died, revived } = refreshAlive(state);
  for (const id of died) addEvent(state, 'system', `${state.nations[id].name} has lost all its territory and ceased to exist as an independent state.`);
  for (const id of revived) addEvent(state, 'system', `${state.nations[id].name} has re-emerged on the map.`);
  return { applied, rejected };
}

function describe(c: Loose): string {
  switch (c.type) {
    case 'transfer_province': return `transfer ${String(c.province)} → ${String(c.to)}`;
    case 'relation_change': return `relation ${String(c.a)}/${String(c.b)} ${String(c.delta)}`;
    case 'stat_change': return `${String(c.nation)} ${String(c.stat)} ${String(c.delta)}`;
    case 'new_event': return `event "${String(c.text).slice(0, 40)}"`;
    default: return `change "${c.type}"`;
  }
}
