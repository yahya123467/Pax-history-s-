import { useState } from 'react';
import type { GameDTO } from '../../../shared/types';
import { formatDate } from '../lib/format';

interface Props {
  game: GameDTO;
  onSave: (name: string) => Promise<void>;
  onMenu: () => void;
  saving: boolean;
}

export function TopBar({ game, onSave, onMenu, saving }: Props) {
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
      </div>
      <div className="date">
        <strong>{formatDate(s.date)}</strong>
        <span className="muted small">Turn {s.turn}</span>
      </div>
      <div className="spacer" />
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
