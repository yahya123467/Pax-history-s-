import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractJson } from '../ai/client';
import { buildInitialState } from '../scenarios';
import { getRelation } from '../state/world';
import { applyChanges, turnResolutionSchema } from './changes';

const fresh = () => buildInitialState('europe-1936', 'GER');

test('scenario: every province has a living owner', () => {
  const s = fresh();
  for (const p of Object.values(s.provinces)) assert.ok(s.nations[p.owner]?.alive, `${p.id} owner ${p.owner}`);
  assert.equal(s.provinces.CZE.owner, 'CSK');
  assert.equal(s.provinces.EPR.owner, 'GER');
});

test('transfer_province: accepts ids and names, rejects unknowns and no-ops', () => {
  const s = fresh();
  const r = applyChanges(s, [
    { type: 'transfer_province', province: 'AUT', to: 'GER' },
    { type: 'transfer_province', province: 'Bohemia-Moravia', to: 'germany' },
    { type: 'transfer_province', province: 'Atlantis', to: 'GER' },
    { type: 'transfer_province', province: 'POL', to: 'Prussia' },
    { type: 'transfer_province', province: 'AUT', to: 'GER' },
  ]);
  assert.equal(s.provinces.AUT.owner, 'GER');
  assert.equal(s.provinces.CZE.owner, 'GER');
  assert.equal(r.applied.length, 2);
  assert.equal(r.rejected.length, 3);
  assert.match(r.rejected[0], /unknown province/);
  assert.match(r.rejected[1], /nonexistent nation/);
  assert.match(r.rejected[2], /already owns/);
  assert.equal(s.nations.AUT.alive, false, 'Austria loses its only province');
});

test('transfer limit per turn', () => {
  const s = fresh();
  const ids = ['FRA', 'BEL', 'NLD', 'LUX', 'DNK', 'CHE', 'AUT', 'POL'];
  const r = applyChanges(s, ids.map((province) => ({ type: 'transfer_province', province, to: 'GER' })));
  assert.equal(r.applied.length, 6);
  assert.equal(r.rejected.length, 2);
});

test('relation_change: symmetric, clamped, rejects self and bad delta', () => {
  const s = fresh();
  const r = applyChanges(s, [
    { type: 'relation_change', a: 'GER', b: 'ITA', delta: 500 },
    { type: 'relation_change', a: 'GER', b: 'GER', delta: 10 },
    { type: 'relation_change', a: 'GER', b: 'FRA', delta: 'lots' },
    { type: 'relation_change', a: 'GER', b: 'Narnia', delta: 10 },
  ]);
  assert.equal(getRelation(s, 'GER', 'ITA'), 75); // 35 + clamped 40
  assert.equal(getRelation(s, 'ITA', 'GER'), 75);
  assert.equal(r.rejected.length, 3);
});

test('stat_change and new_event', () => {
  const s = fresh();
  const before = s.events.length;
  const r = applyChanges(s, [
    { type: 'stat_change', nation: 'SPR', stat: 'stability', delta: -100 },
    { type: 'stat_change', nation: 'SPR', stat: 'morale', delta: 5 },
    { type: 'new_event', text: 'Spain descended into civil war.' },
    { type: 'new_event', text: '   ' },
    { type: 'teleport', nation: 'GER' },
  ]);
  assert.equal(s.nations.SPR.stability, 13); // 28 - clamped 15
  assert.equal(s.events.length, before + 1);
  assert.equal(r.rejected.length, 3);
});

test('shape schema + JSON extraction', () => {
  const raw = 'Sure! ```json\n{"narrative":"x","state_changes":[{"type":"new_event","text":"y"}]}\n```';
  const parsed = turnResolutionSchema.parse(extractJson(raw));
  assert.equal(parsed.nation_reactions.length, 0);
  assert.equal(parsed.state_changes.length, 1);
  assert.throws(() => extractJson('no json here'));
  assert.equal(turnResolutionSchema.safeParse({ state_changes: [] }).success, false);
});
