import { useEffect, useMemo, useState } from 'react';
import type { MilitaryCommand, WorldState } from '../../../../shared/types';
import { standardTemplates, TERRAIN } from '../../../../shared/military/catalog';
import { divisionStats } from '../../../../shared/military/stats';
import type { GeoInfo } from '../../lib/api';
import { Flag, fmt, Meter, nationName } from './common';

const STD = standardTemplates();

interface Props {
  state: WorldState;
  provinceId: string;
  geo: GeoInfo | null;
  busy: boolean;
  run: (cmd: MilitaryCommand) => Promise<boolean>;
  onPickTarget: (divisions: string[]) => void;
}

export function ProvinceMilitary({ state, provinceId, geo, busy, run, onPickTarget }: Props) {
  const m = state.military!;
  const me = state.playerNation;
  const prov = state.provinces[provinceId];
  const info = geo?.[provinceId];
  const terrain = TERRAIN[info?.terrain ?? 'plains'];
  const here = m.divisions.filter((d) => d.province === provinceId);
  const mine = here.filter((d) => d.owner === me);
  const others = useMemo(() => {
    const g = new Map<string, number>();
    for (const d of here) if (d.owner !== me) g.set(d.owner, (g.get(d.owner) ?? 0) + 1);
    return [...g];
  }, [here, me]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { setSel(new Set(mine.filter((d) => d.status === 'ready').map((d) => d.id))); }, [provinceId, mine.length]);
  const [target, setTarget] = useState('');
  const occ = m.occupation[provinceId];
  const atWarWith = (id: string) => m.wars.some((w) => (w.a === me && w.b === id) || (w.b === me && w.a === id));
  const nm = m.nations[me];
  const orgMax = (tpl: string) => {
    const t = nm.templates.find((x) => x.id === tpl) ?? STD.find((x) => x.id === tpl);
    return t ? divisionStats(t, nm).org : 1;
  };
  const lockedIn = here.some((d) => atWarWith(d.owner));
  const destinations = (info ? [...info.n.map((id) => ({ id, sea: false })), ...info.sea.map((id) => ({ id, sea: true }))] : [])
    // Divisions locked in battle here can only withdraw to friendly ground.
    .filter(({ id }) => !lockedIn || (state.provinces[id] && !atWarWith(state.provinces[id].owner) && !m.divisions.some((d) => d.province === id && atWarWith(d.owner))));
  const selected = [...sel];

  return (
    <div className="prov-mil">
      <div className="small muted">
        Terrain: <b>{terrain.name}</b> (frontage {terrain.width}, attacker {Math.round(terrain.attack * 100)}%) · {info ? `${fmt(info.area)} km²` : ''}
      </div>
      {occ && (
        <div className="occ small">
          <span>Occupied by {nationName(state, occ.by)}</span>
          <Meter value={occ.progress} max={100} kind="occ" />
          <b>{Math.round(occ.progress)}%</b>
        </div>
      )}
      {others.length > 0 && (
        <div className="small">
          {others.map(([id, k]) => (
            <div key={id} className={atWarWith(id) ? 'bad-text' : ''}>
              <Flag state={state} id={id} /> {nationName(state, id)}: {k} division{k === 1 ? '' : 's'}{atWarWith(id) ? ' (enemy)' : ''}
            </div>
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <>
          <div className="row small">
            <b>Your divisions ({mine.length})</b>
            <button className="link small" onClick={() => setSel(sel.size ? new Set() : new Set(mine.filter((d) => d.status === 'ready').map((d) => d.id)))}>
              {sel.size ? 'none' : 'all'}
            </button>
          </div>
          <div className="mil-divs">
            {mine.map((d) => (
              <label key={d.id} className="div-pick small">
                <input type="checkbox" disabled={d.status !== 'ready'} checked={sel.has(d.id)}
                  onChange={(e) => { const s = new Set(sel); e.target.checked ? s.add(d.id) : s.delete(d.id); setSel(s); }} />
                <span className="div-name">{d.name}</span>
                {d.status === 'training' ? <span className="muted">training</span> : (
                  <>
                    <Meter value={d.strength} />
                    <Meter value={d.org} max={orgMax(d.template)} kind="org" />
                  </>
                )}
                {d.order && <span className="muted">→ {state.provinces[d.order.to]?.name}</span>}
              </label>
            ))}
          </div>
          <div className="form">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Order to…</option>
              {destinations.map(({ id, sea }) => {
                const p = state.provinces[id];
                if (!p) return null;
                const enemy = atWarWith(p.owner);
                return <option key={id} value={id}>{sea ? '⛴ ' : ''}{p.name}{enemy ? ' (attack)' : p.owner !== me ? ` (${nationName(state, p.owner)})` : ''}</option>;
              })}
            </select>
            <button className="btn primary" disabled={busy || !target || !selected.length}
              onClick={async () => { if (await run({ op: 'order', divisions: selected, order: { kind: 'move', to: target } })) setTarget(''); }}>Go</button>
            <button className="btn" disabled={busy || !selected.length} onClick={() => onPickTarget(selected)} title="Then click a province on the map">Pick on map</button>
            {mine.some((d) => d.order) && <button className="btn" disabled={busy} onClick={() => run({ op: 'order', divisions: mine.map((d) => d.id), order: null })}>Cancel orders</button>}
          </div>
          <p className="small muted">
            {lockedIn ? 'Your divisions here are locked in battle and keep fighting each turn. They can only withdraw to friendly ground. ' : ''}
            Orders execute at End Turn. Moving into enemy land attacks it; ⛴ marks a naval landing (amphibious penalty).
          </p>
        </>
      )}
      {prov.owner !== me && !atWarWith(prov.owner) && state.nations[prov.owner]?.alive && (
        <button className="btn danger" disabled={busy}
          onClick={() => { if (confirm(`Declare war on ${nationName(state, prov.owner)}? Its close allies will join against you.`)) void run({ op: 'declare_war', target: prov.owner }); }}>
          Declare war on {nationName(state, prov.owner)}
        </button>
      )}
    </div>
  );
}
