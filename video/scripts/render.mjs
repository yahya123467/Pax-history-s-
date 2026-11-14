// Render the film: N headless-Chromium workers draw frames and POST raw RGBA to
// this process, which pipes each worker's frames into its own x264 encoder.
// The segments are then joined and muxed with the score.
//
//   node scripts/render.mjs [--w 1920 --h 1080 --workers 4 --crf 15 --out out/film.mp4]
//                           [--from 0 --to 60]   (seconds, for partial test renders)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
const WORKERS = +arg('workers', 4);
const CRF = arg('crf', '15');
const PRESET = arg('preset', 'slow');
const OUT = path.resolve(ROOT, arg('out', 'out/film.mp4'));
const AUDIO = path.resolve(ROOT, arg('audio', 'out/score.wav'));
const FPS = 60;
const T0 = +arg('from', 0);
const T1 = +arg('to', 60);
const first = Math.round(T0 * FPS);
const last = Math.round(T1 * FPS);           // exclusive
const total = last - first;

const tmp = path.join(ROOT, 'out', `segments-${W}x${H}`);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

// Split the frame range into contiguous chunks, one per worker.
const chunks = [];
for (let k = 0; k < WORKERS; k++) {
  const a = first + Math.floor((total * k) / WORKERS);
  const b = first + Math.floor((total * (k + 1)) / WORKERS);
  if (b > a) chunks.push({ k, a, b, file: path.join(tmp, `seg${String(k).padStart(2, '0')}.mp4`) });
}

const encoders = chunks.map((c) => {
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-profile:v', 'high', '-level', '4.2',
    '-g', String(FPS * 2), '-keyint_min', String(FPS), '-bf', '2',
    '-x264-params', 'aq-mode=3:aq-strength=1.0:deblock=-1,-1:psy-rd=1.0,0.1:threads=2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-video_track_timescale', '15360', c.file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code} for worker ${c.k}`))));
  });
  return { ff, done };
});

let rendered = 0;
const started = Date.now();
const server = await startServer((worker, index, buf) => new Promise((resolve, reject) => {
  if (buf.length !== W * H * 4) return reject(new Error(`bad frame size ${buf.length}`));
  rendered++;
  if (rendered % 120 === 0 || rendered === total) {
    const el = (Date.now() - started) / 1000;
    const eta = (el / rendered) * (total - rendered);
    console.log(`${rendered}/${total} frames  ${(rendered / el).toFixed(1)} fps  eta ${Math.round(eta)}s`);
  }
  // Respect back-pressure from the encoder.
  if (encoders[worker].ff.stdin.write(buf)) resolve();
  else encoders[worker].ff.stdin.once('drain', resolve);
}));

// One browser per worker: pages in a single browser share its GPU process.
await Promise.all(chunks.map(async (c, idx) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[worker ${c.k}]`, e.message));
  await page.goto(`http://127.0.0.1:${server.port}/film/index.html?w=${W}&h=${H}`);
  await page.evaluate(() => window.filmReady);
  await page.evaluate(async ({ a, b, fps, worker }) => {
    for (let i = a; i < b; i++) {
      const data = window.grabFrame(i / fps);
      const res = await fetch(`/frame?w=${worker}&i=${i}`, { method: 'POST', body: data });
      if (!res.ok) throw new Error('frame upload failed: ' + res.status);
    }
  }, { a: c.a, b: c.b, fps: FPS, worker: idx });
  await browser.close();
  encoders[idx].ff.stdin.end();
}));
await Promise.all(encoders.map((e) => e.done));
server.close();
console.log(`frames done in ${((Date.now() - started) / 1000).toFixed(0)}s; joining…`);

// Join the segments (stream copy) and add the score.
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${c.file}'`).join('\n'));
const partial = total !== 60 * FPS;
const mux = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
if (fs.existsSync(AUDIO)) {
  mux.push('-ss', String(T0), '-t', String(T1 - T0), '-i', AUDIO, '-map', '0:v', '-map', '1:a',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
}
mux.push('-c:v', 'copy', '-movflags', '+faststart', '-shortest',
  '-metadata', 'title=5,000 Years in 60 Seconds', OUT);
const r = spawnSync('ffmpeg', mux, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)${partial ? ' [partial]' : ''}`);
