import { useState } from 'react';
import type { TechCategory } from '../../../../shared/types';
import { TECH_BY_ID, TECHS } from '../../../../shared/military/catalog';
import { researchSpeed, techCost, techState } from '../../../../shared/military/stats';
import { pct, type MilProps } from './common';

const CATEGORIES: { id: TechCategory; name: string }[] = [
  { id: 'infantry', name: 'Infantry' },
  { id: 'armor', name: 'Armor' },
  { id: 'artillery', name: 'Artillery & AD' },
  { id: 'air', name: 'Air' },
  { id: 'doctrine', name: 'Doctrine' },
  { id: 'industry', name: 'Industry' },
];

const MOD_NAMES: Record<string, string> = {
  inf_soft: 'Infantry soft attack', inf_hard: 'Infantry hard attack', inf_def: 'Infantry defense', inf_pierce: 'Infantry piercing',
  art_soft: 'Artillery soft attack', art_hard: 'Artillery hard attack', org: 'Organisation', attack: 'Attack', defense: 'Defense',
  breakthrough: 'Breakthrough', entrench: 'Entrenchment', recon: 'Initiative', air_defense: 'Air defense', air_ground: 'Air ground attack',
  air_support: 'Close air support', industry: 'Factory output', research: 'Research speed', recovery: 'Org recovery', manpower: 'Manpower growth',
};

export function ResearchTab({ state, nm, run, busy }: MilProps) {
  const me = state.nations[state.playerNation];
  const speed = researchSpeed(nm, me.economy);
  const [slotPick, setSlotPick] = useState<number | null>(null);
  const freeSlot = slotPick ?? nm.research.findIndex((s) => !s);

  return (
    <div className="research">
      <div className="slots">
        {nm.research.map((slot, i) => {
          const tech = slot ? TECH_BY_ID.get(slot.tech) : null;
          const cost = tech ? techCost(tech, state.date) : 0;
          return (
            <div key={i} className={`slot ${slotPick === i ? 'picked' : ''} ${tech ? '' : 'empty'}`} onClick={() => setSlotPick(slotPick === i ? null : i)}>
              <div className="eyebrow">Slot {i + 1}</div>
              {tech ? (
                <>
                  <strong>{tech.name}</strong>
                  <div className="progress"><i style={{ width: `${Math.min(100, (slot!.progress / cost) * 100)}%` }} /></div>
                  <div className="small muted">
                    {Math.round(slot!.progress)}/{cost} RP · ~{Math.max(1, Math.ceil((cost - slot!.progress) / speed))} mo
                    <button className="link small" disabled={busy} onClick={(e) => { e.stopPropagation(); void run({ op: 'research', slot: i, tech: null }); }}> cancel</button>
                  </div>
                </>
              ) : (
                <span className="muted small">Empty — pick a technology below</span>
              )}
            </div>
          );
        })}
        <div className="slot-info small muted">
          {speed.toFixed(1)} RP / slot / month<br />
          {nm.completed.length} of {TECHS.length} researched<br />
          Researching ahead of time costs +50% per year.
        </div>
      </div>

      <div className="tree">
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="tree-col">
            <h3>{cat.name}</h3>
            {TECHS.filter((t) => t.category === cat.id)
              .sort((a, b) => a.year - b.year)
              .map((t) => {
                const st = techState(t, nm);
                const cost = techCost(t, state.date);
                const ahead = cost > t.cost;
                return (
                  <button
                    key={t.id}
                    className={`tech ${st}`}
                    disabled={busy || st !== 'available' || freeSlot < 0}
                    title={st === 'locked' ? `Requires: ${t.requires.map((r) => TECH_BY_ID.get(r)?.name).join(', ')}` : t.desc}
                    onClick={() => { void run({ op: 'research', slot: freeSlot, tech: t.id }); setSlotPick(null); }}
                  >
                    <div className="tech-head">
                      <strong>{t.name}</strong>
                      <span className={`year ${ahead ? 'ahead' : ''}`}>{t.year}</span>
                    </div>
                    <div className="small muted">{t.desc}</div>
                    {t.mods && (
                      <div className="mods">
                        {Object.entries(t.mods).map(([k, v]) => <span key={k}>{MOD_NAMES[k] ?? k} {pct(v ?? 0)}</span>)}
                      </div>
                    )}
                    <div className="small tech-foot">
                      {st === 'done' ? '✓ Researched' : st === 'researching' ? 'In progress' : `${cost} RP · ~${Math.ceil(cost / speed)} mo`}
                      {st === 'locked' && <span className="muted"> · needs {t.requires.filter((r) => !nm.completed.includes(r)).map((r) => TECH_BY_ID.get(r)?.name).join(', ')}</span>}
                    </div>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
