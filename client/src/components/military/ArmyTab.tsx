import { useMemo, useState } from 'react';
import type { AirMission } from '../../../../shared/types';
import { standardTemplates } from '../../../../shared/military/catalog';
import { allJets, divisionStats, findJet, jetStats } from '../../../../shared/military/stats';
import type { GeoInfo } from '../../lib/api';
import { Flag, fmt, Meter, nationName, type MilProps } from './common';

const STD = standardTemplates();

export function ArmyTab({ state, nm, run, busy, geo, onLocate }: MilProps & { geo: GeoInfo | null; onLocate: (province: string) => void }) {
  const me = state.playerNation;
  const m = state.military!;
  const templates = [...nm.templates, ...STD.filter((s) => !nm.templates.some((t) => t.id === s.id))];
  const mine = m.divisions.filter((d) => d.owner === me);
  const byProvince = useMemo(() => {
    const g = new Map<string, typeof mine>();
    for (const d of mine) g.set(d.province, [...(g.get(d.province) ?? []), d]);
    return [...g].sort((a, b) => b[1].length - a[1].length);
  }, [mine]);
  const ownProvinces = Object.values(state.provinces).filter((p) => p.owner === me);
  const [tpl, setTpl] = useState(templates[1]?.id ?? templates[0]?.id ?? '');
  const [where, setWhere] = useState(state.nations[me].capital);
  const [count, setCount] = useState(1);
  const [warTarget, setWarTarget] = useState('');
  const wars = m.wars.filter((w) => w.a === me || w.b === me).map((w) => (w.a === me ? w.b : w.a));
  const tplObj = templates.find((t) => t.id === tpl);
  const tplStats = tplObj ? divisionStats(tplObj, nm) : null;
  const wings = m.airWings.filter((w) => w.owner === me);
  const jetStock = allJets(nm).filter((d) => (nm.stockpile[`jet:${d.id}`] ?? 0) >= 1);
  const [wingDesign, setWingDesign] = useState('');
  const friendly = useMemo(
    () => Object.values(state.provinces).filter((p) => p.owner === me || (state.nations[p.owner]?.relations[me] ?? 0) >= 50 || new Set(mine.map((d) => d.province)).has(p.id)),
    [state.provinces, state.nations, me, mine],
  );

  return (
    <div className="army">
      <section className="army-divisions">
        <h3>Divisions <span className="muted small">{mine.length} total · {mine.filter((d) => d.status === 'training').length} training</span></h3>
        <p className="small muted">Click a province on the map to give orders: select divisions, then choose a target (or click “Pick on map”).</p>
        {byProvince.map(([prov, divs]) => {
          const contested = m.divisions.some((d) => d.province === prov && m.wars.some((w) => (w.a === me && w.b === d.owner) || (w.b === me && w.a === d.owner)));
          return (
            <div key={prov} className="prov-group">
              <div className="row">
                <button className="link" onClick={() => onLocate(prov)}>{state.provinces[prov]?.name ?? prov}</button>
                <span className="small muted">{geo?.[prov]?.terrain} {contested && <b className="warn-text">· battle</b>}</span>
              </div>
              {divs.map((d) => {
                const tplD = templates.find((t) => t.id === d.template);
                const max = tplD ? divisionStats(tplD, nm).org : 1;
                return (
                  <div key={d.id} className="div-row">
                    <span className="div-name">{d.name}</span>
                    {d.status === 'training' ? <span className="small muted">training · {d.readyIn} turn(s)</span> : (
                      <>
                        <span className="small" title="Strength"><Meter value={d.strength} /> {Math.round(d.strength * 100)}%</span>
                        <span className="small" title="Organisation"><Meter value={d.org} max={max} kind="org" /> {Math.round(d.org)}</span>
                      </>
                    )}
                    <span className="small muted">{d.order ? `→ ${d.order.kind} ${state.provinces[d.order.to]?.name}` : d.entrench ? `dug in ${Math.round(d.entrench)}` : ''}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      <section className="army-side">
        <h3>Raise divisions</h3>
        <div className="form">
          <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={where} onChange={(e) => setWhere(e.target.value)}>
            {ownProvinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          <button className="btn primary" disabled={busy || !tplObj} onClick={() => run({ op: 'recruit', template: tpl, province: where, count })}>Recruit</button>
        </div>
        {tplStats && (
          <p className="small muted">
            Each: {fmt(tplStats.manpower)} troops, {fmt(tplStats.cost)} IC of equipment. You have {fmt(nm.manpower)} manpower. Ready in 2 turns.
          </p>
        )}

        <h3>Air force</h3>
        {wings.length === 0 && <p className="small muted">No air wings.</p>}
        {wings.map((w) => {
          const d = findJet(nm, w.design);
          const js = d ? jetStats(d).stats : null;
          const stock = Math.floor(nm.stockpile[`jet:${w.design}`] ?? 0);
          return (
            <div key={w.id} className="wing-row">
              <div>
                <strong>{w.name}</strong> <span className="small muted">{w.count} × {d?.name ?? w.design} · radius {js ? Math.round(js.range / 2) : '?'} km</span>
              </div>
              <div className="form">
                <select value={w.province} disabled={busy} onChange={(e) => run({ op: 'wing', id: w.id, province: e.target.value })}>
                  {friendly.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {!friendly.some((p) => p.id === w.province) && <option value={w.province}>{state.provinces[w.province]?.name}</option>}
                </select>
                <select value={w.mission} disabled={busy} onChange={(e) => run({ op: 'wing', id: w.id, mission: e.target.value as AirMission })}>
                  <option value="superiority">Air superiority</option>
                  <option value="ground_support">Ground support</option>
                </select>
                {stock > 0 && <button className="btn" disabled={busy} onClick={() => run({ op: 'wing', id: w.id, count: w.count + stock })}>+{stock} from stock</button>}
              </div>
            </div>
          );
        })}
        {jetStock.length > 0 && (
          <div className="form">
            <select value={wingDesign} onChange={(e) => setWingDesign(e.target.value)}>
              <option value="">New wing from stock…</option>
              {jetStock.map((d) => <option key={d.id} value={d.id}>{d.name} ({Math.floor(nm.stockpile[`jet:${d.id}`] ?? 0)})</option>)}
            </select>
            <button className="btn" disabled={busy || !wingDesign}
              onClick={() => run({ op: 'create_wing', design: wingDesign, count: Math.floor(nm.stockpile[`jet:${wingDesign}`] ?? 0), province: state.nations[me].capital, mission: 'superiority' })}>
              Form wing
            </button>
          </div>
        )}

        <h3>War</h3>
        {wars.length === 0 && <p className="small muted">You are at peace.</p>}
        {wars.map((id) => (
          <div key={id} className="row war-row">
            <span><Flag state={state} id={id} /> At war with <b>{nationName(state, id)}</b></span>
            <button className="btn" disabled={busy} onClick={() => run({ op: 'propose_peace', target: id })}>Propose peace</button>
          </div>
        ))}
        <div className="form">
          <select value={warTarget} onChange={(e) => setWarTarget(e.target.value)}>
            <option value="">Declare war on…</option>
            {Object.values(state.nations).filter((n) => n.alive && n.id !== me && !wars.includes(n.id)).sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
              <option key={n.id} value={n.id}>{n.name}{n.minor ? ' (minor)' : ''} · relation {n.relations[me] ?? 0}</option>
            ))}
          </select>
          <button className="btn danger" disabled={busy || !warTarget}
            onClick={() => { if (confirm(`Declare war on ${nationName(state, warTarget)}? Its close allies (relation ≥ 70) will join against you.`)) void run({ op: 'declare_war', target: warTarget }); }}>
            Declare war
          </button>
        </div>
        <p className="small muted">Close friends of the target (relation ≥ 70) join the war against you. Troops can only enter foreign land at war, or with military access (relation ≥ 50).</p>
        {wings.length > 0 && <p className="small muted">Wings support every battle within their combat radius (border-to-border), splitting their effort.</p>}
      </section>
    </div>
  );
}
