/** Diplomacy chat: in-character replies and post-talks summaries. */
import { z } from 'zod';
import type { ChatThread, Nation, WorldState } from '../../../shared/types';
import { config } from '../config';
import { completeJson, completeText, type ChatMsg } from './client';
import { mockChatReply, mockConclude } from './mock';
import { DIPLOMACY_SUMMARY_SYSTEM_PROMPT, diplomacySummaryUserPrompt, diplomacySystemPrompt } from './prompts';

/** How many previous messages of the thread to replay to the model. */
const HISTORY_WINDOW = 20;

export async function chatReply(state: WorldState, nation: Nation, thread: ChatThread): Promise<string> {
  const last = thread.messages[thread.messages.length - 1];
  if (config.ai.mock) return mockChatReply(state, nation, last?.text ?? '');
  const msgs: ChatMsg[] = [{ role: 'system', content: diplomacySystemPrompt(state, nation) }];
  for (const m of thread.messages.slice(-HISTORY_WINDOW))
    msgs.push({ role: m.role === 'player' ? 'user' : 'assistant', content: m.text });
  return completeText(msgs, { temperature: 0.9, maxTokens: 500, label: `chat:${nation.id}` });
}

export const talksOutcomeSchema = z.object({
  agreements: z.array(z.string()).default([]),
  summary: z.string().min(1),
  relation_delta: z.number().default(0),
});
export type TalksOutcome = z.infer<typeof talksOutcomeSchema>;

export async function summarizeTalks(state: WorldState, nation: Nation, thread: ChatThread): Promise<TalksOutcome> {
  const fresh = thread.messages.slice(thread.concludedUpTo);
  if (config.ai.mock) {
    const lastNation = [...fresh].reverse().find((m) => m.role === 'nation');
    return mockConclude(state, nation, lastNation?.text ?? '');
  }
  const player = state.nations[state.playerNation];
  const transcript = fresh
    .map((m) => `${m.role === 'player' ? `${player.name} (${player.leader})` : `${nation.name} (${nation.leader})`}: ${m.text}`)
    .join('\n\n');
  return completeJson(
    [
      { role: 'system', content: DIPLOMACY_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: diplomacySummaryUserPrompt(state, nation, transcript) },
    ],
    talksOutcomeSchema,
    { temperature: 0.2, maxTokens: 500, label: `talks:${nation.id}` },
  );
}
