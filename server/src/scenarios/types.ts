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
}
