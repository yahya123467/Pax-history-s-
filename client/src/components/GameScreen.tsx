import { useEffect, useState } from 'react';
import type { GameDTO, MilitaryCommand } from '../../../shared/types';
import { api, type GeoInfo } from '../lib/api';
import { ActionPanel } from './ActionPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { EventLog } from './EventLog';
import { MapView } from './MapView';
import { MilitaryScreen, type MilTab } from './military/MilitaryScreen';
import { ProvincePanel } from './ProvincePanel';
import { TopBar } from './TopBar';

type Busy = 'turn' | 'chat' | 'conclude' | 'save' | 'military' | null;

export function GameScreen({ initial, onMenu }: { initial: GameDTO; onMenu: () => void }) {
  const [game, setGame] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatNation, setChatNation] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [milTab, setMilTab] = useState<MilTab | null>(null);
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  /** Divisions waiting for the player to click a target province on the map. */
  const [picking, setPicking] = useState<string[] | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    if (game.state.military) api.geo().then(setGeo).catch(() => setError('Could not load map geography for military orders.'));
  }, [game.state.military !== undefined]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600); };

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

  const runMilitary = (cmd: MilitaryCommand) =>
    run('military', async () => {
      const res = await api.military(game.id, cmd);
      flash(res.message);
      return res;
    });

  const locate = (province: string) => {
    setMilTab(null);
    setSelected(province);
    setFocus({ id: province, n: Date.now() });
  };

  const onMapSelect = (province: string | null) => {
    if (picking && province) {
      const divisions = picking;
      setPicking(null);
      void runMilitary({ order: { kind: 'move', to: province }, divisions, op: 'order' });
      return;
    }
    setSelected(province);
  };

  const s = game.state;
  const battleCount = s.military?.battles.length ?? 0;
  return (
    <div className="game">
      <TopBar
        game={game}
        saving={busy === 'save'}
        onMenu={onMenu}
        militaryOpen={milTab !== null}
        onMilitary={() => setMilTab(milTab ? null : 'army')}
        onSave={async (name) => {
          const ok = await run('save', async () => { await api.save(game.id, name); });
          if (ok) flash('Game saved');
        }}
      />
      <EventLog state={s} />
      <main className="map-area">
        <MapView state={s} selected={selected} onSelect={onMapSelect} picking={!!picking} focus={focus} />
        {selected && !milTab && (
          <ProvincePanel
            state={s}
            provinceId={selected}
            onClose={() => setSelected(null)}
            onNegotiate={(id) => setChatNation(id)}
            geo={geo}
            busy={busy !== null}
            runMilitary={runMilitary}
            onPickTarget={(divs) => { setPicking(divs); flash('Click the target province on the map (Esc to cancel)'); }}
          />
        )}
        {picking && (
          <div className="pick-banner">
            Pick a target for {picking.length} division{picking.length > 1 ? 's' : ''} — click a province
            <button className="btn" onClick={() => setPicking(null)}>Cancel</button>
          </div>
        )}
        {s.military && !milTab && battleCount > 0 && s.lastReport && (
          <button className="battle-chip" onClick={() => setMilTab('battles')}>⚔ {battleCount} battle{battleCount > 1 ? 's' : ''} last turn</button>
        )}
        {milTab && s.military && (
          <MilitaryScreen state={s} tab={milTab} onTab={setMilTab} onClose={() => setMilTab(null)} run={runMilitary} busy={busy !== null} geo={geo} onLocate={locate} />
        )}
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
        {busy === 'turn' && <div className="turn-overlay"><span className="spinner" /> {s.military ? 'Battles rage, the world responds…' : 'The world responds…'}</div>}
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
