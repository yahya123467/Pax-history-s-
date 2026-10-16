import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { api, errorHandler } from './routes/api';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);
app.use('/api', errorHandler);

// In production the server also serves the built client.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`Pax History server on http://localhost:${config.port}`);
  console.log(
    config.ai.mock
      ? '[ai] MOCK mode — no OPENROUTER_API_KEY set (or AI_MOCK=1). The offline engine will be used.'
      : `[ai] live mode — model ${config.ai.model}`,
  );
});
