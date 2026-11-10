import { useMemo, useState } from 'react';
import type { JetDesign, JetSlot } from '../../../../shared/types';
import { AIRFRAMES, JET_MODULES, JET_SPECIAL_SLOTS, JET_WEAPON_SLOTS, TECH_BY_ID } from '../../../../shared/military/catalog';
import { allJets, jetStats } from '../../../../shared/military/stats';
import { Stat, type MilProps } from './common';

const blank = (): JetDesign => ({ id: '', name: 'New Fighter', airframe: 'multirole', modules: { engine: 'je_turbofan', radar: 'jr_pulse', weapon1: 'jw_srm' } });

export function JetDesigner({ state, nm, run, busy }: MilProps) {
  void state;
  const designs = allJets(nm);
  const [draft, setDraft] = useState<JetDesign>(() => structuredClone(designs.find((d) => d.id === 'std_multirole_g45') ?? blank()));
  const [baseId, setBaseId] = useState(draft.id);
  const base = designs.find((d) => d.id === baseId);
  const check = useMemo(() => jetStats(draft, nm.completed), [draft, nm.completed]);
  const baseStats = base ? jetStats(base, nm.completed).stats : undefined;
  const frame = AIRFRAMES.find((a) => a.id === draft.airframe)!;
  const isStd = draft.id.startsWith('std_');
  const s = check.stats;
  const setModule = (slot: JetSlot, id: string) => setDraft({ ...draft, modules: { ...draft.modules, [slot]: id || null } });
  const load = (d: JetDesign) => { setDraft(structuredClone(d)); setBaseId(d.id); };

  const slotSelect = (slot: JetSlot, kind: 'engine' | 'radar' | 'weapon' | 'special', label: string, off: boolean, allowEmpty: boolean) => {
    const value = draft.modules[slot] ?? '';
    return (
      <label key={slot} className={`module ${off ? 'off' : ''}`}>
        <span>{label}</span>
        <select value={value} disabled={off} onChange={(e) => setModule(slot, e.target.value)}>
          {(allowEmpty || !value) && <option value="">— empty —</option>}
          {JET_MODULES.filter((m) => m.slot === kind).map((m) => {
            const locked = m.requires && !nm.completed.includes(m.requires);
            return <option key={m.id} value={m.id} disabled={!!locked}>{m.name}{locked ? ` 🔒 ${TECH_BY_ID.get(m.requires!)?.name}` : ''}</option>;
          })}
        </select>
        <small className="muted">{describe(value)}</small>
      </label>
    );
  };

  return (
    <div className="designer">
      <aside className="design-list">
        <button className="btn" onClick={() => { setDraft(blank()); setBaseId(''); }}>+ New design</button>
        {designs.map((d) => {
          const st = jetStats(d, nm.completed);
          return (
            <button key={d.id} className={`design-item ${d.id === draft.id ? 'active' : ''} ${d.obsolete ? 'obsolete' : ''}`} onClick={() => load(d)}>
              <strong>{d.name}</strong>
              <span className="small muted">{AIRFRAMES.find((a) => a.id === d.airframe)?.name}{d.id.startsWith('std_') ? ' · standard' : ''}{!st.researched ? ' · 🔒' : ''}{d.obsolete ? ' · obsolete' : ''}</span>
            </button>
          );
        })}
      </aside>

      <section className="design-main">
        <div className="row">
          <input className="name-input" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <span className="muted small">{isStd ? 'Standard design: saving creates your own copy.' : draft.id ? 'Editing your design.' : 'New design'}</span>
        </div>

        <h4>Airframe</h4>
        <div className="chassis-row">
          {AIRFRAMES.map((a) => {
            const locked = a.requires && !nm.completed.includes(a.requires);
            return (
              <button key={a.id} className={`chassis ${a.id === draft.airframe ? 'active' : ''}`} disabled={!!locked} title={locked ? `Requires ${TECH_BY_ID.get(a.requires!)?.name}` : a.desc}
                onClick={() => setDraft({ ...draft, airframe: a.id })}>
                <JetIcon frame={a.id} />
                <strong>{a.name}</strong>
                <span className="small muted">{a.weaponSlots} weapons · {a.specialSlots} special{a.stealthy ? ' · stealth' : ''}{locked ? ' · 🔒' : ''}</span>
              </button>
            );
          })}
        </div>

        <h4>Modules</h4>
        <div className="module-grid">
          {slotSelect('engine', 'engine', 'Engine', false, false)}
          {slotSelect('radar', 'radar', 'Radar', false, false)}
          {JET_WEAPON_SLOTS.map((slot, i) => slotSelect(slot, 'weapon', `Weapon ${i + 1}`, i >= s.weaponSlots, true))}
          {JET_SPECIAL_SLOTS.map((slot, i) => slotSelect(slot, 'special', `Special ${i + 1}`, i >= frame.specialSlots, true))}
        </div>

        {(check.errors.length > 0 || check.missing.length > 0) && (
          <ul className="errors small">
            {check.errors.map((e) => <li key={e}>{e}</li>)}
            {check.missing.map((x) => <li key={x}>Needs research: {TECH_BY_ID.get(x)?.name}</li>)}
          </ul>
        )}
        <div className="row">
          <span className="muted small">Combat radius {Math.round(s.range / 2)} km (border to border) · {s.cost.toFixed(1)} IC per aircraft</span>
          <button className="btn primary" disabled={busy || check.errors.length > 0 || !check.researched}
            onClick={async () => { if (await run({ op: 'save_jet', design: isStd ? { ...draft, id: '' } : draft })) setBaseId(draft.id); }}>
            Save design
          </button>
          {!isStd && draft.id && (
            <button className="btn" disabled={busy} onClick={() => run({ op: 'obsolete_design', kind: 'jet', id: draft.id, obsolete: !nm.jetDesigns.find((d) => d.id === draft.id)?.obsolete })}>
              {nm.jetDesigns.find((d) => d.id === draft.id)?.obsolete ? 'Restore' : 'Mark obsolete'}
            </button>
          )}
        </div>
      </section>

      <aside className="design-stats">
        <h4>Per-aircraft stats {base && <span className="muted small">vs {base.name}</span>}</h4>
        <Stat label="Air attack" value={s.airAttack} base={baseStats?.airAttack} />
        <Stat label="Ground attack" value={s.groundAttack} base={baseStats?.groundAttack} />
        <Stat label="Agility" value={s.agility} base={baseStats?.agility} digits={0} />
        <Stat label="Stealth" value={s.stealth} base={baseStats?.stealth} digits={0} />
        <Stat label="Detection" value={s.detection} base={baseStats?.detection} digits={0} />
        <Stat label="Speed (km/h)" value={s.speed} base={baseStats?.speed} digits={0} />
        <Stat label="Range (km)" value={s.range} base={baseStats?.range} digits={0} />
        <Stat label="Reliability" value={s.reliability * 100} base={baseStats ? baseStats.reliability * 100 : undefined} digits={0} unit="%" />
        <Stat label="Cost (IC)" value={s.cost} base={baseStats?.cost} lowerIsBetter />
        <p className="small muted hint">
          Air-superiority wings fight for the sky: air attack × agility × stealth × detection. Ground-support wings add damage to battles,
          scaled by how much of the sky you own and blunted by enemy air defense.
        </p>
      </aside>
    </div>
  );
}

function describe(id: string): string {
  const m = JET_MODULES.find((x) => x.id === id);
  if (!m) return '';
  const p: string[] = [];
  if (m.airAttack) p.push(`air +${m.airAttack}`);
  if (m.groundAttack) p.push(`ground +${m.groundAttack}`);
  if (m.agility) p.push(`agility ${m.agility > 0 ? '+' : ''}${m.agility}`);
  if (m.speed) p.push(`speed +${m.speed}`);
  if (m.stealth) p.push(`stealth ${m.stealth > 0 ? '+' : ''}${m.stealth}`);
  if (m.detection) p.push(`detection ${m.detection}`);
  if (m.rangePct) p.push(`range +${Math.round(m.rangePct * 100)}%`);
  if (m.airPct) p.push(`air +${Math.round(m.airPct * 100)}%`);
  if (m.groundPct) p.push(`ground +${Math.round(m.groundPct * 100)}%`);
  if (m.extraWeapons) p.push(`+${m.extraWeapons} weapon slots`);
  p.push(`${m.cost} IC`);
  return p.join(' · ');
}

function JetIcon({ frame }: { frame: string }) {
  const stealth = frame === 'stealth_fighter' || frame === 'adaptive_fighter';
  const drone = frame === 'ucav';
  return (
    <svg viewBox="0 0 68 36" className="tank-icon" aria-hidden>
      {drone ? (
        <path d="M8 18 L34 10 L60 18 L34 22 Z" />
      ) : stealth ? (
        <path d={frame === 'adaptive_fighter' ? 'M6 18 L40 6 L62 18 L40 30 Z' : 'M6 18 L30 8 L44 12 L62 18 L44 24 L30 28 Z'} />
      ) : (
        <path d={`M6 18 L24 16 L32 ${frame === 'strike' ? 4 : 7} L38 16 L58 17 L62 18 L58 19 L38 20 L32 ${frame === 'strike' ? 32 : 29} L24 20 Z`} />
      )}
    </svg>
  );
}
