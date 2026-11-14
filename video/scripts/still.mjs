// Render still frames for review.
//   node scripts/still.mjs --out out/stills --t 0.5,3,6.5 [--w 1920 --h 1080]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer, ROOT } from './server.mjs';

// Playwright is resolved the CommonJS way so a global install (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)('playwright');

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const W = +arg('w', 1920);
const H = +arg('h', 1080);
const out = path.resolve(ROOT, arg('out', 'out/stills'));
const times = arg('t', '1,7,13,19,25,31,37,43,49,55').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });

const server = await startServer(async () => {});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${server.port}/film/index.html?w=${W}&h=${H}`);
const t0 = Date.now();
const info = await page.evaluate(() => window.filmReady);
console.log('ready in', Date.now() - t0, 'ms', JSON.stringify(info));
for (const t of times) {
  const s = Date.now();
  const dataUrl = await page.evaluate((tt) => {
    window.renderFrame(tt);
    return document.getElementById('film').toDataURL('image/png');
  }, t);
  const name = `t${t.toFixed(2).padStart(5, '0')}.png`;
  fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(name, Date.now() - s, 'ms');
}
await browser.close();
server.close();
