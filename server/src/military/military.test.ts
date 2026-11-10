import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STD_TANKS, standardTemplates } from '../../../shared/military/catalog';
import { divisionStats, jetStats, tankStats } from '../../../shared/military/stats';
import { buildInitialState } from '../scenarios';
import { nextMonth } from '../state/world';
import { applyChanges } from '../validation/changes';
import { applyCommand, CommandError } from './commands';
import { processMilitaryTurn } from './turn';
import { atWar, canLand, nationMil } from './world';

const fresh = (nation = 'POL') => buildInitialState('world-2026', nation);

test('present-day scenario starts with the Russia–Ukraine war and armies', () => {
  const s = fresh();
  assert.ok(s.military);
  assert.ok(atWar(s, 'RUS', 'UKR'));
  assert.equal(s.military.occupation.UKR.by, 'RUS');
  assert.ok(s.military.divisions.filter((d) => d.owner === 'RUS' && d.province === 'UKR').length > 5);
  assert.ok(s.military.airWings.some((w) => w.owner === 'USA' && w.design === 'std_stealth_g5'));
});

test('tank designer validates chassis, gun class and research', () => {
  const g3 = STD_TANKS.find((d) => d.id === 'std_mbt_g3')!;
  assert.deepEqual(tankStats(g3, ['tank_gun_120', 'tank_armor_composite']).errors, []);
  assert.equal(tankStats(g3, []).researched, false);
  const tooBig = { ...g3, chassis: 'light' };
  assert.ok(tankStats(tooBig).errors.some((e) => e.includes('cannot mount')));
  const noEngine = { ...g3, modules: { ...g3.modules, engine: null } };
  assert.ok(tankStats(noEngine).errors.some((e) => e.includes('Engine')));
});

test('jet designer: external hardpoints only on stealth airframes', () => {
  const d = { id: 'x', name: 'x', airframe: 'multirole', modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_srm', special1: 'js_ext' } };
  assert.ok(jetStats(d).errors.some((e) => e.includes('stealth airframe')));
  const stealth = { ...d, airframe: 'stealth_fighter', modules: { ...d.modules, weapon3: 'jw_bvr', weapon4: 'jw_bvr' } };
  const st = jetStats(stealth);
  assert.deepEqual(st.errors, []);
  assert.equal(st.stats.weaponSlots, 4);
  assert.ok(st.stats.stealth < 60);
});

test('division stats: anti-tank battalions raise piercing, support adds effects', () => {
  const s = fresh();
  const nm = nationMil(s, 'POL');
  const [light, inf] = standardTemplates();
  const a = divisionStats(light, nm), b = divisionStats(inf, nm);
  assert.ok(b.piercing > a.piercing);
  assert.ok(b.effects.casualties < 0);
  assert.equal(b.width, 6 * 2 + 2 * 3 + 1);
});

test('player commands: research, war, recruit and orders are validated', () => {
  const s = fresh('POL');
  const nm = nationMil(s, 'POL');
  assert.throws(() => applyCommand(s, { op: 'research', slot: 0, tech: 'jet_gen6' }), CommandError);
  applyCommand(s, { op: 'research', slot: 0, tech: 'doc_air_land' });
  assert.equal(nm.research[0]?.tech, 'doc_air_land');

  // No access to Belarus in peacetime.
  const div = s.military!.divisions.find((d) => d.owner === 'POL')!;
  assert.throws(() => applyCommand(s, { op: 'order', divisions: [div.id], order: { kind: 'move', to: 'BLR' } }), /military access/);
  applyCommand(s, { op: 'declare_war', target: 'BLR' });
  assert.ok(atWar(s, 'POL', 'BLR'));
  assert.ok(atWar(s, 'RUS', 'POL'), 'Russia (relation ≥ 70 with Belarus) joins');
  applyCommand(s, { op: 'order', divisions: [div.id], order: { kind: 'move', to: 'BLR' } });
  assert.equal(div.order?.kind, 'attack');

  const before = s.military!.divisions.length;
  applyCommand(s, { op: 'recruit', template: 'tpl_light_inf', province: 'POL', count: 1 });
  assert.equal(s.military!.divisions.length, before + 1);
});

test('naval landings need a real sea crossing', () => {
  assert.ok(canLand('CHN', 'TWN'));
  assert.ok(canLand('GBR', 'FRA'));
  assert.ok(!canLand('TZA', 'ZWE'), 'Zimbabwe is landlocked');
  assert.ok(!canLand('POL', 'DEU'), 'land neighbours are not naval targets');
});

test('the narrator cannot hand over land between nations at war', () => {
  const s = fresh();
  const r = applyChanges(s, [{ type: 'transfer_province', province: 'UKR', to: 'RUS' }]);
  assert.equal(r.applied.length, 0);
  assert.match(r.rejected[0], /battlefield/);
  const w = applyChanges(s, [{ type: 'declare_war', a: 'CHN', b: 'TWN' }]);
  assert.equal(w.applied.length, 1);
  const p = applyChanges(s, [{ type: 'declare_war', a: 'POL', b: 'BLR' }]);
  assert.match(p.rejected[0], /only the player/);
});

test('a military turn fights battles and keeps the state consistent', () => {
  const s = fresh('BRA');
  for (let i = 0; i < 4; i++) {
    const r = processMilitaryTurn(s);
    s.turn++;
    s.date = nextMonth(s.date);
    if (i === 0) assert.ok(r.battles.some((b) => b.province === 'UKR'), 'Ukraine front is active');
  }
  for (const d of s.military!.divisions) {
    assert.ok(d.strength > 0 && d.strength <= 1, `${d.name} strength ${d.strength}`);
    assert.ok(d.org >= 0, `${d.name} org`);
    assert.ok(s.provinces[d.province], `${d.name} is somewhere real`);
  }
  for (const nm of Object.values(s.military!.nations)) for (const v of Object.values(nm.stockpile)) assert.ok(v >= 0);
});
