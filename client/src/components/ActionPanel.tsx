import { useState } from 'react';
import type { WorldState } from '../../../shared/types';

interface Props {
  state: WorldState;
  busy: boolean;
  onEndTurn: (action: string) => Promise<boolean>;
}

const EXAMPLES = [
  'Remilitarise the Rhineland and announce it as a defensive measure.',
  'Propose an anti-communist pact with Japan.',
  'Launch a four-year plan to boost industry, funded by deficit spending.',
];

export function ActionPanel({ state, busy, onEndTurn }: Props) {
  const [action, setAction] = useState('');
  const [showMech, setShowMech] = useState(false);
  const report = state.lastReport;

  async function submit() {
    if (await onEndTurn(action)) setAction('');
  }

  return (
    <section className="panel action-panel">
      <h2>Orders <span className="muted small">for this month</span></h2>
      <textarea
        value={action}
        disabled={busy}
        placeholder={`What does ${state.nations[state.playerNation].name} do this month?\n\ne.g. "${EXAMPLES[state.turn % EXAMPLES.length]}"`}
        onChange={(e) => setAction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
        }}
        maxLength={2000}
      />
      <div className="row">
        <span className="muted small">{action.length}/2000 · Ctrl+Enter</span>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {busy ? <><span className="spinner" /> Resolving…</> : 'End Turn ▸'}
        </button>
      </div>

      {report && (
        <div className="report scroll">
          <div className="eyebrow">Report · turn {report.turn}</div>
          {report.narrative.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          {report.nationReactions.length > 0 && (
            <div className="reactions">
              {report.nationReactions.map((r, i) => (
                <div key={i} className="reaction"><strong>{r.nation}:</strong> “{r.reaction}”</div>
              ))}
            </div>
          )}
          <button className="link small" onClick={() => setShowMech((s) => !s)}>
            {showMech ? '▾' : '▸'} Mechanics ({report.applied.length} applied{report.rejected.length ? `, ${report.rejected.length} rejected` : ''})
          </button>
          {showMech && (
            <ul className="mechanics small">
              {report.applied.map((a, i) => <li key={`a${i}`} className="ok">{a}</li>)}
              {report.rejected.map((a, i) => <li key={`r${i}`} className="rejected">✕ {a}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
