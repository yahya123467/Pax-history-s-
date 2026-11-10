import { useMemo, useState } from 'react';
import type { TankDesign } from '../../../../shared/types';
import { TANK_CHASSIS, TANK_MODULES, TANK_SLOTS, TECH_BY_ID } from '../../../../shared/military/catalog';
import { allTanks, tankStats } from '../../../../shared/military/stats';
import { Stat, type MilProps } from './common';

const blank = (): TankDesign => ({ id: '', name: 'New Tank', chassis: 'mbt', modules: { gun: 'gun_105', turret: 'turret_manned', engine: 'eng_diesel_1200', armor: 'armor_steel', fcs: 'fcs_analog' } });

export function TankDesigner({ state, nm, run, busy }: MilProps) {
  const designs = allTanks(nm);
  const [draft, setDraft] = useState<TankDesign>(() => structuredClone(designs.find((d) => !d.obsolete && d.id.startsWith('std_mbt_g3')) ?? blank()));
  const [baseId, setBaseId] = useState<string>(draft.id);
  const base = designs.find((d) => d.id === baseId);
  const check = useMemo(() => tankStats(draft, nm.completed), [draft, nm.completed]);
  const baseStats = base ? tankStats(base, nm.completed).stats : undefined;
  const chassis = TANK_CHASSIS.find((c) => c.id === draft.chassis)!;
  const isStd = draft.id.startsWith('std_');
  const s = check.stats;

  const load = (d: TankDesign) => { setDraft(structuredClone(d)); setBaseId(d.id); };
  const setModule = (slot: string, id: string) => setDraft({ ...draft, modules: { ...draft.modules, [slot]: id || null } });

  return (
    <div className="designer">
      <aside className="design-list">
        <button className="btn" onClick={() => { const b = blank(); setDraft(b); setBaseId(''); }}>+ New design</button>
        {designs.map((d) => {
          const st = tankStats(d, nm.completed);
          return (
            <button key={d.id} className={`design-item ${d.id === draft.id ? 'active' : ''} ${d.obsolete ? 'obsolete' : ''}`} onClick={() => load(d)}>
              <strong>{d.name}</strong>
              <span className="small muted">{TANK_CHASSIS.find((c) => c.id === d.chassis)?.name}{d.id.startsWith('std_') ? ' · standard' : ''}{!st.researched ? ' · 🔒' : ''}{d.obsolete ? ' · obsolete' : ''}</span>
            </button>
          );
        })}
      </aside>

      <section className="design-main">
        <div className="row">
          <input className="name-input" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <span className="muted small">{isStd ? 'Standard design: saving creates your own copy.' : draft.id ? 'Editing your design (if it is already in use, a new variant is saved).' : 'New design'}</span>
        </div>

        <h4>Chassis</h4>
        <div className="chassis-row">
          {TANK_CHASSIS.map((c) => {
            const locked = c.requires && !nm.completed.includes(c.requires);
            return (
              <button key={c.id} className={`chassis ${c.id === draft.chassis ? 'active' : ''}`} disabled={!!locked} title={locked ? `Requires ${TECH_BY_ID.get(c.requires!)?.name}` : c.desc}
                onClick={() => setDraft({ ...draft, chassis: c.id })}>
                <TankIcon chassis={c.id} />
                <strong>{c.name}</strong>
                <span className="small muted">{c.specialSlots} special · armor ×{c.armorMult}{locked ? ' · 🔒' : ''}</span>
              </button>
            );
          })}
        </div>

        <h4>Modules</h4>
        <div className="module-grid">
          {TANK_SLOTS.map(({ slot, kind, label }) => {
            const specialIndex = kind === 'special' ? Number(slot.slice(-1)) : 0;
            const disabledSlot = kind === 'special' && specialIndex > chassis.specialSlots;
            const value = draft.modules[slot] ?? '';
            return (
              <label key={slot} className={`module ${disabledSlot ? 'off' : ''}`}>
                <span>{label}</span>
                <select value={value} disabled={disabledSlot} onChange={(e) => setModule(slot, e.target.value)}>
                  {(kind === 'special' || !value) && <option value="">— empty —</option>}
                  {TANK_MODULES.filter((m) => m.slot === kind).map((m) => {
                    const locked = m.requires && !nm.completed.includes(m.requires);
                    const wrongClass = m.gunClass && !chassis.gunClasses.includes(m.gunClass);
                    return (
                      <option key={m.id} value={m.id} disabled={!!locked || !!wrongClass}>
                        {m.name}{locked ? ` 🔒 ${TECH_BY_ID.get(m.requires!)?.name}` : ''}{wrongClass ? ' (too big for chassis)' : ''}
                      </option>
                    );
                  })}
                </select>
                <small className="muted">{describeModule(value)}</small>
              </label>
            );
          })}
        </div>

        {(check.errors.length > 0 || check.missing.length > 0) && (
          <ul className="errors small">
            {check.errors.map((e) => <li key={e}>{e}</li>)}
            {check.missing.map((x) => <li key={x}>Needs research: {TECH_BY_ID.get(x)?.name}</li>)}
          </ul>
        )}
        <div className="row">
          <span className="muted small">A battalion fields 40 tanks · {(s.cost * 40).toFixed(0)} IC per battalion</span>
          <button className="btn primary" disabled={busy || check.errors.length > 0 || !check.researched}
            onClick={async () => { if (await run({ op: 'save_tank', design: isStd ? { ...draft, id: '' } : draft })) setBaseId(draft.id); }}>
            Save design
          </button>
          {!isStd && draft.id && (
            <button className="btn" disabled={busy} onClick={() => run({ op: 'obsolete_design', kind: 'tank', id: draft.id, obsolete: !nm.tankDesigns.find((d) => d.id === draft.id)?.obsolete })}>
              {nm.tankDesigns.find((d) => d.id === draft.id)?.obsolete ? 'Restore' : 'Mark obsolete'}
            </button>
          )}
        </div>
      </section>

      <aside className="design-stats">
        <h4>Per-tank stats {base && <span className="muted small">vs {base.name}</span>}</h4>
        <Stat label="Soft attack" value={s.soft} base={baseStats?.soft} />
        <Stat label="Hard attack" value={s.hard} base={baseStats?.hard} />
        <Stat label="Piercing" value={s.piercing} base={baseStats?.piercing} digits={0} />
        <Stat label="Armor" value={s.armor} base={baseStats?.armor} digits={0} />
        <Stat label="Defense" value={s.defense} base={baseStats?.defense} />
        <Stat label="Breakthrough" value={s.breakthrough} base={baseStats?.breakthrough} />
        <Stat label="Speed" value={s.speed} base={baseStats?.speed} />
        <Stat label="Reliability" value={s.reliability * 100} base={baseStats ? baseStats.reliability * 100 : undefined} digits={0} unit="%" />
        <Stat label="Cost (IC)" value={s.cost} base={baseStats?.cost} lowerIsBetter />
        <p className="small muted hint">
          Armor above the enemy's piercing halves damage taken and adds shock. Piercing below the enemy's armor costs attack.
          Terrain (forest, urban, mountains) blunts the armor advantage.
        </p>
      </aside>
    </div>
  );
}

function describeModule(id: string): string {
  const m = TANK_MODULES.find((x) => x.id === id);
  if (!m) return '';
  const parts: string[] = [];
  if (m.soft) parts.push(`soft ${m.soft}`);
  if (m.hard) parts.push(`hard ${m.hard}`);
  if (m.piercing) parts.push(`pierce ${m.piercing}`);
  if (m.armor) parts.push(`armor ${m.armor > 0 ? '+' : ''}${m.armor}`);
  if (m.defense) parts.push(`def +${m.defense}`);
  if (m.breakthrough) parts.push(`bt +${m.breakthrough}`);
  if (m.speed) parts.push(`speed ${m.speed > 0 ? '+' : ''}${m.speed}`);
  if (m.attackPct) parts.push(`attack +${Math.round(m.attackPct * 100)}%`);
  if (m.hardPct) parts.push(`hard +${Math.round(m.hardPct * 100)}%`);
  if (m.reliability) parts.push(`rel ${m.reliability > 0 ? '+' : ''}${Math.round(m.reliability * 100)}%`);
  parts.push(`${m.cost} IC`);
  return parts.join(' · ');
}

/** Simple side-view silhouette per chassis. */
function TankIcon({ chassis }: { chassis: string }) {
  const hull = chassis === 'mbt_next' ? 'M6 26 L10 18 L58 18 L62 26 Z' : chassis === 'wheeled' ? 'M8 24 L12 18 L54 18 L58 24 Z' : 'M8 26 L12 19 L56 19 L60 26 Z';
  return (
    <svg viewBox="0 0 68 36" className="tank-icon" aria-hidden>
      <path d={hull} />
      <rect x={chassis === 'light' ? 22 : 20} y={chassis === 'mbt_next' ? 10 : 12} width={chassis === 'light' ? 16 : 22} height="7" rx="2" />
      <rect x="40" y={chassis === 'mbt_next' ? 12 : 14} width={chassis === 'mbt_next' ? 26 : chassis === 'light' ? 16 : 22} height="2" />
      {chassis === 'wheeled'
        ? [14, 26, 40, 52].map((x) => <circle key={x} cx={x} cy="28" r="4" />)
        : <rect x="8" y="26" width="52" height="6" rx="3" />}
    </svg>
  );
}
