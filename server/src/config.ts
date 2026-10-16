/** Server configuration from environment. `.env` lives at the repo root; real env vars win over it. */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(serverRoot, '../.env') });
const env = process.env;

const apiKey = env.OPENROUTER_API_KEY?.trim() ?? '';

export const config = {
  port: Number(env.PORT ?? 3001),
  databasePath: path.resolve(serverRoot, env.DATABASE_PATH ?? './data/pax.sqlite'),
  clientDist: path.resolve(serverRoot, '../client/dist'),
  ai: {
    apiKey,
    model: env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini',
    baseUrl: (env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 60000),
    maxAttempts: 3,
    /** No key (or AI_MOCK=1) -> deterministic offline engine so the game is still playable. */
    mock: env.AI_MOCK === '1' || !apiKey,
  },
};
