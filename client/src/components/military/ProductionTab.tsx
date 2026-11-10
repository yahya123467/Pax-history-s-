import { useEffect, useState } from 'react';
import type { ProductionLine } from '../../../../shared/types';
import { EQUIPMENT, IC_PER_FACTORY, TECH_BY_ID } from '../../../../shared/military/catalog';
import { allJets, allTanks, equipmentCost, equipmentName, jetStats, productionEfficiency, tankStats } from '../../../../shared/military/stats';
import { fmt, type MilProps } from './common';

export function ProductionTab({ state, nm, run, busy }: MilProps) {
  const me = state.nations[state.playerNation];
  const [lines, setLines] = useState<ProductionLine[]>(() => structuredClone(nm.production));
  useEffect(() => { setLines(structuredClone(nm.production)); }, [nm.production]);
  const eff = productionEfficiency(nm, me.economy, me.stability);
  const used = lines.reduce((a, l) => a + (Number(l.factories) || 0), 0);
  const dirty = JSON.stringify(lines) !== JSON.stringify(nm.production);

  const items: { id: string; name: string; locked?: string }[] = [
    ...EQUIPMENT.map((e) => ({ id: e.id, name: e.name, locked: e.requires && !nm.completed.includes(e.requires) ? TECH_BY_ID.get(e.requires)?.name : undefined })),
    ...allTanks(nm).filter((d) => !d.obsolete).map((d) => ({ id: `tank:${d.id}`, name: `Tank: ${d.name}`, locked: tankStats(d, nm.completed).researched ? undefined : 'research' })),
    ...allJets(nm).filter((d) => !d.obsolete).map((d) => ({ id: `jet:${d.id}`, name: `Aircraft: ${d.name}`, locked: jetStats(d, nm.completed).researched ? undefined : 'research' })),
  ];
  const perMonth = (l: ProductionLine) => (l.factories * IC_PER_FACTORY * eff) / Math.max(0.1, equipmentCost(l.item, nm));

  // Equipment fielded by your divisions (to show what reinforcement needs).
  const stock = Object.entries(nm.stockpile).filter(([, k]) => k >= 0.5).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="production">
      <section>
        <div className="row">
          <h3>Production lines</h3>
          <span className={used > nm.factories ? 'warn-text' : 'muted'}>
            {used} / {nm.factories} factories · {IC_PER_FACTORY} IC each · efficiency {Math.round(eff * 100)}% (research, economy, stability)
          </span>
        </div>
        <table className="lines">
          <thead><tr><th>Item</th><th>Factories</th><th>Unit cost</th><th>Output / month</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id || i}>
                <td>
                  <select value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}>
                    {items.map((it) => <option key={it.id} value={it.id} disabled={!!it.locked}>{it.name}{it.locked ? ` 🔒 ${it.locked}` : ''}</option>)}
                    {!items.some((it) => it.id === l.item) && <option value={l.item}>{equipmentName(l.item, nm)} (obsolete)</option>}
                  </select>
                </td>
                <td>
                  <input type="number" min={0} max={nm.factories} value={l.factories}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, factories: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))} />
                </td>
                <td className="muted">{equipmentCost(l.item, nm).toFixed(1)} IC</td>
                <td><b>{fmt(perMonth(l), 1)}</b></td>
                <td><button className="link" onClick={() => setLines(lines.filter((_, j) => j !== i))}>remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <button className="btn" onClick={() => setLines([...lines, { id: '', item: 'small_arms', factories: Math.max(0, nm.factories - used) }])}>+ Add line</button>
          <span>
            {dirty && <button className="btn" onClick={() => setLines(structuredClone(nm.production))}>Reset</button>}
            <button className="btn primary" disabled={busy || !dirty || used > nm.factories} onClick={() => run({ op: 'set_production', lines })}>Apply</button>
          </span>
        </div>
        <p className="small muted">
          Equipment goes into the stockpile. Divisions draw on it to reinforce after battles (up to 25% strength per month)
          and new divisions need a full set to start training. Aircraft in stock can form or reinforce air wings on the Army tab.
        </p>
      </section>
      <section>
        <h3>Stockpile</h3>
        <table className="stock small">
          <tbody>
            <tr><td>Manpower</td><td><b>{fmt(nm.manpower)}</b></td></tr>
            {stock.map(([item, k]) => <tr key={item}><td>{equipmentName(item, nm)}</td><td><b>{fmt(Math.floor(k))}</b></td></tr>)}
          </tbody>
        </table>
      </section>
    </div>
  );
}
