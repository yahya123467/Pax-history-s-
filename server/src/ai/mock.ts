/**
 * Offline mock engine — used when no OPENROUTER_API_KEY is set (or AI_MOCK=1).
 *
 * It is deliberately simple keyword matching, but it produces the exact same JSON
 * contract as the real model, so every downstream path (validation, map updates,
 * event log, memory, save/load) can be exercised without spending tokens.
 */
import type { Nation, WorldState } from '../../../shared/types';
import { PROVINCE_META } from '../state/provinces';
import { getRelation, majorNations, provincesOf } from '../state/world';
import type { ParsedResolution } from '../validation/changes';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];

const HOSTILE = /\b(invade|invasion|attack|annex|conquer|occupy|march into|declare war|war on|seize|bomb)\b/i;
const FRIENDLY = /\b(alliance|ally|pact|treaty|trade|friend|cooperat|support|aid|guarantee|non-aggression)\b/i;

function mentionedNations(state: WorldState, text: string): Nation[] {
  const t = text.toLowerCase();
  return Object.values(state.nations).filter(
    (n) => n.id !== state.playerNation && n.alive && (t.includes(n.name.toLowerCase()) || new RegExp(`\\b${n.id}\\b`).test(text)),
  );
}

export function mockResolveTurn(state: WorldState, action: string): ParsedResolution {
  const r = rng(state.turn * 7919 + action.length);
  const player = state.nations[state.playerNation];
  const changes: ParsedResolution['state_changes'] = [];
  const reactions: ParsedResolution['nation_reactions'] = [];
  let narrative: string;
  const targets = mentionedNations(state, action);
  const target = targets[0];

  if (target && HOSTILE.test(action)) {
    const playerProvs = new Set(provincesOf(state, player.id).map((p) => p.id));
    const theirs = provincesOf(state, target.id);
    const bordering = theirs.filter((p) => PROVINCE_META.get(p.id)?.neighbours.some((n) => playerProvs.has(n)));
    const power = player.economy + player.stability - (target.economy + target.stability) * 0.8 + r() * 60;
    const prov = (bordering.length ? bordering : theirs)[0];
    if (prov && power > 40) {
      changes.push({ type: 'transfer_province', province: prov.id, to: player.id });
      changes.push({ type: 'new_event', text: `${player.name} seized ${prov.name} from ${target.name}.` });
      narrative = `Your forces crossed into ${prov.name}. After weeks of fighting, ${target.name}'s defences gave way and your flag now flies over its capital. Foreign chanceries are in uproar.`;
    } else {
      changes.push({ type: 'new_event', text: `${player.name}'s offensive against ${target.name} stalled.` });
      narrative = `Your offensive against ${target.name} ran into stubborn resistance and bad roads. The front has barely moved, and casualty lists are growing.`;
      changes.push({ type: 'stat_change', nation: player.id, stat: 'stability', delta: -5 });
    }
    changes.push({ type: 'relation_change', a: player.id, b: target.id, delta: -35 });
    for (const [friend, v] of Object.entries(target.relations))
      if (v >= 40 && friend !== player.id && state.nations[friend]?.alive) changes.push({ type: 'relation_change', a: player.id, b: friend, delta: -12 });
    reactions.push({ nation: target.id, reaction: `${target.leader} denounced the aggression and swore that ${target.name} will never submit.` });
  } else if (target && FRIENDLY.test(action)) {
    const rel = getRelation(state, player.id, target.id);
    const accepted = rel + r() * 50 > 20;
    changes.push({ type: 'relation_change', a: player.id, b: target.id, delta: accepted ? 15 : -5 });
    changes.push({
      type: 'new_event',
      text: accepted ? `${player.name} and ${target.name} drew closer after a diplomatic initiative.` : `${target.name} rebuffed ${player.name}'s overtures.`,
    });
    narrative = accepted
      ? `Your envoys were received warmly in ${target.name}. The talks produced a cordial communiqué and promises of closer cooperation.`
      : `Your envoys returned from ${target.name} empty-handed. ${target.leader} was polite but noncommittal and clearly distrustful.`;
    reactions.push({ nation: target.id, reaction: accepted ? 'We welcome this friendship — within limits.' : 'We see no reason to bind ourselves to you.' });
  } else {
    changes.push({ type: 'stat_change', nation: player.id, stat: 'economy', delta: 2 });
    changes.push({
      type: 'new_event',
      text: action.trim() ? `${player.name} pursued domestic policy: ${action.trim().slice(0, 120)}` : `${player.name} spent a quiet month on internal affairs.`,
    });
    narrative = action.trim()
      ? `Your government spent the month on its programme. Ministries report modest progress and the public mood is steady.`
      : `A quiet month. Your ministers attended to routine business while the world's attention was elsewhere.`;
  }

  // 1–3 autonomous AI initiatives
  const actors = majorNations(state).filter((n) => n.alive && n.id !== player.id);
  const count = 1 + Math.floor(r() * 3);
  for (let i = 0; i < count && actors.length; i++) {
    const a = pick(r, actors);
    const others = actors.filter((n) => n.id !== a.id);
    const b = pick(r, others);
    const roll = r();
    if (roll < 0.3) {
      changes.push({ type: 'new_event', text: `${a.name} signed a trade agreement with ${b.name}.` });
      changes.push({ type: 'relation_change', a: a.id, b: b.id, delta: 10 });
    } else if (roll < 0.55) {
      changes.push({ type: 'new_event', text: `${a.name} lodged a sharp protest with ${b.name} over a border incident.` });
      changes.push({ type: 'relation_change', a: a.id, b: b.id, delta: -10 });
    } else if (roll < 0.8) {
      changes.push({ type: 'new_event', text: `${a.name} announced a new rearmament and industrial programme.` });
      changes.push({ type: 'stat_change', nation: a.id, stat: 'economy', delta: 3 });
    } else {
      changes.push({ type: 'new_event', text: `Strikes and demonstrations shook ${a.name}.` });
      changes.push({ type: 'stat_change', nation: a.id, stat: 'stability', delta: -4 });
    }
    if (reactions.length < 3) reactions.push({ nation: a.id, reaction: `${a.leader} is watching ${player.name} closely.` });
  }
  return { narrative: `[Offline mock engine — set OPENROUTER_API_KEY for the real AI]\n\n${narrative}`, nation_reactions: reactions, state_changes: changes };
}

export function mockChatReply(state: WorldState, nation: Nation, message: string): string {
  const rel = getRelation(state, nation.id, state.playerNation);
  const player = state.nations[state.playerNation];
  if (FRIENDLY.test(message)) {
    if (rel >= 30) return `${player.name} has been a reliable partner. Very well — we agree in principle, provided the terms are put in writing and respected.`;
    if (rel >= -20) return `An interesting proposal. But what does ${nation.name} gain from it? Offer something concrete and we may talk further.`;
    return `You must think us fools. After everything, ${player.name} wants our friendship? No.`;
  }
  if (HOSTILE.test(message)) return `Threats will not move ${nation.name}. We will defend ourselves, and others will stand with us.`;
  return `${nation.leader} listens carefully. "${nation.name} has its own interests: ${nation.goals[0] ?? 'security'}. Tell me how your proposal serves them."`;
}

export function mockConclude(state: WorldState, nation: Nation, lastNationMessage: string) {
  const player = state.nations[state.playerNation];
  const agreed = /\bwe agree\b/i.test(lastNationMessage);
  return {
    agreements: agreed ? [`${player.name} and ${nation.name} agreed in principle to closer cooperation.`] : [],
    summary: agreed ? `Talks between ${player.name} and ${nation.name} ended in agreement.` : `Talks between ${player.name} and ${nation.name} ended without agreement.`,
    relation_delta: agreed ? 8 : -2,
  };
}

export function mockHistory(previous: string, eventsText: string): string {
  const lines = eventsText.split('\n').map((l) => l.replace(/^- \[[^\]]+\] \([^)]+\) /, '')).filter(Boolean);
  return `${previous ? previous + ' ' : ''}${lines.join(' ')}`.slice(-1500);
}
