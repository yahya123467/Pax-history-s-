import type { WorldState } from '../../../shared/types';
import { relation, relationColor, relationLabel, signed } from '../lib/format';

interface Props {
  state: WorldState;
  provinceId: string;
  onClose: () => void;
  onNegotiate: (nationId: string) => void;
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="bar"><div style={{ width: `${value}%` }} /></div>
      <b>{value}</b>
    </div>
  );
}

export function ProvincePanel({ state, provinceId, onClose, onNegotiate }: Props) {
  const prov = state.provinces[provinceId];
  if (!prov) return null;
  const n = state.nations[prov.owner];
  const isPlayer = n.id === state.playerNation;
  const rel = relation(state, state.playerNation, n.id);
  const owned = Object.values(state.provinces).filter((p) => p.owner === n.id);
  return (
    <div className="province-panel">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <div className="eyebrow">Province</div>
      <h3>{prov.name}</h3>
      <div className="owner">
        <i className="flag" style={{ background: n.color }} />
        <div>
          <strong>{n.name}</strong>
          {isPlayer && <span className="tag">You</span>}
          {n.minor && <span className="tag muted">Minor</span>}
          <div className="muted small">{n.leader} · {n.government}</div>
        </div>
      </div>
      <Bar label="Stability" value={n.stability} />
      <Bar label="Economy" value={n.economy} />
      {!isPlayer && (
        <div className="stat">
          <span>Relation</span>
          <b style={{ color: relationColor(rel) }}>{signed(rel)} · {relationLabel(rel)}</b>
        </div>
      )}
      <div className="muted small">
        {owned.length} province{owned.length === 1 ? '' : 's'}: {owned.slice(0, 8).map((p) => p.name).join(', ')}
        {owned.length > 8 ? ` +${owned.length - 8} more` : ''}
      </div>
      {n.goals.length > 0 && !n.minor && (
        <div className="small goals"><span className="muted">Goals:</span> {n.goals.join(' · ')}</div>
      )}
      {!isPlayer && (
        <button className="btn" onClick={() => onNegotiate(n.id)}>Open talks with {n.name}</button>
      )}
    </div>
  );
}
