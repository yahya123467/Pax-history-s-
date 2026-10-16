import { useEffect, useMemo, useState } from 'react';
import type { GameDTO, SaveSummary, ScenarioSummary } from '../../../shared/types';
import { api, type GameListItem } from '../lib/api';
import { formatDate, monthName } from '../lib/format';

export function MainMenu({ onStart }: { onStart: (g: GameDTO) => void }) {
  const [tab, setTab] = useState<'new' | 'load'>('new');
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [nation, setNation] = useState('');
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [health, setHealth] = useState<{ aiMode: string; model: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.scenarios().then((list) => {
      setScenarios(list);
      if (list[0]) pickScenario(list[0]);
    }).catch((e) => setError(`Cannot reach the server: ${e.message}`));
    api.health().then(setHealth).catch(() => {});
    refreshLoad();
  }, []);

  function refreshLoad() {
    api.saves().then(setSaves).catch(() => {});
    api.games().then(setGames).catch(() => {});
  }

  function pickScenario(s: ScenarioSummary) {
    setScenarioId(s.id);
    const [y, m] = s.startDate.split('-').map(Number);
    setYear(y);
    setMonth(m);
    setNation(s.playableNations[0]?.id ?? '');
  }

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const years = useMemo(() => {
    if (!scenario) return [];
    const [a, b] = scenario.startRange.map((d) => Number(d.slice(0, 4)));
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }, [scenario]);
  const months = useMemo(() => {
    if (!scenario) return [];
    const [lo, hi] = scenario.startRange;
    return Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      return ym >= lo && ym <= hi;
    });
  }, [scenario, year]);

  async function go<T>(fn: () => Promise<T>) {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const chosen = scenario?.playableNations.find((n) => n.id === nation);
  return (
    <div className="menu">
      <div className="menu-card">
        <h1>PAX<span>HISTORY</span></h1>
        <p className="muted">An AI-driven alternate-history grand strategy game. Pick a nation, write your orders in plain language, and watch the world respond.</p>
        {health && (
          <p className="small">
            AI engine: {health.aiMode === 'live' ? <b className="good">live · {health.model}</b> : <b className="warn-text">offline mock (set OPENROUTER_API_KEY in .env)</b>}
          </p>
        )}
        <div className="tabs">
          <button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>New game</button>
          <button className={tab === 'load' ? 'active' : ''} onClick={() => { setTab('load'); refreshLoad(); }}>Load game</button>
        </div>
        {error && <div className="error-inline">{error}</div>}

        {tab === 'new' && scenario && (
          <div className="new-game">
            <label>Scenario</label>
            <div className="scenarios">
              {scenarios.map((s) => (
                <button key={s.id} className={`scenario ${s.id === scenarioId ? 'active' : ''}`} onClick={() => pickScenario(s)}>
                  <strong>{s.name}</strong>
                  <span className="small muted">{s.description}</span>
                </button>
              ))}
            </div>
            <label>Start date</label>
            <div className="row">
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
            </div>
            <label>Nation</label>
            <div className="nations">
              {scenario.playableNations.map((n) => (
                <button key={n.id} className={`nation-btn ${n.id === nation ? 'active' : ''}`} onClick={() => setNation(n.id)} title={n.blurb}>
                  <i className="flag" style={{ background: n.color }} />
                  {n.name}
                </button>
              ))}
            </div>
            {chosen && <p className="small"><b>{chosen.leader}</b> — {chosen.blurb}</p>}
            <button
              className="btn primary big"
              disabled={loading || !nation}
              onClick={() =>
                go(async () => {
                  const g = await api.createGame({ scenarioId, nation, startMonth: `${year}-${String(month).padStart(2, '0')}` });
                  onStart(g);
                })
              }
            >
              {loading ? 'Creating world…' : `Lead ${chosen?.name ?? ''} ▸`}
            </button>
          </div>
        )}

        {tab === 'load' && (
          <div className="load-game">
            <label>Saved games</label>
            {saves.length === 0 && <p className="muted small">No saves yet. Use “Save game” in-game.</p>}
            {saves.map((s) => (
              <div className="save-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted small">{s.playerNation} · {formatDate(s.date)} · turn {s.turn} · saved {s.createdAt}</div>
                </div>
                <button className="btn primary" disabled={loading} onClick={() => go(async () => onStart(await api.loadSave(s.id)))}>Load</button>
                <button className="btn" disabled={loading} onClick={() => go(async () => { await api.deleteSave(s.id); refreshLoad(); })}>Delete</button>
              </div>
            ))}
            <label>Recent games (autosaved every turn)</label>
            {games.length === 0 && <p className="muted small">No games yet.</p>}
            {games.map((g) => (
              <div className="save-row" key={g.id}>
                <div>
                  <strong>{g.name}</strong>
                  <div className="muted small">{formatDate(g.date)} · turn {g.turn} · {g.updatedAt}</div>
                </div>
                <button className="btn" disabled={loading} onClick={() => go(async () => onStart(await api.getGame(g.id)))}>Continue</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
