/** Turn resolution + history compression. Picks live AI or the offline mock. */
import { z } from 'zod';
import type { GameEvent, WorldState } from '../../../shared/types';
import { config } from '../config';
import { turnResolutionSchema, type ParsedResolution } from '../validation/changes';
import { completeJson } from './client';
import { mockHistory, mockResolveTurn } from './mock';
import { ENGINE_SYSTEM_PROMPT, HISTORY_SYSTEM_PROMPT, engineUserPrompt, historyUserPrompt } from './prompts';

export async function resolveTurn(state: WorldState, playerAction: string): Promise<ParsedResolution> {
  if (config.ai.mock) return mockResolveTurn(state, playerAction);
  return completeJson(
    [
      { role: 'system', content: ENGINE_SYSTEM_PROMPT },
      { role: 'user', content: engineUserPrompt(state, playerAction) },
    ],
    turnResolutionSchema,
    { temperature: 0.8, maxTokens: 2200, label: 'turn' },
  );
}

const historySchema = z.object({ summary: z.string().min(1) });

export async function summarizeHistory(previous: string, events: GameEvent[]): Promise<string> {
  const text = events.map((e) => `- [${e.date.slice(0, 7)}] (${e.kind}) ${e.text}`).join('\n');
  if (config.ai.mock) return mockHistory(previous, text);
  const res = await completeJson(
    [
      { role: 'system', content: HISTORY_SYSTEM_PROMPT },
      { role: 'user', content: historyUserPrompt(previous, text) },
    ],
    historySchema,
    { temperature: 0.3, maxTokens: 600, label: 'history' },
  );
  return res.summary.trim();
}
