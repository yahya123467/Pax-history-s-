/** Builds the starting military layer (research, designs, divisions, air wings, wars) for a scenario. */
import type { AirWing, Division, MilitaryState, NationMilitary, WorldState } from '../../../shared/types';
import { STD_JETS, standardTemplates } from '../../../shared/military/catalog';
import { divisionStats, jetUnlocked, techMods } from '../../../shared/military/stats';
import type { MilitarySeed, ScenarioMilitary } from '../scenarios/types';
import { ordinal } from './world';

const T3 = ['inf_digital', 'inf_mech', 'jet_gen4', 'missile_bvr', 'doc_depth', 'ind_reserves', 'tank_gun_120', 'tank_armor_composite', 'art_mlrs'];
const T2 = [
  ...T3, 'inf_special', 'inf_nvg', 'inf_atgm', 'tank_eng_turbine', 'tank_fcs_digital', 'tank_armor_era', 'art_counter', 'art_guided', 'art_ad',
  'jet_eng_improved', 'jet_gen45', 'radar_aesa', 'ew_suite', 'ucav', 'doc_combined', 'doc_mission', 'ind_lean',
];
const T1 = [
  ...T2, 'inf_air_assault', 'inf_manpads', 'tank_aps', 'art_loiter', 'stealth_ram', 'missile_ramjet', 'jet_gen5', 'jet_eng_supercruise',
  'doc_air_land', 'doc_network', 'ind_automation',
];
const MINOR_TECHS = ['inf_digital', 'jet_gen4', 'doc_depth', 'tank_gun_120'];
const DEFAULT_TANK: Record<number, string> = { 1: 'std_mbt_g3plus', 2: 'std_mbt_g3', 3: 'std_mbt_legacy' };

function prereqClosure(ids: string[], all: Map<string, string[]>): string[] {
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    for (const r of all.get(id) ?? []) visit(r);
  };
  ids.forEach(visit);
  return [...out];
}

export function buildMilitary(state: WorldState, sc: ScenarioMilitary, techRequires: Map<string, string[]>): MilitaryState {
  const m: MilitaryState = { nations: {}, divisions: [], airWings: [], wars: [], occupation: {}, battles: [], nextId: 1 };
  const id = (p: string) => `${p}${m.nextId++}`;

  for (const nation of Object.values(state.nations)) {
    const seed: MilitarySeed | undefined = sc.seeds[nation.id];
    const completed = seed
      ? prereqClosure([...(seed.tier === 1 ? T1 : seed.tier === 2 ? T2 : T3), ...(seed.extraTechs ?? [])], techRequires)
      : MINOR_TECHS;
    const tank = seed?.tank ?? DEFAULT_TANK[seed?.tier ?? 3];
    const templates = seed ? standardTemplates(tank) : [];
    const nm: NationMilitary = {
      factories: seed?.factories ?? Math.max(1, Math.round(1 + nation.economy / 20)),
      research: Array.from({ length: seed?.slots ?? 1 }, () => null),
      completed,
      manpower: (seed?.manpower ?? 40 + nation.economy) * 1000,
      stockpile: {},
      production: [],
      templates,
      tankDesigns: [],
      jetDesigns: [],
    };
    m.nations[nation.id] = nm;

    // Divisions
    const counts: [string, number][] = seed
      ? [['tpl_infantry', seed.inf], ['tpl_mech', seed.mech], ['tpl_armored', seed.arm]]
      : [[nation.economy >= 45 ? 'tpl_infantry' : 'tpl_light_inf', 1 + Math.floor(nation.economy / 35)]];
    const mods = techMods(completed);
    const divs: Division[] = [];
    const reserve: Record<string, number> = {};
    for (const [tplId, count] of counts) {
      const tpl = (templates.length ? templates : standardTemplates()).find((x) => x.id === tplId)!;
      const st = divisionStats(tpl, nm, mods);
      for (let i = 0; i < count; i++) {
        const d: Division = {
          id: id('d'), name: `${ordinal(i + 1)} ${tpl.name}`, owner: nation.id, template: tpl.id, province: nation.capital,
          strength: 1, org: st.org, status: 'ready', readyIn: 0, entrench: 2, experience: 0.2, order: null,
        };
        divs.push(d);
        for (const [item, k] of Object.entries(st.equipment)) reserve[item] = (reserve[item] ?? 0) + k;
      }
    }
    // Stockpile: ~25% spare equipment for reinforcements, plus a bit of everything.
    for (const [item, k] of Object.entries(reserve)) nm.stockpile[item] = Math.round(k * 0.25);
    nm.stockpile.small_arms = (nm.stockpile.small_arms ?? 0) + 200;
    m.divisions.push(...divs);

    // Deployments abroad / at the front
    for (const [who, province, share] of sc.deployments) {
      if (who !== nation.id) continue;
      const k = Math.max(1, Math.round(divs.length * share));
      divs.filter((d) => d.province === nation.capital).slice(0, k).forEach((d) => (d.province = province));
    }

    // Air force
    if (seed && seed.jets > 0) {
      const stealthOk = completed.includes('jet_gen5');
      const best = completed.includes('jet_gen45') ? 'std_multirole_g45' : 'std_multirole_g4';
      const stealth = stealthOk ? Math.round(seed.jets * (seed.stealthShare ?? 0)) : 0;
      const strike = Math.round((seed.jets - stealth) * 0.35);
      const fighters = seed.jets - stealth - strike;
      const wing = (design: string, count: number, mission: AirWing['mission'], name: string) => {
        if (count <= 0) return;
        const d = STD_JETS.find((j) => j.id === design)!;
        if (!jetUnlocked(d, completed)) return;
        m.airWings.push({ id: id('w'), name, owner: nation.id, design, count, province: nation.capital, mission });
        nm.stockpile[`jet:${design}`] = Math.round(count * 0.1);
      };
      wing(best, fighters, 'superiority', '1st Fighter Wing');
      wing('std_strike_g4', strike, 'ground_support', '1st Strike Wing');
      wing('std_stealth_g5', stealth, 'superiority', '1st Stealth Wing');
      if (seed.drones && completed.includes('ucav')) wing('std_ucav', seed.drones, 'ground_support', '1st Drone Wing');
    }

    // Starting production: keep the existing force topped up.
    const f = nm.factories;
    const line = (item: string, share: number) => {
      const factories = Math.floor(f * share);
      if (factories > 0) nm.production.push({ id: id('p'), item, factories });
    };
    if (seed) {
      line(`tank:${tank}`, 0.25);
      line('small_arms', 0.15);
      line('artillery', 0.15);
      line('ifv', 0.1);
      line('air_defense', 0.05);
      line('drones', 0.05);
      line(`jet:${completed.includes('jet_gen45') ? 'std_multirole_g45' : 'std_multirole_g4'}`, 0.15);
    } else {
      line('small_arms', 0.6);
      line('artillery', 0.4);
    }
  }

  for (const [a, b, since] of sc.wars) if (state.nations[a] && state.nations[b]) m.wars.push({ a, b, since });
  for (const [prov, by, progress] of sc.occupation) if (state.provinces[prov]) m.occupation[prov] = { by, progress };
  // Forces deployed into a province of a nation they're at war with start dug in on the line.
  return m;
}
