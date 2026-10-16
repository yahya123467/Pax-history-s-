/**
 * OpenRouter (OpenAI-compatible) client with retry + JSON repair.
 *
 * - The API key is read from server env only and never leaves this process.
 * - Up to 3 attempts with exponential backoff (1s, 2s, ... + jitter) on:
 *     network errors, timeouts, HTTP 408/409/425/429/5xx, malformed JSON, schema mismatch.
 * - On a malformed reply the next attempt tells the model exactly what was wrong,
 *   which fixes most failures on the second try.
 * - Non-retryable HTTP errors (401 bad key, 402 no credits, 400 bad request) fail fast.
 */
import type { z } from 'zod';
import { config } from '../config';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const backoffMs = (attempt: number) => 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);

async function complete(messages: ChatMsg[], opts: { json: boolean; temperature: number; maxTokens: number }): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);
  try {
    const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Pax History',
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new AIError(`OpenRouter HTTP ${res.status}: ${body}`, RETRYABLE_STATUS.has(res.status));
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (data.error) throw new AIError(`OpenRouter error: ${data.error.message}`, true);
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new AIError('Empty completion', true);
    return content;
  } catch (e) {
    if (e instanceof AIError) throw e;
    const msg = (e as Error).name === 'AbortError' ? `timed out after ${config.ai.timeoutMs}ms` : (e as Error).message;
    throw new AIError(`AI request failed: ${msg}`, true);
  } finally {
    clearTimeout(timer);
  }
}

/** Pull a JSON object out of a reply that may be wrapped in prose or ``` fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('no JSON object found');
  }
}

/** Ask for JSON and validate it against a zod schema, retrying with feedback. */
export async function completeJson<T>(
  messages: ChatMsg[],
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  opts: { temperature?: number; maxTokens?: number; label?: string } = {},
): Promise<T> {
  const convo = [...messages];
  let lastErr: Error = new Error('unknown');
  for (let attempt = 1; attempt <= config.ai.maxAttempts; attempt++) {
    let raw = '';
    try {
      raw = await complete(convo, { json: true, temperature: opts.temperature ?? 0.8, maxTokens: opts.maxTokens ?? 1800 });
      let parsed: unknown;
      try {
        parsed = extractJson(raw);
      } catch (e) {
        throw new AIError(`malformed JSON (${(e as Error).message})`, true);
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new AIError(`JSON did not match schema: ${issues}`, true);
      }
      return result.data;
    } catch (e) {
      lastErr = e as Error;
      const retryable = e instanceof AIError ? e.retryable : true;
      console.warn(`[ai] ${opts.label ?? 'call'} attempt ${attempt}/${config.ai.maxAttempts} failed: ${lastErr.message}`);
      if (!retryable || attempt === config.ai.maxAttempts) break;
      if (raw) {
        // Give the model its own bad output plus a precise correction.
        convo.push({ role: 'assistant', content: raw.slice(0, 4000) });
        convo.push({
          role: 'user',
          content: `Your previous reply was rejected: ${lastErr.message}. Reply again with ONLY a single valid JSON object that follows the required format exactly. No prose, no code fences.`,
        });
      }
      await sleep(backoffMs(attempt));
    }
  }
  throw new AIError(`AI ${opts.label ?? 'call'} failed after ${config.ai.maxAttempts} attempts: ${lastErr.message}`, false);
}

/** Plain-text completion (used for in-character diplomacy replies). Same retry policy. */
export async function completeText(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number; label?: string } = {}): Promise<string> {
  let lastErr: Error = new Error('unknown');
  for (let attempt = 1; attempt <= config.ai.maxAttempts; attempt++) {
    try {
      return (await complete(messages, { json: false, temperature: opts.temperature ?? 0.9, maxTokens: opts.maxTokens ?? 600 })).trim();
    } catch (e) {
      lastErr = e as Error;
      const retryable = e instanceof AIError ? e.retryable : true;
      console.warn(`[ai] ${opts.label ?? 'text'} attempt ${attempt}/${config.ai.maxAttempts} failed: ${lastErr.message}`);
      if (!retryable || attempt === config.ai.maxAttempts) break;
      await sleep(backoffMs(attempt));
    }
  }
  throw new AIError(`AI ${opts.label ?? 'call'} failed after ${config.ai.maxAttempts} attempts: ${lastErr.message}`, false);
}
