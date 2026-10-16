import { useState } from 'react';
import type { GameDTO } from '../../../shared/types';
import { api } from '../lib/api';
import { ActionPanel } from './ActionPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { EventLog } from './EventLog';
import { MapView } from './MapView';
import { ProvincePanel } from './ProvincePanel';
import { TopBar } from './TopBar';

type Busy = 'turn' | 'chat' | 'conclude' | 'save' | null;

export function GameScreen({ initial, onMenu }: { initial: GameDTO; onMenu: () => void }) {
  const [game, setGame] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatNation, setChatNation] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<GameDTO | void>): Promise<boolean> {
    setBusy(kind);
    setError(null);
    try {
      const g = await fn();
      if (g) setGame(g);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const s = game.state;
  return (
    <div className="game">
      <TopBar
        game={game}
        saving={busy === 'save'}
        onMenu={onMenu}
        onSave={async (name) => {
          const ok = await run('save', async () => { await api.save(game.id, name); });
          if (ok) { setToast('Game saved'); setTimeout(() => setToast(null), 2500); }
        }}
      />
      <EventLog state={s} />
      <main className="map-area">
        <MapView state={s} selected={selected} onSelect={setSelected} />
        {selected && (
          <ProvincePanel
            state={s}
            provinceId={selected}
            onClose={() => setSelected(null)}
            onNegotiate={(id) => setChatNation(id)}
          />
        )}
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
        {busy === 'turn' && <div className="turn-overlay"><span className="spinner" /> The world responds…</div>}
      </main>
      <div className="right">
        <ActionPanel state={s} busy={busy !== null} onEndTurn={(a) => run('turn', () => api.endTurn(game.id, a))} />
        <DiplomacyPanel
          state={s}
          nationId={chatNation}
          onSelectNation={setChatNation}
          busy={busy === 'chat' || busy === 'conclude' ? busy : null}
          disabled={busy !== null}
          onSend={(n, m) => run('chat', () => api.chat(game.id, n, m))}
          onConclude={(n) => void run('conclude', () => api.conclude(game.id, n))}
        />
      </div>
    </div>
  );
}
