/**
 * Compact, token-frugal text rendering of the world for AI prompts.
 *
 * Design decision: a pipe-separated table is ~3x smaller than pretty JSON and
 * models read it just as well. Minor nations get one line; relations are only
 * listed when they matter (anything involving the player, or |score| >= 40).
 */
import type { WorldState } from '../../../shared/types';
import { formatDate, getRelation, majorNations, provincesOf } from './world';

export function worldSummary(state: WorldState): string {
  const player = state.nations[state.playerNation];
  const lines: string[] = [];
  lines.push(`DATE: ${formatDate(state.date)} (turn ${state.turn})`);
  lines.push(`PLAYER NATION: ${player.id} ${player.name}`);
  lines.push('');
  lines.push('MAJOR NATIONS — id | name | leader | government | stability | economy | relation w/ player | provinces (id=name)');
  for (const n of majorNations(state)) {
    if (!n.alive) continue;
    const provs = provincesOf(state, n.id).map((p) => `${p.id}=${p.name}`).join(', ');
    const rel = n.id === player.id ? 'PLAYER' : fmt(getRelation(state, player.id, n.id));
    lines.push(`${n.id} | ${n.name} | ${n.leader} | ${n.government} | stab ${n.stability} | econ ${n.economy} | ${rel} | ${provs}`);
  }
  const minors = Object.values(state.nations).filter((n) => n.minor && n.alive);
  if (minors.length) {
    lines.push('');
    lines.push('MINOR NATIONS — id=name (each owns the province with the same id unless noted):');
    lines.push(
      minors
        .map((n) => {
          const provs = provincesOf(state, n.id);
          const extra = provs.length === 1 && provs[0].id === n.id ? '' : ` [${provs.map((p) => p.id).join(',')}]`;
          return `${n.id}=${n.name}${extra}`;
        })
        .join(', '),
    );
  }
  const dead = Object.values(state.nations).filter((n) => !n.alive && !n.minor);
  if (dead.length) lines.push('', `DEFUNCT (no territory): ${dead.map((n) => `${n.id} ${n.name}`).join(', ')}`);

  const pairs: string[] = [];
  const majors = majorNations(state).filter((n) => n.alive);
  for (let i = 0; i < majors.length; i++)
    for (let j = i + 1; j < majors.length; j++) {
      const a = majors[i], b = majors[j];
      if (a.id === player.id || b.id === player.id) continue;
      const r = getRelation(state, a.id, b.id);
      if (Math.abs(r) >= 40) pairs.push(`${a.id}-${b.id} ${fmt(r)}`);
    }
  if (pairs.length) lines.push('', `NOTABLE RELATIONS (others): ${pairs.join(', ')}`);
  return lines.join('\n');
}

export function recentEventsText(state: WorldState, count = 10): string {
  // Month dividers ("— April 1936 —") are UI-only; don't spend prompt slots on them.
  const evs = state.events.filter((e) => !(e.kind === 'system' && e.text.startsWith('—'))).slice(-count);
  if (!evs.length) return '(none)';
  return evs.map((e) => `- [${e.date.slice(0, 7)}] (${e.kind}) ${e.text}`).join('\n');
}

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
