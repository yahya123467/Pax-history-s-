import type { Nation, NationId } from '../../../shared/types';

export type NationSeed = Omit<Nation, 'relations' | 'alive' | 'minor' | 'capital'> & { blurb: string };

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  startDate: string;
  startRange: [string, string];
  nations: NationSeed[];
  /** Province -> owner. A nation's first listed province is its capital. */
  owners: Record<string, NationId>;
  provinceNames: Record<string, string>;
  relations: [NationId, NationId, number][];
  openingEvents: string[];
  /** Present => the military layer is enabled for this scenario. */
  military?: ScenarioMilitary;
}

/** Starting military for a nation in a military-enabled scenario. */
export interface MilitarySeed {
  /** 1 = cutting edge, 2 = modern, 3 = legacy. Decides starting research. */
  tier: 1 | 2 | 3;
  factories: number;
  /** Thousands of people available for new divisions. */
  manpower: number;
  inf: number;
  mech: number;
  arm: number;
  /** Combat aircraft. */
  jets: number;
  /** Research slots. */
  slots: number;
  /** Share of fighters that are stealth (needs jet_gen5). */
  stealthShare?: number;
  /** Combat drones (needs ucav). */
  drones?: number;
  /** Standard tank design used by its armored battalions. */
  tank?: string;
  extraTechs?: string[];
}

export interface ScenarioMilitary {
  seeds: Record<NationId, MilitarySeed>;
  wars: [NationId, NationId, string][];
  occupation: [string, NationId, number][];
  deployments: [NationId, string, number][];
}
