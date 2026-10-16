import { useEffect, useState } from 'react';
import type { GameDTO } from '../../shared/types';
import { GameScreen } from './components/GameScreen';
import { MainMenu } from './components/MainMenu';
import { api } from './lib/api';
import { storage } from './lib/format';

const LAST_GAME = 'pax:lastGame';

export function App() {
  const [game, setGame] = useState<GameDTO | null>(null);
  const [booting, setBooting] = useState(true);

  // Resume the last game on reload (convenience only — the real state lives in the DB).
  useEffect(() => {
    const id = storage.get(LAST_GAME);
    if (!id) return setBooting(false);
    api.getGame(id).then(setGame).catch(() => storage.set(LAST_GAME, null)).finally(() => setBooting(false));
  }, []);

  if (booting) return <div className="menu"><div className="muted">Loading…</div></div>;
  if (!game) return <MainMenu onStart={(g) => { storage.set(LAST_GAME, g.id); setGame(g); }} />;
  return <GameScreen key={game.id} initial={game} onMenu={() => { storage.set(LAST_GAME, null); setGame(null); }} />;
}
