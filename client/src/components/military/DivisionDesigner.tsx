import { useMemo, useState } from 'react';
import type { BattalionSlot, DivisionTemplate } from '../../../../shared/types';
import { BATTALIONS, BATTALION_BY_ID, GRID_COLS, GRID_ROWS, standardTemplates, SUPPORT_SLOTS, TECH_BY_ID } from '../../../../shared/military/catalog';
import { allTanks, divisionStats, equipmentName, tankStats } from '../../../../shared/military/stats';
import { fmt, Stat, type MilProps } from './common';

const STD = standardTemplates();
const empty = (): DivisionTemplate => ({
  id: '', name: 'New Division',
  combat: Array.from({ length: GRID_COLS * GRID_ROWS }, () => null),
  support: Array.from({ length: SUPPORT_SLOTS }, () => null),
});

type Pick = { kind: 'combat'; index: number } | { kind: 'support'; index: number } | null;

export function DivisionDesigner({ state, nm, run, busy }: MilProps) {
  const templates = [...nm.templates, ...STD.filter((s) => !nm.templates.some((t) => t.id === s.id))];
  const [draft, setDraft] = useState<DivisionTemplate>(() => structuredClone(templates[1] ?? templates[0] ?? empty()));
  const [baseId, setBaseId] = useState(draft.id);
  const [pick, setPick] = useState<Pick>(null);
  const tanks = allTanks(nm).filter((d) => !d.obsolete && tankStats(d, nm.completed).researched);
  const st = useMemo(() => divisionStats(draft, nm), [draft, nm]);
  const base = templates.find((t) => t.id === baseId);
  const bs = base ? divisionStats(base, nm) : undefined;
  const owned = nm.templates.some((t) => t.id === draft.id);
  const inUse = state.military!.divisions.filter((d) => d.owner === state.playerNation && d.template === draft.id).length;

  const setCombat = (i: number, slot: BattalionSlot | null) => { const c = [...draft.combat]; c[i] = slot; setDraft({ ...draft, combat: c }); };
  const setSupport = (i: number, id: string | null) => { const s = [...draft.support]; s[i] = id; setDraft({ ...draft, support: s }); };
  const load = (t: DivisionTemplate) => { setDraft(structuredClone(t)); setBaseId(t.id); setPick(null); };

  return (
    <div className="designer">
      <aside className="design-list">
        <button className="btn" onClick={() => { setDraft(empty()); setBaseId(''); }}>+ New template</button>
        {templates.map((t) => {
          const s = divisionStats(t, nm);
          const n = state.military!.divisions.filter((d) => d.owner === state.playerNation && d.template === t.id).length;
          return (
            <button key={t.id} className={`design-item ${t.id === draft.id ? 'active' : ''}`} onClick={() => load(t)}>
              <strong>{t.name}</strong>
              <span className="small muted">width {s.width} · {n} fielded{nm.templates.some((x) => x.id === t.id) ? '' : ' · standard'}{s.errors.length ? ' · ⚠' : ''}</span>
            </button>
          );
        })}
      </aside>

      <section className="design-main">
        <div className="row">
          <input className="name-input" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <span className="muted small">{owned ? (inUse ? `${inUse} division(s) use this template — edits apply to them.` : 'Your template') : 'New template'}</span>
        </div>

        <div className="div-grid-wrap">
          <div>
            <h4>Support companies</h4>
            <div className="support-col">
              {draft.support.map((id, i) => {
                const def = id ? BATTALION_BY_ID.get(id) : null;
                return (
                  <button key={i} className={`bslot support ${def ? 'filled' : ''} ${pick?.kind === 'support' && pick.index === i ? 'picked' : ''}`} onClick={() => setPick({ kind: 'support', index: i })} title={def?.desc}>
                    {def ? <><b>{def.short}</b><span>{def.name}</span></> : <span className="muted">+ support</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <h4>Combat battalions</h4>
            <div className="combat-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
              {draft.combat.map((slot, i) => {
                const def = slot ? BATTALION_BY_ID.get(slot.type) : null;
                const tank = slot?.design ? tanks.find((t) => t.id === slot.design) ?? allTanks(nm).find((t) => t.id === slot.design) : null;
                return (
                  <button key={i} className={`bslot ${def ? `filled g-${def.group}` : ''} ${pick?.kind === 'combat' && pick.index === i ? 'picked' : ''}`} onClick={() => setPick({ kind: 'combat', index: i })} title={def?.desc}>
                    {def ? <><b>{def.short}</b><span>{tank ? tank.name : def.name}</span></> : <span className="muted">+</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {pick && (
          <div className="picker">
            <div className="row">
              <strong>{pick.kind === 'combat' ? 'Choose a combat battalion' : 'Choose a support company'}</strong>
              <span>
                <button className="btn" onClick={() => { pick.kind === 'combat' ? setCombat(pick.index, null) : setSupport(pick.index, null); setPick(null); }}>Clear slot</button>
                <button className="btn" onClick={() => setPick(null)}>Close</button>
              </span>
            </div>
            <div className="picker-list">
              {BATTALIONS.filter((b) => b.kind === pick.kind).map((b) => {
                const locked = b.requires && !nm.completed.includes(b.requires);
                const choose = (design?: string) => {
                  if (pick.kind === 'combat') setCombat(pick.index, { type: b.id, ...(design ? { design } : {}) });
                  else setSupport(pick.index, b.id);
                  setPick(null);
                };
                if (b.usesTank) {
                  return (
                    <div key={b.id} className="pick-tank">
                      <div><b>{b.name}</b> <span className="small muted">— pick a tank design (40 tanks)</span></div>
                      {tanks.map((t) => {
                        const ts = tankStats(t, nm.completed).stats;
                        return (
                          <button key={t.id} className="pick" onClick={() => choose(t.id)}>
                            <strong>{t.name}</strong>
                            <span className="small muted">soft {ts.soft} · hard {ts.hard} · armor {ts.armor} · pierce {ts.piercing} · {ts.cost} IC</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <button key={b.id} className="pick" disabled={!!locked} onClick={() => choose()}>
                    <strong>{b.name}</strong>{locked && <span className="small"> 🔒 {TECH_BY_ID.get(b.requires!)?.name}</span>}
                    <span className="small muted">{b.desc}</span>
                    <span className="small muted">
                      {b.width ? `width ${b.width} · ` : ''}soft {b.soft} · hard {b.hard} · def {b.defense} · bt {b.breakthrough}{b.armor ? ` · armor ${b.armor}` : ''}{b.airAttack ? ` · AA ${b.airAttack}` : ''} · org {b.org}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {st.errors.length > 0 && <ul className="errors small">{st.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="row">
          <span className="muted small">Battle frontage is 60–90 width (more on long fronts). Width ~20 fits 4 divisions abreast.</span>
          <span>
            <button className="btn primary" disabled={busy || st.errors.length > 0}
              onClick={() => run({ op: 'save_template', template: owned ? draft : { ...draft, id: '' } })}>
              {owned ? 'Save changes' : 'Save template'}
            </button>
            {owned && (
              <button className="btn" disabled={busy} onClick={() => run({ op: 'save_template', template: { ...draft, id: '', name: `${draft.name} (copy)` } })}>Save as new</button>
            )}
            {owned && !inUse && (
              <button className="btn" disabled={busy} onClick={async () => { if (await run({ op: 'delete_template', id: draft.id })) setDraft(empty()); }}>Delete</button>
            )}
          </span>
        </div>
      </section>

      <aside className="design-stats">
        <h4>Division stats {base && base.id !== draft.id ? <span className="muted small">vs {base.name}</span> : null}</h4>
        <Stat label="Combat width" value={st.width} base={bs?.width} digits={0} lowerIsBetter />
        <Stat label="Manpower" value={st.manpower} base={bs?.manpower} digits={0} lowerIsBetter />
        <Stat label="HP" value={st.hp} base={bs?.hp} digits={0} />
        <Stat label="Organisation" value={st.org} base={bs?.org} />
        <Stat label="Soft attack" value={st.soft} base={bs?.soft} />
        <Stat label="Hard attack" value={st.hard} base={bs?.hard} />
        <Stat label="Defense" value={st.defense} base={bs?.defense} />
        <Stat label="Breakthrough" value={st.breakthrough} base={bs?.breakthrough} />
        <Stat label="Armor" value={st.armor} base={bs?.armor} />
        <Stat label="Piercing" value={st.piercing} base={bs?.piercing} />
        <Stat label="Hardness" value={st.hardness * 100} base={bs ? bs.hardness * 100 : undefined} digits={0} unit="%" />
        <Stat label="Air defense" value={st.airAttack} base={bs?.airAttack} />
        <Stat label="Speed" value={st.speed} base={bs?.speed} />
        <Stat label="Equipment (IC)" value={st.cost} base={bs?.cost} digits={0} lowerIsBetter />
        {Object.entries(st.effects).some(([, v]) => v) && (
          <div className="small effects">
            {Object.entries(st.effects).filter(([, v]) => v).map(([k, v]) => <span key={k}>{k} {v > 0 ? '+' : ''}{Math.round(v * 100)}%</span>)}
          </div>
        )}
        <h4>Equipment needed</h4>
        <table className="eq-table small">
          <tbody>
            {Object.entries(st.equipment).map(([item, k]) => {
              const have = nm.stockpile[item] ?? 0;
              return (
                <tr key={item} className={have < k ? 'short' : ''}>
                  <td>{equipmentName(item, nm)}</td>
                  <td>{fmt(k)}</td>
                  <td className="muted">{fmt(Math.floor(have))} in stock</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </aside>
    </div>
  );
}
