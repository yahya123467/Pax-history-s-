import { Fragment, useEffect, useRef, useState } from 'react';
import type { WorldState } from '../../../shared/types';
import { relation, relationColor, signed } from '../lib/format';

interface Props {
  state: WorldState;
  nationId: string | null;
  onSelectNation: (id: string) => void;
  busy: 'chat' | 'conclude' | null;
  disabled: boolean;
  onSend: (nationId: string, message: string) => Promise<boolean>;
  onConclude: (nationId: string) => void;
}

export function DiplomacyPanel({ state, nationId, onSelectNation, busy, disabled, onSend, onConclude }: Props) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const others = Object.values(state.nations)
    .filter((n) => n.alive && n.id !== state.playerNation)
    .sort((a, b) => a.name.localeCompare(b.name));
  const majors = others.filter((n) => !n.minor);
  const minors = others.filter((n) => n.minor);
  const nation = nationId ? state.nations[nationId] : null;
  const thread = nationId ? state.chats[nationId] : undefined;
  const pending = thread ? thread.messages.length - thread.concludedUpTo : 0;

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [thread?.messages.length, busy]);

  async function send() {
    if (!nationId || !text.trim()) return;
    if (await onSend(nationId, text)) setText('');
  }

  const rel = nation ? relation(state, state.playerNation, nation.id) : 0;
  return (
    <section className="panel diplomacy">
      <h2>Diplomacy</h2>
      <div className="row">
        <select value={nationId ?? ''} onChange={(e) => onSelectNation(e.target.value)}>
          <option value="" disabled>Choose a nation…</option>
          <optgroup label="Powers">
            {majors.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({signed(relation(state, state.playerNation, n.id))}){state.chats[n.id]?.messages.length ? ' •' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Minor nations">
            {minors.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </optgroup>
        </select>
        {nation && <b className="small" style={{ color: relationColor(rel) }}>{signed(rel)}</b>}
      </div>
      {nation ? (
        <>
          <div className="muted small persona">
            <i className="flag" style={{ background: nation.color }} /> {nation.leader} · {nation.government}
          </div>
          <div className="chat scroll">
            {!thread?.messages.length && <div className="muted small center">Open the conversation. Make concrete offers — {nation.name} acts in its own interest.</div>}
            {thread?.messages.map((m, i) => (
              <Fragment key={i}>
                {i === thread.concludedUpTo && i > 0 && <div className="concluded-divider">talks concluded</div>}
                <div className={`msg ${m.role}${i < thread.concludedUpTo ? ' old' : ''}`}>
                  <div className="who">{m.role === 'player' ? state.nations[state.playerNation].leader : nation.leader}</div>
                  <div className="text">{m.text}</div>
                </div>
              </Fragment>
            ))}
            {thread && thread.concludedUpTo === thread.messages.length && thread.messages.length > 0 && (
              <div className="concluded-divider">talks concluded</div>
            )}
            {busy === 'chat' && <div className="msg nation typing"><span className="spinner" /> {nation.leader} is considering…</div>}
            <div ref={end} />
          </div>
          <div className="chat-input">
            <textarea
              rows={2}
              value={text}
              disabled={disabled}
              placeholder={`Message ${nation.leader}…`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
            />
            <div className="row">
              <button className="btn" disabled={disabled || pending === 0} onClick={() => onConclude(nation.id)} title="Summarise any agreements into the event log">
                {busy === 'conclude' ? <><span className="spinner" /> Recording…</> : 'Conclude talks'}
              </button>
              <button className="btn primary" disabled={disabled || !text.trim()} onClick={send}>Send</button>
            </div>
          </div>
        </>
      ) : (
        <div className="muted small center pad">Pick a nation, or click a country on the map and choose “Open talks”.</div>
      )}
    </section>
  );
}
