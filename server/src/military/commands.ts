/** Player military commands. Every command is validated against the rules; failures throw CommandError. */
import type { DivisionTemplate, JetDesign, MilitaryCommand, TankDesign, WorldState } from '../../../shared/types';
import { EQUIPMENT_BY_ID, GRID_COLS, GRID_ROWS, SUPPORT_SLOTS, TECH_BY_ID } from '../../../shared/military/catalog';
import { divisionStats, findJet, findTank, jetStats, tankStats, techState } from '../../../shared/military/stats';
import { addEvent, clamp, getRelation, setRelation } from '../state/world';
import { aiAcceptsPeace, canEquip, consume } from './ai';
import { seededRng } from './turn';
import {
  atWar, canEnter, canLand, cleanupPositions, enemiesOf, findTemplate, isAdjacent, mil, NAVAL_RANGE_KM, nationMil, newId, ordinal, StatCache,
} from './world';

export class CommandError extends Error {}
const fail = (msg: string): never => { throw new CommandError(msg); };

/** Applies a command for the player's nation. Returns a short message for the UI. */
export function applyCommand(state: WorldState, cmd: MilitaryCommand): string {
  const me = state.playerNation;
  const nm = nationMil(state, me);
  const m = mil(state);

  switch (cmd.op) {
    case 'research': {
      if (cmd.slot < 0 || cmd.slot >= nm.research.length) fail('No such research slot');
      if (cmd.tech === null) { nm.research[cmd.slot] = null; return 'Research slot cleared'; }
      const tech = TECH_BY_ID.get(cmd.tech) ?? fail(`Unknown technology ${cmd.tech}`);
      const st = techState(tech, nm);
      if (st === 'done') fail(`${tech.name} is already researched`);
      if (st === 'researching') fail(`${tech.name} is already being researched`);
      if (st === 'locked') fail(`${tech.name} needs: ${tech.requires.filter((r) => !nm.completed.includes(r)).map((r) => TECH_BY_ID.get(r)?.name).join(', ')}`);
      nm.research[cmd.slot] = { tech: tech.id, progress: 0 };
      return `Researching ${tech.name}`;
    }

    case 'save_tank': {
      const d = sanitizeName(cmd.design) as TankDesign;
      const check = tankStats(d, nm.completed);
      if (check.errors.length) fail(check.errors.join('; '));
      if (!check.researched) fail(`Not researched yet: ${check.missing.map((x) => TECH_BY_ID.get(x)?.name ?? x).join(', ')}`);
      return saveDesign(state, nm.tankDesigns, d, 'tank');
    }

    case 'save_jet': {
      const d = sanitizeName(cmd.design) as JetDesign;
      const check = jetStats(d, nm.completed);
      if (check.errors.length) fail(check.errors.join('; '));
      if (!check.researched) fail(`Not researched yet: ${check.missing.map((x) => TECH_BY_ID.get(x)?.name ?? x).join(', ')}`);
      return saveDesign(state, nm.jetDesigns, d, 'jet');
    }

    case 'obsolete_design': {
      const list = cmd.kind === 'tank' ? nm.tankDesigns : nm.jetDesigns;
      const d = list.find((x) => x.id === cmd.id) ?? fail('Only your own designs can be marked obsolete');
      d.obsolete = cmd.obsolete;
      return `${d.name} ${cmd.obsolete ? 'marked obsolete' : 'restored'}`;
    }

    case 'save_template': {
      const t = cmd.template;
      const tpl: DivisionTemplate = {
        id: t.id && nm.templates.some((x) => x.id === t.id) ? t.id : newId(state, 'tpl'),
        name: t.name.trim().slice(0, 40) || 'New Division',
        combat: Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => t.combat[i] ?? null),
        support: Array.from({ length: SUPPORT_SLOTS }, (_, i) => t.support[i] ?? null),
      };
      for (const s of tpl.combat) if (s?.design && !findTank(nm, s.design)) fail(`Unknown tank design ${s.design}`);
      const st = divisionStats(tpl, nm);
      if (st.errors.length) fail(st.errors.join('; '));
      const i = nm.templates.findIndex((x) => x.id === tpl.id);
      if (i >= 0) nm.templates[i] = tpl;
      else nm.templates.push(tpl);
      return `Template "${tpl.name}" saved (width ${st.width})`;
    }

    case 'delete_template': {
      if (m.divisions.some((d) => d.owner === me && d.template === cmd.id)) fail('Divisions still use this template');
      nm.templates = nm.templates.filter((x) => x.id !== cmd.id);
      return 'Template deleted';
    }

    case 'set_production': {
      const total = cmd.lines.reduce((a, l) => a + Math.max(0, Math.floor(l.factories)), 0);
      if (total > nm.factories) fail(`You only have ${nm.factories} factories (assigned ${total})`);
      for (const l of cmd.lines) {
        if (l.item.startsWith('tank:')) {
          const d = findTank(nm, l.item.slice(5)) ?? fail('Unknown tank design');
          if (!tankStats(d, nm.completed).researched) fail(`${d.name} uses parts you haven't researched`);
        } else if (l.item.startsWith('jet:')) {
          const d = findJet(nm, l.item.slice(4)) ?? fail('Unknown aircraft design');
          if (!jetStats(d, nm.completed).researched) fail(`${d.name} uses parts you haven't researched`);
        } else {
          const e = EQUIPMENT_BY_ID.get(l.item) ?? fail(`Unknown equipment ${l.item}`);
          if (e.requires && !nm.completed.includes(e.requires)) fail(`${e.name} needs ${TECH_BY_ID.get(e.requires)?.name}`);
        }
      }
      nm.production = cmd.lines
        .filter((l) => l.factories > 0)
        .map((l) => ({ id: l.id || newId(state, 'p'), item: l.item, factories: Math.floor(l.factories) }));
      return `Production updated (${total}/${nm.factories} factories)`;
    }

    case 'recruit': {
      const tpl = findTemplate(nm, cmd.template) ?? fail('Unknown template');
      const prov = state.provinces[cmd.province] ?? fail('Unknown province');
      if (prov.owner !== me) fail('Divisions can only be raised in your own provinces');
      if (m.divisions.some((d) => d.province === prov.id && atWar(state, me, d.owner))) fail(`${prov.name} is a battlefield`);
      const count = clamp(Math.floor(cmd.count), 1, 10);
      const st = new StatCache(state).div({ owner: me, template: tpl.id });
      if (!canEquip(nm, st.equipment, st.manpower, count)) {
        const short = Object.entries(st.equipment).filter(([item, k]) => (nm.stockpile[item] ?? 0) < k * count).map(([item]) => item);
        fail(`Not enough ${[...short, ...(nm.manpower < st.manpower * count ? ['manpower'] : [])].join(', ')} for ${count} × ${tpl.name}`);
      }
      consume(nm, st.equipment, st.manpower, count);
      const existing = m.divisions.filter((d) => d.owner === me && d.template === tpl.id).length;
      for (let i = 0; i < count; i++) {
        m.divisions.push({
          id: newId(state, 'd'), name: `${ordinal(existing + i + 1)} ${tpl.name}`, owner: me, template: tpl.id, province: prov.id,
          strength: 1, org: 0, status: 'training', readyIn: 2, entrench: 0, experience: 0, order: null,
        });
      }
      return `${count} × ${tpl.name} in training at ${prov.name} (ready in 2 turns)`;
    }

    case 'order': {
      const divs = cmd.divisions.map((id) => m.divisions.find((d) => d.id === id && d.owner === me) ?? fail(`Unknown division ${id}`));
      if (!cmd.order) { divs.forEach((d) => (d.order = null)); return 'Orders cancelled'; }
      const to = cmd.order.to;
      const prov = state.provinces[to] ?? fail('Unknown province');
      for (const d of divs) {
        if (d.status !== 'ready') fail(`${d.name} is still training`);
        if (d.province === to) fail(`${d.name} is already in ${prov.name}`);
        const access = canEnter(state, me, to);
        if (!access) fail(`No military access to ${prov.name}. Declare war or improve relations (≥ 50).`);
        const adjacent = isAdjacent(d.province, to);
        if (!adjacent && !canLand(d.province, to)) fail(`${d.name} cannot reach ${prov.name}: not a land neighbour, and no sea crossing under ${NAVAL_RANGE_KM} km between the coasts`);
        const hostile = access === 'hostile' || m.divisions.some((x) => x.province === to && atWar(state, me, x.owner));
        const lockedIn = m.divisions.some((x) => x.province === d.province && atWar(state, me, x.owner));
        if (lockedIn && hostile) fail(`${d.name} is locked in battle in ${state.provinces[d.province].name}: it can fight on there or withdraw to friendly ground, but not attack elsewhere`);
        d.order = { kind: !adjacent ? 'naval' : hostile ? 'attack' : 'move', to };
      }
      const kind = divs[0].order!.kind;
      return `${divs.length} division(s) ordered to ${kind === 'attack' ? 'attack' : kind === 'naval' ? 'land in' : 'move to'} ${prov.name}`;
    }

    case 'disband': {
      const d = m.divisions.find((x) => x.id === cmd.division && x.owner === me) ?? fail('Unknown division');
      const st = new StatCache(state).div(d);
      nm.manpower += st.manpower * d.strength * 0.5;
      for (const [item, k] of Object.entries(st.equipment)) nm.stockpile[item] = (nm.stockpile[item] ?? 0) + k * d.strength * 0.5;
      m.divisions = m.divisions.filter((x) => x !== d);
      return `${d.name} disbanded`;
    }

    case 'create_wing': {
      const design = findJet(nm, cmd.design) ?? fail('Unknown aircraft design');
      const key = `jet:${design.id}`;
      const count = Math.floor(cmd.count);
      if (count < 1) fail('A wing needs at least one aircraft');
      if ((nm.stockpile[key] ?? 0) < count) fail(`Only ${Math.floor(nm.stockpile[key] ?? 0)} ${design.name} in stock`);
      if (canEnter(state, me, cmd.province) !== 'friendly') fail('Wings can only be based on friendly ground');
      nm.stockpile[key] -= count;
      const n = m.airWings.filter((w) => w.owner === me).length + 1;
      m.airWings.push({ id: newId(state, 'w'), name: `${ordinal(n)} Air Wing`, owner: me, design: design.id, count, province: cmd.province, mission: cmd.mission });
      return `${count} × ${design.name} formed a new wing`;
    }

    case 'wing': {
      const w = m.airWings.find((x) => x.id === cmd.id && x.owner === me) ?? fail('Unknown wing');
      if (cmd.province) {
        if (canEnter(state, me, cmd.province) !== 'friendly') fail('Wings can only be based on friendly ground');
        w.province = cmd.province;
      }
      if (cmd.mission) w.mission = cmd.mission;
      if (cmd.count !== undefined) {
        const key = `jet:${w.design}`;
        const diff = Math.floor(cmd.count) - w.count;
        if (diff > 0 && (nm.stockpile[key] ?? 0) < diff) fail(`Only ${Math.floor(nm.stockpile[key] ?? 0)} aircraft in stock`);
        nm.stockpile[key] = (nm.stockpile[key] ?? 0) - diff;
        w.count += diff;
        if (w.count <= 0) m.airWings = m.airWings.filter((x) => x !== w);
      }
      return `${w.name} updated`;
    }

    case 'declare_war': {
      const target = state.nations[cmd.target] ?? fail('Unknown nation');
      if (target.id === me) fail('You cannot declare war on yourself');
      if (!target.alive) fail(`${target.name} no longer exists`);
      if (atWar(state, me, target.id)) fail(`Already at war with ${target.name}`);
      const joined = declareWar(state, me, target.id);
      return `War declared on ${target.name}${joined.length ? `. ${joined.join(', ')} joined in its defense` : ''}`;
    }

    case 'propose_peace': {
      const target = state.nations[cmd.target] ?? fail('Unknown nation');
      if (!atWar(state, me, target.id)) fail(`You are not at war with ${target.name}`);
      const rng = seededRng(state.turn * 104729 + m.nextId);
      if (!aiAcceptsPeace(state, target.id, me, new StatCache(state), rng)) {
        addEvent(state, 'diplomacy', `${target.name} rejected ${state.nations[me].name}'s peace proposal.`);
        return `${target.name} rejected peace`;
      }
      makePeace(state, me, target.id);
      return `Peace signed with ${target.name}`;
    }
  }
}

function sanitizeName<T extends { name: string }>(d: T): T {
  return { ...d, name: d.name.trim().slice(0, 40) || 'Unnamed design' };
}

function saveDesign<T extends TankDesign | JetDesign>(state: WorldState, list: T[], d: T, kind: 'tank' | 'jet'): string {
  const nm = nationMil(state, state.playerNation);
  const existing = list.find((x) => x.id === d.id);
  const inUse = existing && ((nm.stockpile[`${kind}:${d.id}`] ?? 0) >= 1 || nm.production.some((l) => l.item === `${kind}:${d.id}`)
    || mil(state).airWings.some((w) => w.owner === state.playerNation && w.design === d.id)
    || nm.templates.some((t) => t.combat.some((s) => s?.design === d.id)));
  if (existing && !inUse) {
    Object.assign(existing, { ...d, obsolete: false });
    return `${d.name} updated`;
  }
  const id = newId(state, kind === 'tank' ? 'tank_' : 'jet_');
  list.push({ ...d, id, obsolete: false });
  return existing ? `${d.name} saved as a new variant (the old one is in use)` : `${d.name} saved`;
}

/** Starts a war. Close friends of the defender (relation ≥ 70, major) join. Returns the joiners' names. */
export function declareWar(state: WorldState, a: string, b: string): string[] {
  const m = mil(state);
  if (atWar(state, a, b)) return [];
  m.wars.push({ a, b, since: state.date });
  setRelation(state, a, b, Math.min(getRelation(state, a, b), -60) - 20);
  const na = state.nations[a], nb = state.nations[b];
  na.stability = clamp(na.stability - 3, 0, 100);
  addEvent(state, 'world', `${na.name} declared war on ${nb.name}.`);
  const joined: string[] = [];
  for (const ally of Object.values(state.nations)) {
    if (!ally.alive || ally.minor || ally.id === a || ally.id === b) continue;
    if (getRelation(state, ally.id, b) >= 70 && getRelation(state, ally.id, a) < 50 && !atWar(state, ally.id, a)) {
      m.wars.push({ a: ally.id, b: a, since: state.date });
      setRelation(state, ally.id, a, Math.min(getRelation(state, ally.id, a), -50));
      addEvent(state, 'world', `${ally.name} entered the war on the side of ${nb.name}.`);
      joined.push(ally.name);
    }
  }
  return joined;
}

export function makePeace(state: WorldState, a: string, b: string) {
  const m = mil(state);
  m.wars = m.wars.filter((w) => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
  setRelation(state, a, b, getRelation(state, a, b) + 20);
  addEvent(state, 'diplomacy', `${state.nations[a].name} and ${state.nations[b].name} signed a peace agreement.`);
  for (const note of cleanupPositions(state)) addEvent(state, 'system', note);
  void enemiesOf;
}
