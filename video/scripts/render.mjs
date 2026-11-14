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

// Work is split into short chunks, each encoded to its own segment. A chunk that
// fails is retried, and finished segments are kept, so a render can be resumed
// with --resume after an interruption.
const CHUNK = +arg('chunk', 300);
const tmp = path.join(ROOT, 'out', `segments-${W}x${H}-crf${CRF}`);
if (!process.argv.includes('--resume')) fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const chunks = [];
for (let a = first, k = 0; a < last; a += CHUNK, k++) {
  chunks.push({ k, a, b: Math.min(last, a + CHUNK), file: path.join(tmp, `seg${String(k).padStart(3, '0')}.mp4`) });
}

const sinks = new Map();          // chunk index -> ffmpeg stdin
let rendered = 0;
const started = Date.now();
const server = await startServer((k, index, buf) => new Promise((resolve, reject) => {
  const sink = sinks.get(k);
  if (!sink) return reject(new Error(`no encoder for chunk ${k}`));
  if (buf.length !== W * H * 4) return reject(new Error(`bad frame size ${buf.length}`));
  rendered++;
  if (rendered % 120 === 0) {
    const el = (Date.now() - started) / 1000;
    console.log(`${rendered} frames  ${(rendered / el).toFixed(2)} fps`);
  }
  if (sink.write(buf)) resolve();       // respect encoder back-pressure
  else sink.once('drain', resolve);
}));

async function renderChunk(c) {
  const part = c.file + '.part.mp4';
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-profile:v', 'high', '-level', '4.2',
    '-g', String(FPS * 2), '-keyint_min', String(FPS), '-bf', '2',
    '-x264-params', 'aq-mode=3:aq-strength=1.0:deblock=-1,-1:psy-rd=1.0,0.1:threads=2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-video_track_timescale', '15360', part,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.stdin.on('error', () => {});
  const done = new Promise((resolve) => ff.on('close', resolve));
  sinks.set(c.k, ff.stdin);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${server.port}/film/index.html?w=${W}&h=${H}`);
    await page.evaluate(() => window.filmReady);
    await page.evaluate(async ({ a, b, fps, k }) => {
      for (let i = a; i < b; i++) {
        const data = window.grabFrame(i / fps);
        const res = await fetch(`/frame?w=${k}&i=${i}`, { method: 'POST', body: data });
        if (!res.ok) throw new Error('frame upload failed: ' + res.status);
      }
    }, { a: c.a, b: c.b, fps: FPS, k: c.k });
    ff.stdin.end();
    const code = await done;
    if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
    fs.renameSync(part, c.file);
  } catch (err) {
    ff.kill('SIGKILL');
    throw err;
  } finally {
    sinks.delete(c.k);
    await browser.close().catch(() => {});
  }
}

const queue = chunks.filter((c) => !fs.existsSync(c.file));
console.log(`${chunks.length} chunks, ${queue.length} to render`);
await Promise.all(Array.from({ length: WORKERS }, async () => {
  for (let c = queue.shift(); c; c = queue.shift()) {
    for (let attempt = 1; ; attempt++) {
      try {
        await renderChunk(c);
        console.log(`chunk ${c.k} done (${((Date.now() - started) / 1000).toFixed(0)}s)`);
        break;
      } catch (err) {
        console.error(`chunk ${c.k} attempt ${attempt} failed: ${String(err && err.message).split('\n')[0]}`);
        if (attempt >= 4) throw err;
      }
    }
  }
}));
server.close();

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
