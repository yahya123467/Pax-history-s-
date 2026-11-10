import { useState } from 'react';
import type { BattleReport, BattleSide } from '../../../../shared/types';
import { Flag, fmt, Meter, nationName, type MilProps } from './common';

const FATE: Record<string, string> = {
  held: 'held', fought: 'fought', reserve: 'reserve', pushed_back: 'pushed back', retreated: 'retreated', destroyed: 'destroyed',
};

export function BattlesTab({ state, onLocate }: Pick<MilProps, 'state'> & { onLocate: (p: string) => void }) {
  const battles = [...(state.military?.battles ?? [])].sort((a, b) => Number(involves(b, state.playerNation)) - Number(involves(a, state.playerNation)));
  const [open, setOpen] = useState<string | null>(battles[0]?.id ?? null);
  if (!battles.length) return <p className="muted pad center">No battles were fought last turn. Declare war and order divisions into enemy territory to start one.</p>;
  return (
    <div className="battles">
      {battles.map((b) => (
        <div key={b.id} className={`battle ${open === b.id ? 'open' : ''} ${involves(b, state.playerNation) ? 'mine' : ''}`}>
          <button className="battle-head" onClick={() => setOpen(open === b.id ? null : b.id)}>
            <span className="swords">⚔</span>
            <strong>Battle of {b.provinceName}</strong>
            <span className="small muted">{b.terrain} · frontage {b.frontWidth}</span>
            <span className="sides">
              {b.attacker.nations.map((n) => <Flag key={n} state={state} id={n} />)} vs {b.defender.nations.map((n) => <Flag key={n} state={state} id={n} />)}
            </span>
            <span className={`result ${b.winner}`}>{b.captured ? 'Province captured' : b.winner === 'stalemate' ? 'Stalemate' : `${b.winner === 'attacker' ? 'Attacker' : 'Defender'} won`}</span>
          </button>
          {open === b.id && (
            <div className="battle-body">
              <div className="occ">
                <span>Occupation</span>
                <Meter value={b.occupationAfter} max={100} kind="occ" />
                <b>{b.occupationAfter}%</b>
                <span className={b.occupationDelta >= 0 ? 'warn-text' : 'good'}>{b.occupationDelta >= 0 ? '+' : ''}{b.occupationDelta}</span>
                <button className="link small" onClick={() => onLocate(b.province)}>show on map</button>
              </div>
              {b.rounds.length > 0 && <OrgChart rounds={b.rounds} />}
              <div className="battle-sides">
                <Side title="Attackers" side={b.attacker} state={state} />
                <Side title="Defenders" side={b.defender} state={state} />
              </div>
              {b.notes.length > 0 && <ul className="small notes">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const involves = (b: BattleReport, id: string) => b.attacker.nations.includes(id) || b.defender.nations.includes(id);

function Side({ title, side, state }: { title: string; side: BattleSide; state: MilProps['state'] }) {
  return (
    <div className="side">
      <h4>{title}: {side.nations.map((n) => nationName(state, n)).join(' & ')}</h4>
      <div className="small muted">
        Casualties <b>{fmt(side.casualties)}</b> · equipment lost {fmt(side.equipmentLost)} IC · {side.divisions.filter((d) => d.fate !== 'reserve').length}/{side.divisions.length} divisions engaged
        {side.air.planes > 0 && <> · {Math.round(side.air.planes)} aircraft, {Math.round(side.air.superiority * 100)}% of the sky, {side.air.planesLost} lost</>}
      </div>
      <table className="small">
        <thead><tr><th>Division</th><th>Strength</th><th>Org</th><th>Fate</th></tr></thead>
        <tbody>
          {side.divisions.map((d) => (
            <tr key={d.id} className={d.fate}>
              <td><Flag state={state} id={d.owner} /> {d.name}</td>
              <td><Meter value={d.endStrength} /> {Math.round(d.startStrength * 100)}→{Math.round(d.endStrength * 100)}%</td>
              <td>{d.maxOrg ? <><Meter value={d.endOrg} max={d.maxOrg} kind="org" /> {d.startOrg}→{d.endOrg}</> : '—'}</td>
              <td>{FATE[d.fate]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Average organisation of each side per round. */
function OrgChart({ rounds }: { rounds: { att: number; def: number }[] }) {
  const W = 360, H = 90, pad = 6;
  const x = (i: number) => pad + (i / Math.max(1, rounds.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - v * (H - pad * 2);
  const path = (k: 'att' | 'def') => rounds.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
  return (
    <div className="org-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Organisation per round">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="axis" />
        <path d={path('att')} className="att" />
        <path d={path('def')} className="def" />
      </svg>
      <div className="small legend"><span className="att">■ Attacker org</span> <span className="def">■ Defender org</span> <span className="muted">over {rounds.length} rounds</span></div>
    </div>
  );
}
