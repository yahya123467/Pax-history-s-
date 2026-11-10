/** Compact military situation text for the AI narrator prompt. */
import type { WorldState } from '../../../shared/types';
import { mil } from './world';

export function militarySummary(state: WorldState): string {
  if (!state.military) return '';
  const m = mil(state);
  const name = (id: string) => state.nations[id]?.name ?? id;
  const lines: string[] = [];
  lines.push(`WARS: ${m.wars.length ? m.wars.map((w) => `${name(w.a)} vs ${name(w.b)} (since ${w.since.slice(0, 7)})`).join('; ') : 'none'}`);
  const occ = Object.entries(m.occupation).filter(([, o]) => o.progress > 0);
  if (occ.length) lines.push(`FRONTS (occupation progress): ${occ.map(([p, o]) => `${state.provinces[p]?.name} ${Math.round(o.progress)}% held by ${name(o.by)}`).join('; ')}`);
  const b = m.battles;
  if (b.length) {
    lines.push('BATTLES THIS MONTH (already resolved by the combat system — narrate them, do not change their outcome):');
    for (const x of b.slice(0, 10)) {
      const res = x.captured ? 'province captured' : x.winner === 'stalemate' ? 'stalemate' : `${x.winner} won`;
      lines.push(`- ${x.provinceName}: ${x.attacker.nations.map(name).join('+')} attacking ${x.defender.nations.map(name).join('+')} — ${res}; occupation ${x.occupationAfter}%; casualties ${x.attacker.casualties}/${x.defender.casualties}`);
    }
  }
  const counts = new Map<string, number>();
  for (const d of m.divisions) counts.set(d.owner, (counts.get(d.owner) ?? 0) + 1);
  const top = [...counts].filter(([id]) => !state.nations[id]?.minor).sort((a, c) => c[1] - a[1]).slice(0, 12);
  lines.push(`ARMIES (divisions): ${top.map(([id, k]) => `${name(id)} ${k}`).join(', ')}`);
  return lines.join('\n');
}
