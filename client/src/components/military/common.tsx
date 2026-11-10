import type { MilitaryCommand, NationMilitary, WorldState } from '../../../../shared/types';

export interface MilProps {
  state: WorldState;
  nm: NationMilitary;
  /** Sends a command; resolves true on success. */
  run: (cmd: MilitaryCommand) => Promise<boolean>;
  busy: boolean;
}

export const fmt = (n: number, digits = 0) =>
  Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toFixed(digits).replace(/\.0+$/, '');

export const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`;

/** A labelled stat, optionally compared with a baseline (green = better). */
export function Stat({ label, value, base, digits = 1, lowerIsBetter, unit }: { label: string; value: number; base?: number; digits?: number; lowerIsBetter?: boolean; unit?: string }) {
  const diff = base === undefined ? 0 : value - base;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <div className="mstat">
      <span>{label}</span>
      <b>
        {fmt(value, digits)}{unit}
        {base !== undefined && Math.abs(diff) > 0.05 && <em className={better ? 'up' : 'down'}>{diff > 0 ? '+' : ''}{fmt(diff, digits)}</em>}
      </b>
    </div>
  );
}

export function Meter({ value, max = 1, kind = 'str' }: { value: number; max?: number; kind?: 'str' | 'org' | 'occ' }) {
  const w = Math.max(0, Math.min(100, (value / Math.max(0.0001, max)) * 100));
  return <span className={`meter ${kind}`}><i style={{ width: `${w}%` }} /></span>;
}

export const nationName = (state: WorldState, id: string) => state.nations[id]?.name ?? id;
export const Flag = ({ state, id }: { state: WorldState; id: string }) => <i className="flag" style={{ background: state.nations[id]?.color }} />;
