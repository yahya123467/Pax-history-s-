import { useEffect, useRef, useState } from 'react';
import type { WorldState } from '../../../shared/types';

export function EventLog({ state }: { state: WorldState }) {
  const end = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [state.events.length]);

  return (
    <aside className="panel event-log">
      <h2>Event Log</h2>
      <div className="scroll">
        {state.historySummary && (
          <div className="history">
            <button className="link" onClick={() => setHistoryOpen((o) => !o)}>
              {historyOpen ? '▾' : '▸'} History so far <span className="muted">({state.archivedEventCount} events)</span>
            </button>
            {historyOpen && <p>{state.historySummary}</p>}
          </div>
        )}
        {state.events.map((e) =>
          e.kind === 'system' && e.text.startsWith('—') ? (
            <div key={e.id} className="month-divider">{e.text.replace(/—/g, '').trim()}</div>
          ) : (
            <div key={e.id} className={`event ${e.kind}`}>
              <span className="kind">{e.kind}</span>
              {e.text}
            </div>
          ),
        )}
        <div ref={end} />
      </div>
    </aside>
  );
}
