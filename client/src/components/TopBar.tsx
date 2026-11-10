import { useState } from 'react';
import type { GameDTO } from '../../../shared/types';
import { formatDate } from '../lib/format';

interface Props {
  game: GameDTO;
  onSave: (name: string) => Promise<void>;
  onMenu: () => void;
  saving: boolean;
  onMilitary?: () => void;
  militaryOpen?: boolean;
}

export function TopBar({ game, onSave, onMenu, saving, onMilitary, militaryOpen }: Props) {
  const s = game.state;
  const me = s.nations[s.playerNation];
  const provinces = Object.values(s.provinces).filter((p) => p.owner === me.id).length;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  return (
    <header className="topbar">
      <div className="brand">PAX<span>HISTORY</span></div>
      <div className="me">
        <i className="flag" style={{ background: me.color }} />
        <strong>{me.name}</strong>
        <span className="muted">{me.leader}</span>
      </div>
      <div className="stats">
        <span title="Stability">⚖ {me.stability}</span>
        <span title="Economy">⚙ {me.economy}</span>
        <span title="Provinces">▦ {provinces}</span>
        {s.military && (() => {
          const nm = s.military.nations[me.id];
          const divs = s.military.divisions.filter((d) => d.owner === me.id).length;
          const wars = s.military.wars.filter((w) => w.a === me.id || w.b === me.id).length;
          return (
            <>
              <span title="Divisions">⚑ {divs}</span>
              <span title="Military factories">🏭 {nm.factories}</span>
              <span title="Manpower">👥 {nm.manpower >= 1e6 ? `${(nm.manpower / 1e6).toFixed(1)}M` : `${Math.round(nm.manpower / 1000)}k`}</span>
              {wars > 0 && <span className="bad-text" title="Wars">⚔ {wars} war{wars > 1 ? 's' : ''}</span>}
            </>
          );
        })()}
      </div>
      <div className="date">
        <strong>{formatDate(s.date)}</strong>
        <span className="muted small">Turn {s.turn}</span>
      </div>
      <div className="spacer" />
      {s.military && onMilitary && (
        <button className={`btn ${militaryOpen ? 'primary' : 'mil-btn'}`} onClick={onMilitary}>⚔ Military</button>
      )}
      {game.aiMode === 'mock' && <span className="tag warn" title="No OPENROUTER_API_KEY set on the server">Offline AI</span>}
      {naming ? (
        <form
          className="save-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(name);
            setNaming(false);
            setName('');
          }}
        >
          <input autoFocus value={name} maxLength={80} placeholder={`${me.name}, ${formatDate(s.date)}`} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn" onClick={() => setNaming(true)}>Save game</button>
      )}
      <button className="btn" onClick={onMenu}>Menu</button>
    </header>
  );
}
