// "5,000 Years in 60 Seconds" — frame compositor.
// Every frame is a pure function of time: window.renderFrame(t) draws frame t.

import {
  D2R, R2D, clamp, lerp, smoothstep, easeOutCubic, easeOutQuart, easeInOutSine, envelope, rng, pchip,
  lonLatToVec, angleBetween, sampleRoute, smoothPath,
} from './util.js';
import { CITIES } from './cities.js';
import * as S from './script.js';
import { createEarth } from './earth.js';
import { yearAt, tOfYear, popAt, BILLION_T } from './timeline.js';

const d3 = window.d3;
const topojson = window.topojson;

const query = new URLSearchParams(location.search);
const W = +(query.get('w') || 1920);
const H = +(query.get('h') || 1080);
const PORTRAIT = H > W;
const BASE = PORTRAIT ? W * 0.66 : H;       // unit for globe radius
const u = PORTRAIT ? W / 1080 : H / 1080;   // UI scale

// ── Layout ───────────────────────────────────────────────────────────────
const L = PORTRAIT
  ? {
      capAlign: 'center', capX: W / 2, capY: H * 0.742, headSize: 62 * u, kickerSize: 17 * u,
      hudAlign: 'center', hudX: W / 2, yearY: H * 0.128, yearSize: 104 * u, popY: H * 0.128 + 54 * u,
      tlY: H * 0.79, tlX0: 90 * u, tlX1: W - 90 * u,
      hookY: H * 0.235, hookSize: 70 * u, titleY: H * 0.25, titleSize: 122 * u,
      finalY: H * 0.705, finalSize: 62 * u, finalBig: 82 * u,
      moon: { x: W * 0.82, y: H * 0.245, r: 0.062 * BASE },
      cyShift: -0.09, limbShift: -0.05,
    }
  : {
      capAlign: 'left', capX: 100 * u, capY: H - 128 * u, headSize: 64 * u, kickerSize: 17 * u,
      hudAlign: 'right', hudX: W - 100 * u, yearY: H - 152 * u, yearSize: 88 * u, popY: H - 110 * u,
      tlY: H - 62 * u, tlX0: 100 * u, tlX1: W - 100 * u,
      hookY: H * 0.25, hookSize: 76 * u, titleY: H * 0.30, titleSize: 150 * u,
      finalY: H * 0.885, finalSize: 62 * u, finalBig: 78 * u,
      moon: { x: W * 0.865, y: H * 0.2, r: 0.046 * BASE },
      cyShift: 0, limbShift: 0,
    };

const COLORS = {
  gold: [255, 205, 130], aqua: [140, 215, 255], ember: [255, 122, 70], pale: [255, 238, 212],
  web: [150, 222, 255],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const GOLD_TEXT = '#E6BE78';

// ── Camera ───────────────────────────────────────────────────────────────
const camKeys = S.CAMERA_KEYS.map((k) => {
  const RdPx = k.Rd * BASE;
  const cy = k.limb !== undefined ? k.limb + L.limbShift + RdPx / H : k.cy + L.cyShift;
  return { t: k.t, lon: k.lon, lat: k.lat, P: k.P, lr: Math.log(RdPx), cy };
});
const camT = camKeys.map((k) => k.t);
const camF = {};
for (const f of ['lon', 'lat', 'P', 'lr', 'cy']) camF[f] = pchip(camT, camKeys.map((k) => k[f]));

function cameraAt(t) {
  const P = camF.P(t);
  const Rd = Math.exp(camF.lr(t));
  const lon = camF.lon(t);
  const lat = camF.lat(t);
  const l = lon * D2R;
  const p = lat * D2R;
  const sl = Math.sin(l), cl = Math.cos(l), sp = Math.sin(p), cp = Math.cos(p);
  return {
    lon, lat, P, Rd,
    rl: Math.sqrt((P - 1) / (P + 1)),
    s: Rd / Math.sqrt((P - 1) / (P + 1)),
    cx: W / 2,
    cy: camF.cy(t) * H,
    e: [-sl, cl, 0],
    n: [-sp * cl, -sp * sl, cp],
    o: [cp * cl, cp * sl, sp],
    zoom: Rd / BASE,
  };
}

const PT = { x: 0, y: 0, f: 0 };
/** Project a unit vector (optionally raised by h radii). Returns visibility; fills PT. */
function project(cam, vx, vy, vz, h = 0) {
  const r = 1 + h;
  const x = (vx * cam.e[0] + vy * cam.e[1] + vz * cam.e[2]) * r;
  const y = (vx * cam.n[0] + vy * cam.n[1] + vz * cam.n[2]) * r;
  const z = (vx * cam.o[0] + vy * cam.o[1] + vz * cam.o[2]) * r;
  const P = cam.P;
  if (z >= P - 1e-3) return false;
  const k = (P - 1) / (P - z);
  PT.x = cam.cx + cam.s * k * x;
  PT.y = cam.cy - cam.s * k * y;
  if (h <= 0.0045) {
    const zn = (z / r - 1 / P) / (1 - 1 / P);
    PT.f = smoothstep(0, 0.16, zn);
    return zn > 0;
  }
  // Raised point: hidden only if the planet is in front of it.
  PT.f = 1;
  const dx = x, dy = y, dz = z - P;
  const a = dx * dx + dy * dy + dz * dz;
  const b = P * dz;
  const c = P * P - 1;
  const disc = b * b - a * c;
  if (disc <= 0) return true;
  const t1 = (-b - Math.sqrt(disc)) / a;
  return t1 > 0.9995;
}

// ── Canvases ─────────────────────────────────────────────────────────────
const film = document.getElementById('film');
film.width = W;
film.height = H;
const ctx = film.getContext('2d', { alpha: false, willReadFrequently: true });
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const fx = mk(W, H);
const fxc = fx.getContext('2d');
const b1 = mk(W >> 1, H >> 1);
const b1c = b1.getContext('2d');
const b2 = mk(W >> 2, H >> 2);
const b2c = b2.getContext('2d');

// ── Sprites ──────────────────────────────────────────────────────────────
function makeSprite(core, mid, outer) {
  const n = 128;
  const c = mk(n, n);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, rgba(core, 1));
  g.addColorStop(0.07, rgba(core, 0.92));
  g.addColorStop(0.16, rgba(mid, 0.5));
  g.addColorStop(0.38, rgba(outer, 0.15));
  g.addColorStop(0.72, rgba(outer, 0.03));
  g.addColorStop(1, rgba(outer, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, n, n);
  return c;
}
const SPR = {
  fire: makeSprite([255, 248, 232], [255, 196, 118], [255, 150, 60]),
  electric: makeSprite([255, 252, 244], [255, 226, 176], [255, 190, 110]),
  aqua: makeSprite([240, 252, 255], [150, 220, 255], [70, 160, 255]),
  ember: makeSprite([255, 240, 220], [255, 140, 80], [255, 80, 30]),
  pale: makeSprite([255, 255, 250], [255, 236, 200], [255, 205, 140]),
  gold: makeSprite([255, 250, 235], [255, 214, 140], [255, 170, 70]),
  web: makeSprite([245, 253, 255], [160, 225, 255], [80, 170, 255]),
};
function sprite(c, spr, x, y, r, alpha) {
  if (alpha <= 0.004) return;
  c.globalAlpha = alpha > 1 ? 1 : alpha;
  c.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
}

// ── Stars & nebula ───────────────────────────────────────────────────────
const stars = (() => {
  const r = rng(20261111);
  const out = [];
  const n = Math.round(1500 * ((W * H) / (1920 * 1080)));
  for (let i = 0; i < n; i++) {
    const m = Math.pow(r(), 5);                     // few bright, many faint
    const temp = r();
    out.push({
      x: r(), y: r(),
      depth: 0.5 + r() * 1.1,
      size: (0.45 + m * 1.5) * u,
      a: 0.16 + m * 0.84 + r() * 0.12,
      tw: 0.6 + r() * 2.4, ph: r() * 6.283,
      col: temp < 0.18 ? [178, 205, 255] : temp > 0.86 ? [255, 222, 188] : [236, 240, 255],
      flare: m > 0.55,
    });
  }
  return out;
})();

const nebula = (() => {
  // Soft fBm band, tinted blue/violet — a hint of the Milky Way.
  const w = 256;
  const h = 256;
  const c = mk(w, h);
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  const r = rng(77);
  const G = 64;
  const grid = [];
  for (let o = 0; o < 4; o++) {
    const g = new Float32Array(G * G);
    for (let i = 0; i < g.length; i++) g[i] = r();
    grid.push(g);
  }
  const noise = (g, px, py) => {
    const xi = Math.floor(px), yi = Math.floor(py);
    const fx = px - xi, fy = py - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (a, b) => g[((b % G) + G) % G * G + (((a % G) + G) % G)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), sx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), sx), sy);
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let v = 0;
      let amp = 0.5;
      let f = 4 / w;
      for (let o = 0; o < 4; o++) {
        v += amp * noise(grid[o], i * f * (o + 1), j * f * (o + 1));
        amp *= 0.5;
        f *= 1.9;
      }
      const band = Math.exp(-Math.pow(((i + j * 0.9) / w - 0.95) / 0.33, 2));
      const k = Math.pow(clamp((v - 0.36) * 2.1), 1.6) * band;
      const p = (j * w + i) * 4;
      img.data[p] = 70 + 60 * v;
      img.data[p + 1] = 96 + 50 * v;
      img.data[p + 2] = 190;
      img.data[p + 3] = 255 * k * 0.34;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
})();

function drawBackground(t, cam) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02040a');
  g.addColorStop(1, '#04070f');
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Gentle parallax as the camera travels.
  const px = cam.lon * 0.0016;
  const py = cam.lat * 0.0022 + Math.log(cam.Rd / BASE) * 0.02;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 0.85;
  const nb = Math.max(W, H) * 1.5;
  ctx.drawImage(nebula, -nb * 0.2 + px * W * 0.35, -nb * 0.22 - py * H * 0.35, nb, nb);

  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    let x = (s.x + px * s.depth) % 1;
    if (x < 0) x += 1;
    let y = (s.y - py * s.depth) % 1;
    if (y < 0) y += 1;
    x *= W;
    y *= H;
    const a = clamp(s.a * (0.82 + 0.18 * Math.sin(t * s.tw + s.ph)));
    ctx.fillStyle = rgba(s.col, a);
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, 6.2832);
    ctx.fill();
    if (s.flare) {
      ctx.fillStyle = rgba(s.col, a * 0.1);
      ctx.beginPath();
      ctx.arc(x, y, s.size * 3.4, 0, 6.2832);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ── Cities ───────────────────────────────────────────────────────────────
let cities = [];
const cityByName = {};
function prepareCities() {
  const r = rng(4242);
  cities = CITIES.map(([name, lat, lon, from, to, mag]) => {
    const v = lonLatToVec(lon, lat);
    const c = {
      name, lon, lat, mag, v,
      ti: tOfYear(from),
      te: to === null ? Infinity : tOfYear(to),
      ph: r(),
    };
    if (name === 'Uruk') { c.ti = 6.0; c.hero = true; }
    cityByName[name] = c;
    return c;
  });
}

const MAG_R = [8.5, 13, 19];
const MAG_A = [0.62, 0.84, 1.0];

function drawCities(t, cam) {
  const zoomK = clamp(Math.pow(cam.zoom / 0.7, 0.55), 0.72, 1.9) * u;
  const modern = smoothstep(42, 50, t);
  const scale = lerp(1, 0.5, modern);
  fxc.globalCompositeOperation = 'lighter';
  for (const c of cities) {
    const age = t - c.ti;
    if (age < 0) continue;
    if (!project(cam, c.v[0], c.v[1], c.v[2])) continue;
    const x = PT.x, y = PT.y, lf = PT.f;
    if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
    const rise = 1 - Math.exp(-age / 0.16);
    const flash = Math.exp(-age / 0.3);
    let I = MAG_A[c.mag - 1] * rise * lf;
    if (t > c.te) I *= lerp(1, 0.13, smoothstep(c.te, c.te + 1.3, t));
    I *= 0.93 + 0.07 * Math.sin(t * (2.2 + c.ph * 3) + c.ph * 40);
    const r = MAG_R[c.mag - 1] * zoomK * scale;
    const spr = t > 44 ? SPR.electric : SPR.fire;
    const fl = c.hero ? 2.6 : 1.5;
    sprite(fxc, spr, x, y, r * (1 + fl * flash), I * (1 + 0.9 * flash));
    if (c.mag >= 2 && age < 1.3) {
      // Ignition: an expanding ring and a brief anamorphic streak.
      const p = age / 1.3;
      const rr = (8 + 56 * easeOutCubic(p)) * zoomK * (c.mag === 3 ? 1.25 : 0.8);
      fxc.globalAlpha = Math.pow(1 - p, 2) * 0.7 * lf;
      fxc.strokeStyle = 'rgb(255,214,150)';
      fxc.lineWidth = 1.3 * u;
      fxc.beginPath();
      fxc.arc(x, y, rr, 0, 6.2832);
      fxc.stroke();
      const sl = 110 * zoomK * flash * (c.mag === 3 ? 1.4 : 0.75);
      if (sl > 6) {
        const g = fxc.createLinearGradient(x - sl, 0, x + sl, 0);
        g.addColorStop(0, 'rgba(255,200,130,0)');
        g.addColorStop(0.5, `rgba(255,232,196,${0.75 * flash * lf})`);
        g.addColorStop(1, 'rgba(255,200,130,0)');
        fxc.globalAlpha = 1;
        fxc.fillStyle = g;
        fxc.fillRect(x - sl, y - 1 * u, 2 * sl, 2 * u);
      }
    }
  }
  fxc.globalAlpha = 1;
}

// ── Routes ───────────────────────────────────────────────────────────────
let routes = [];
let web = [];
function prepareRoutes() {
  routes = S.ROUTES.map((r) => {
    const smp = r.kind === 'arc' ? sampleRoute(r.pts, 0.5) : sampleRoute(smoothPath(r.pts), 0.35);
    return { ...r, smp };
  });
  const rnd = rng(991);
  web = S.LINKS.map(([a, b], i) => {
    const pa = S.HUBS[a];
    const pb = S.HUBS[b];
    const smp = sampleRoute([pa, pb], 0.6);
    return {
      smp,
      alt: 0.012 + 0.11 * (smp.total / Math.PI),
      t0: S.WEB_T0 + (i / S.LINKS.length) * 1.9 + rnd() * 0.25,
      dur: 0.55 + smp.total * 0.5,
      ph: rnd(),
      speed: 0.32 + rnd() * 0.2,
    };
  });
}

/** Stroke samples [0, upto] of a route; returns the head position (or null). */
function traceRoute(c, cam, smp, upto, altFn) {
  let pen = false;
  let head = null;
  let count = 0;
  c.beginPath();
  for (let i = 0; i < smp.n; i++) {
    const s = smp.len[i];
    if (s > upto) break;
    const h = altFn ? altFn(s / smp.total) : 0.004;
    const vis = project(cam, smp.pts[i * 3], smp.pts[i * 3 + 1], smp.pts[i * 3 + 2], h);
    if (vis) {
      if (pen) c.lineTo(PT.x, PT.y);
      else c.moveTo(PT.x, PT.y);
      pen = true;
      head = { x: PT.x, y: PT.y, f: PT.f };
      count++;
    } else {
      pen = false;
      head = null;
    }
  }
  return count > 1 || head ? head : null;
}

function drawRoutes(t, cam) {
  fxc.globalCompositeOperation = 'lighter';
  fxc.lineCap = 'round';
  fxc.lineJoin = 'round';
  for (const r of routes) {
    if (t < r.t0 || t > r.out + 0.01) continue;
    const p = easeInOutSine((t - r.t0) / (r.t1 - r.t0));
    const alpha = t < r.hold ? 1 : lerp(1, r.rest, smoothstep(r.hold, r.out, t));
    if (alpha < 0.004) continue;
    const col = COLORS[r.color];
    const alt = r.kind === 'arc' ? (f) => 0.004 + r.alt * Math.sin(Math.PI * f) : null;
    const w = (r.width || 1.7) * u;
    const head = traceRoute(fxc, cam, r.smp, p * r.smp.total, alt);
    fxc.strokeStyle = rgba(col, 0.2 * alpha);
    fxc.lineWidth = w * 3.6;
    fxc.stroke();
    fxc.strokeStyle = rgba(col, 0.95 * alpha);
    fxc.lineWidth = w;
    fxc.stroke();
    if (head && p < 1) {
      const k = Math.min(1, (1 - p) * 8) * Math.min(1, p * 30);
      sprite(fxc, SPR[r.color] || SPR.pale, head.x, head.y, 22 * u, 0.95 * k * head.f);
    }
  }
  fxc.globalAlpha = 1;
}

function drawWeb(t, cam) {
  if (t < S.WEB_T0) return;
  const fade = lerp(1, 0.55, smoothstep(56.5, 59, t));
  fxc.globalCompositeOperation = 'lighter';
  fxc.lineCap = 'round';
  for (const l of web) {
    if (t < l.t0) continue;
    const p = easeOutCubic((t - l.t0) / l.dur);
    const alt = (f) => 0.004 + l.alt * Math.sin(Math.PI * f);
    traceRoute(fxc, cam, l.smp, p * l.smp.total, alt);
    fxc.strokeStyle = rgba(COLORS.web, 0.07 * fade);
    fxc.lineWidth = 3.2 * u;
    fxc.stroke();
    fxc.strokeStyle = rgba(COLORS.web, 0.4 * fade);
    fxc.lineWidth = 0.9 * u;
    fxc.stroke();
    // A pulse of data travelling the link.
    const f = ((t - l.t0) * l.speed + l.ph) % 1;
    if (f < p) {
      const i = Math.min(l.smp.n - 1, Math.floor(f * (l.smp.n - 1)));
      if (project(cam, l.smp.pts[i * 3], l.smp.pts[i * 3 + 1], l.smp.pts[i * 3 + 2], alt(f))) {
        sprite(fxc, SPR.web, PT.x, PT.y, 9 * u, 0.9 * fade);
      }
    }
  }
  fxc.globalAlpha = 1;
}

// ── Rivers ───────────────────────────────────────────────────────────────
let rivers = [];
const RIVER_HI = [
  { names: ['Tigris', 'Dicle', 'Euphrates', 'Al Furat', 'Firat', 'Shatt al Arab'], t0: 6.5, t1: 11.2 },
  { names: ['Nile', 'Rosetta Branch', 'Damietta Branch', 'El Bahr el Abyad', 'Bahr el Jebel', 'El Bahr el Azraq', 'Abay'],
    t0: 9.3, t1: 14.6 },
  { names: ['Indus', 'Shiquan'], t0: 11.8, t1: 15.2 },
  { names: ['Huang'], t0: 12.6, t1: 15.6 },
];
function prepareRivers(data) {
  rivers = data.map((r) => {
    const mid = r.c[Math.floor(r.c.length / 2)];
    return { name: r.n, rank: r.r, geo: { type: 'LineString', coordinates: r.c }, v: lonLatToVec(mid[0], mid[1]) };
  });
}

function makeProjection(cam) {
  const P = cam.P;
  const raw = (l, p) => {
    const cp = Math.cos(p);
    const k = (P - 1) / (P - cp * Math.cos(l));
    return [k * cp * Math.sin(l), k * Math.sin(p)];
  };
  return d3.geoProjection(raw)
    .scale(cam.s)
    .translate([cam.cx, cam.cy])
    .rotate([-cam.lon, -cam.lat])
    .clipAngle(Math.acos(1 / P) * R2D - 0.2)
    .precision(0.5);
}

function drawRivers(t, cam) {
  const base = smoothstep(0.74, 1.25, cam.zoom) * smoothstep(3.2, 6.5, t);
  const anyHi = RIVER_HI.some((h) => t > h.t0 && t < h.t1);
  if (base < 0.01 && !anyHi) return;
  const proj = makeProjection(cam);
  const cap = Math.acos(1 / cam.P) + 0.35;

  if (base >= 0.01) {
    const path = d3.geoPath(proj, ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgb(96,150,225)';
    for (const r of rivers) {
      if (angleBetween(r.v, cam.o) > cap) continue;
      ctx.globalAlpha = base * (r.rank <= 2 ? 0.34 : r.rank <= 4 ? 0.26 : 0.17);
      ctx.lineWidth = (r.rank <= 2 ? 1.5 : 1.1) * u * clamp(cam.zoom, 0.8, 1.6);
      ctx.beginPath();
      path(r.geo);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // The rivers the story names glow.
  const path = d3.geoPath(proj, fxc);
  fxc.globalCompositeOperation = 'lighter';
  fxc.lineCap = 'round';
  fxc.lineJoin = 'round';
  for (const h of RIVER_HI) {
    const a = envelope(t, h.t0, h.t1, 0.9, 1.2);
    if (a < 0.01) continue;
    for (const r of rivers) {
      if (!h.names.includes(r.name)) continue;
      if (angleBetween(r.v, cam.o) > cap) continue;
      const w = clamp(cam.zoom, 0.8, 1.8) * u;
      fxc.beginPath();
      path(r.geo);
      fxc.strokeStyle = `rgba(90,170,255,${0.16 * a})`;
      fxc.lineWidth = 6 * w;
      fxc.stroke();
      fxc.strokeStyle = `rgba(150,210,255,${0.6 * a})`;
      fxc.lineWidth = 1.5 * w;
      fxc.stroke();
    }
  }
}

// ── Moon & Apollo 11 ─────────────────────────────────────────────────────
const apolloV = lonLatToVec(S.APOLLO.from[0], S.APOLLO.from[1]);
function drawMoon(t, cam) {
  const A = S.APOLLO;
  const a = envelope(t, A.moonIn, A.moonOut, 1.1, 0.9);
  if (a < 0.004) return;
  const { x, y, r } = L.moon;

  // Halo (glow layer).
  fxc.globalCompositeOperation = 'lighter';
  const hg = fxc.createRadialGradient(x, y, r * 0.9, x, y, r * 3.0);
  hg.addColorStop(0, `rgba(190,205,235,${0.13 * a})`);
  hg.addColorStop(0.3, `rgba(190,205,235,${0.055 * a})`);
  hg.addColorStop(0.65, `rgba(190,205,235,${0.014 * a})`);
  hg.addColorStop(1, 'rgba(190,205,235,0)');
  fxc.fillStyle = hg;
  fxc.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);

  // Disc.
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.2832);
  ctx.clip();
  const g = ctx.createRadialGradient(x - r * 0.42, y - r * 0.46, r * 0.05, x - r * 0.1, y - r * 0.1, r * 1.25);
  g.addColorStop(0, '#f1eee6');
  g.addColorStop(0.45, '#c9c6bd');
  g.addColorStop(0.8, '#77767a');
  g.addColorStop(1, '#2a2b33');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  const maria = [[-0.28, -0.3, 0.3], [0.12, -0.38, 0.22], [0.3, -0.05, 0.2], [-0.05, 0.08, 0.26], [-0.42, 0.12, 0.16]];
  for (const [mx, my, mr] of maria) {
    const mg = ctx.createRadialGradient(x + mx * r, y + my * r, 0, x + mx * r, y + my * r, mr * r);
    mg.addColorStop(0, 'rgba(40,44,58,0.36)');
    mg.addColorStop(1, 'rgba(40,44,58,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const sh = ctx.createLinearGradient(x - r * 0.25, y - r * 0.3, x + r * 0.95, y + r * 0.85);
  sh.addColorStop(0, 'rgba(3,5,12,0)');
  sh.addColorStop(0.55, 'rgba(3,5,12,0.72)');
  sh.addColorStop(1, 'rgba(3,5,12,0.97)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();

  // Apollo 11's path from Cape Canaveral.
  const pa = clamp((t - A.t0) / (A.t1 - A.t0));
  const fadeA = 1 - smoothstep(A.moonOut - 1.3, A.moonOut - 0.5, t);
  if (pa > 0 && fadeA > 0.01 && project(cam, apolloV[0], apolloV[1], apolloV[2])) {
    const ax = PT.x, ay = PT.y;
    const tx = x - r * 0.72, ty = y + r * 0.72;
    // Leave the planet and swing over its northern limb.
    const cxp = cam.cx - cam.Rd * 0.55;
    const cyp = cam.cy - cam.Rd * 1.72;
    const p = easeInOutSine(pa);
    fxc.beginPath();
    let hx = ax, hy = ay;
    const N = 80;
    for (let i = 0; i <= N * p; i++) {
      const f = i / N;
      const q = 1 - f;
      hx = q * q * ax + 2 * q * f * cxp + f * f * tx;
      hy = q * q * ay + 2 * q * f * cyp + f * f * ty;
      if (i === 0) fxc.moveTo(hx, hy);
      else fxc.lineTo(hx, hy);
    }
    fxc.strokeStyle = `rgba(255,236,205,${0.18 * fadeA})`;
    fxc.lineWidth = 5 * u;
    fxc.stroke();
    fxc.setLineDash([2 * u, 7 * u]);
    fxc.strokeStyle = `rgba(255,244,225,${0.95 * fadeA})`;
    fxc.lineWidth = 1.6 * u;
    fxc.stroke();
    fxc.setLineDash([]);
    if (pa < 1) sprite(fxc, SPR.pale, hx, hy, 20 * u, 0.95);
    else sprite(fxc, SPR.pale, tx, ty, 34 * u * Math.exp(-(t - A.t1) / 0.35) + 7 * u, fadeA);
    fxc.globalAlpha = 1;
  }

  // Label.
  const la = envelope(t, A.t1 - 0.25, A.moonOut - 0.2, 0.5, 0.6);
  if (la > 0.01) {
    ctx.save();
    ctx.globalAlpha = la;
    ctx.font = `600 ${12.5 * u}px "Inter"`;
    ctx.letterSpacing = `${3.6 * u}px`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,238,212,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10 * u;
    ctx.fillText('APOLLO 11 · 1969', x + 1.8 * u, y + r + 30 * u);
    ctx.restore();
  }
}

// ── Labels ───────────────────────────────────────────────────────────────
let labels = [];
function prepareLabels() {
  labels = S.LABELS.map((l) => {
    let v;
    if (l.city) {
      const c = cityByName[l.city];
      if (!c) throw new Error('Unknown label city: ' + l.city);
      v = c.v;
    } else v = lonLatToVec(l.at[0], l.at[1]);
    return { ...l, v };
  });
}

function drawLabels(t, cam) {
  for (const l of labels) {
    const a0 = envelope(t, l.t0, l.t1, 0.45, 0.45);
    if (a0 < 0.01) continue;
    if (!project(cam, l.v[0], l.v[1], l.v[2])) continue;
    const a = a0 * PT.f;
    const x = PT.x, y = PT.y;
    if (x < 30 || x > W - 30 || y < 30 || y > H - 30) continue;
    const dx = (l.dx || 0) * u, dy = (l.dy || 0) * u;
    const align = l.align || 'left';
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.92)';
    ctx.shadowBlur = 9 * u;
    ctx.shadowOffsetY = 1 * u;
    ctx.textAlign = align;
    if (l.river) {
      ctx.font = `italic 500 ${22 * u}px "Cormorant Garamond"`;
      ctx.letterSpacing = `${1.2 * u}px`;
      ctx.fillStyle = 'rgba(176,214,255,0.95)';
      ctx.fillText(l.text, x + dx, y + dy);
    } else if (l.route) {
      ctx.font = `600 ${12.5 * u}px "Inter"`;
      ctx.letterSpacing = `${3.6 * u}px`;
      ctx.fillStyle = 'rgba(214,238,255,0.96)';
      ctx.fillText(l.text, x + dx + (align === 'center' ? 1.8 * u : 0), y + dy);
      ctx.shadowBlur = 4 * u;
      ctx.fillText(l.text, x + dx + (align === 'center' ? 1.8 * u : 0), y + dy);
    } else {
      // Marker ring, leader, name.
      const grow = easeOutCubic((t - l.t0) / 0.6);
      ctx.strokeStyle = 'rgba(255,244,225,0.9)';
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.arc(x, y, 6.5 * u * (1.6 - 0.6 * grow), 0, 6.2832);
      ctx.stroke();
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      ctx.strokeStyle = 'rgba(255,244,225,0.55)';
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.moveTo(x + ux * 8 * u, y + uy * 8 * u);
      ctx.lineTo(x + ux * (8 * u + (len - 11 * u) * grow), y + uy * (8 * u + (len - 11 * u) * grow));
      ctx.stroke();
      const tx = x + dx + (align === 'right' ? -4 : 4) * u;
      const ty = y + dy + (dy > 0 ? 13 : -2) * u;
      ctx.font = `600 ${17 * u}px "Cinzel"`;
      ctx.letterSpacing = `${2.6 * u}px`;
      ctx.fillStyle = 'rgba(255,248,236,0.98)';
      ctx.shadowBlur = 14 * u;
      ctx.fillText(l.text, tx + (align === 'right' ? 2.6 * u : 0), ty);
      ctx.shadowBlur = 5 * u;
      ctx.fillText(l.text, tx + (align === 'right' ? 2.6 * u : 0), ty);
      if (l.sub) {
        ctx.font = `italic 500 ${17 * u}px "Cormorant Garamond"`;
        ctx.letterSpacing = `${0.6 * u}px`;
        ctx.fillStyle = 'rgba(230,190,120,0.95)';
        ctx.fillText(l.sub, tx, ty + 19 * u);
      }
    }
    ctx.restore();
  }
}

// ── Typography ───────────────────────────────────────────────────────────
const headFont = (px, italic) => `${italic ? 'italic 500' : '600'} ${px}px "Cormorant Garamond"`;

function layoutLine(text, px) {
  // '*' toggles italic emphasis. Returns words with fonts and widths.
  const words = [];
  let italic = false;
  for (const seg of text.split('*')) {
    for (const w of seg.split(' ')) {
      if (w.length) words.push({ w, italic });
    }
    italic = !italic;
  }
  let x = 0;
  for (const wd of words) {
    ctx.font = headFont(px, wd.italic);
    ctx.letterSpacing = '0px';
    wd.width = ctx.measureText(wd.w).width;
    wd.space = px * 0.235;
    wd.x = x;
    x += wd.width + wd.space;
  }
  const width = words.length ? x - words[words.length - 1].space : 0;
  return { words, width };
}

function drawHeadline(lines, px, x, yLast, align, t, t0, alphaOut, lead = 1.15) {
  const lh = px * lead;
  let idx = 0;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.88)';
  ctx.shadowBlur = 20 * u;
  ctx.shadowOffsetY = 2 * u;
  lines.forEach((line, li) => {
    const { words, width } = layoutLine(line, px);
    const y = yLast - (lines.length - 1 - li) * lh;
    const ox = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    for (const wd of words) {
      const p = clamp((t - t0 - 0.16 - idx * 0.06) / 0.6);
      idx++;
      if (p <= 0) continue;
      ctx.globalAlpha = easeOutCubic(p) * alphaOut;
      ctx.font = headFont(px, wd.italic);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = wd.italic ? '#FBE7C2' : '#FFFFFF';
      ctx.fillText(wd.w, ox + wd.x, y + (1 - easeOutQuart(p)) * 18 * u);
    }
  });
  ctx.restore();
  return yLast - (lines.length - 1) * lh;   // baseline of first line
}

function drawKicker(text, x, y, align, t, t0, alphaOut) {
  const p = clamp((t - t0) / 0.9);
  if (p <= 0) return;
  const px = L.kickerSize;
  const ls = lerp(0.52, 0.32, easeOutCubic(p)) * px;
  ctx.save();
  ctx.font = `600 ${px}px "Inter"`;
  ctx.letterSpacing = `${ls}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12 * u;
  const a = easeOutCubic(p) * alphaOut;
  const rule = 46 * u * easeOutCubic(clamp((t - t0) / 0.7));
  if (align === 'left') {
    ctx.globalAlpha = a;
    ctx.fillStyle = GOLD_TEXT;
    ctx.fillRect(x, y - px * 0.36 - 1 * u, rule, 2 * u);
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 46 * u + 18 * u, y);
  } else {
    ctx.globalAlpha = a;
    ctx.fillStyle = GOLD_TEXT;
    ctx.textAlign = 'center';
    ctx.fillText(text, x + ls / 2, y);
    ctx.fillRect(x - rule / 2, y - px * 1.9, rule, 2 * u);
  }
  ctx.restore();
}

function drawCaptions(t) {
  for (const c of S.CAPTIONS) {
    if (t < c.t0 || t > c.t1) continue;
    const out = 1 - smoothstep(c.t1 - 0.45, c.t1, t);
    const lines = PORTRAIT && c.linesP ? c.linesP : c.lines;
    if (c.kind === 'lower') {
      const y0 = drawHeadline(lines, L.headSize, L.capX, L.capY, L.capAlign, t, c.t0, out);
      drawKicker(c.kicker, L.capX, y0 - L.headSize * 1.08, L.capAlign, t, c.t0, out);
    } else if (c.kind === 'hook') {
      const n = lines.length;
      drawHeadline(lines, L.hookSize, W / 2, L.hookY + (n - 1) * L.hookSize * 1.2 * 0.5, 'center', t, c.t0, out, 1.2);
    } else if (c.kind === 'final') {
      const px = c.big ? L.finalBig : L.finalSize;
      const y0 = drawHeadline(lines, px, W / 2, L.finalY, 'center', t, c.t0, out, 1.16);
      if (c.kicker) drawKicker(c.kicker, W / 2, y0 - px * 1.12, 'center', t, c.t0, out);
    } else if (c.kind === 'title') {
      drawTitle(c, t, out);
    }
  }
}

function drawTitle(c, t, out) {
  const p = clamp((t - c.t0) / 1.5);
  const e = easeOutCubic(p);
  const px = L.titleSize;
  const y = L.titleY + px * 0.36;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Kicker.
  const kpx = 17 * u;
  const kls = lerp(0.8, 0.52, e) * kpx;
  ctx.globalAlpha = easeOutCubic(clamp((t - c.t0) / 0.9)) * out;
  ctx.font = `600 ${kpx}px "Inter"`;
  ctx.letterSpacing = `${kls}px`;
  ctx.fillStyle = GOLD_TEXT;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 14 * u;
  ctx.fillText(c.kicker, W / 2 + kls / 2, y - px * 0.98);

  // Title: Cinzel capitals, gold gradient, tracking that settles.
  const ls = lerp(0.2, 0.085, e) * px;
  ctx.font = `600 ${px}px "Cinzel"`;
  ctx.letterSpacing = `${ls}px`;
  const g = ctx.createLinearGradient(0, y - px * 0.74, 0, y + px * 0.04);
  g.addColorStop(0, '#FFF3D6');
  g.addColorStop(0.5, '#EBC784');
  g.addColorStop(1, '#B98A3E');
  ctx.globalAlpha = e * out;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.fillStyle = g;
  ctx.fillText(c.title, W / 2 + ls / 2, y);

  // Subtitle between hairlines.
  const sp = clamp((t - c.t0 - 0.45) / 1.0);
  if (sp > 0) {
    const spx = 25 * u;
    const sls = lerp(0.9, 0.62, easeOutCubic(sp)) * spx;
    ctx.font = `500 ${spx}px "Cinzel"`;
    ctx.letterSpacing = `${sls}px`;
    ctx.globalAlpha = easeOutCubic(sp) * out;
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#F6EBD6';
    const sy = y + px * 0.42;
    ctx.fillText(c.sub, W / 2 + sls / 2, sy);
    const tw = ctx.measureText(c.sub).width;
    const rw = 90 * u * easeOutCubic(sp);
    ctx.fillStyle = GOLD_TEXT;
    ctx.fillRect(W / 2 - tw / 2 - 30 * u - rw, sy - spx * 0.36, rw, 1.5 * u);
    ctx.fillRect(W / 2 + tw / 2 + 30 * u, sy - spx * 0.36, rw, 1.5 * u);
  }
  ctx.restore();
}

// ── HUD: year, population, timeline ──────────────────────────────────────
const TL_TICKS = [[-3000, '3000 BCE'], [-2000, '2000'], [-1000, '1000'], [1, '1 CE'], [1000, '1000'],
  [1500, '1500'], [1800, '1800'], [1900, '1900'], [2000, '2000']];
let tlTicks = [];

function formatPop(m) {
  if (m >= 995) return `${(m / 1000).toFixed(1)} BILLION`;
  const mag = Math.pow(10, Math.floor(Math.log10(m)) - 1);
  return `${Math.round(m / mag) * mag} MILLION`;
}

function drawHUD(t) {
  const a = envelope(t, 5.7, 57.0, 0.9, 0.7);
  if (a < 0.004) return;
  const year = yearAt(t);
  const today = t >= S.TODAY_T;
  const yr = Math.round(year);
  const digits = today ? 'TODAY' : String(yr <= 0 ? Math.max(1, -yr) : yr);
  const suffix = today ? '' : yr <= 0 ? 'BCE' : yr < 1000 ? 'CE' : '';

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 18 * u;

  // Year — digits in fixed cells so the counter never jitters.
  const px = L.yearSize;
  ctx.font = `500 ${px}px "Cinzel"`;
  ctx.letterSpacing = '0px';
  let cell = 0;
  for (const d of '0123456789') cell = Math.max(cell, ctx.measureText(d).width);
  cell *= 1.04;
  const sfxPx = 19 * u;
  const sfxLs = 0.3 * sfxPx;
  ctx.font = `600 ${sfxPx}px "Inter"`;
  ctx.letterSpacing = `${sfxLs}px`;
  const sfxW = suffix ? ctx.measureText(suffix).width + 14 * u : 0;
  ctx.font = `500 ${px}px "Cinzel"`;
  ctx.letterSpacing = today ? `${0.06 * px}px` : '0px';
  const numW = today ? ctx.measureText(digits).width : cell * digits.length;
  const total = numW + sfxW;
  let x0 = L.hudAlign === 'right' ? L.hudX - total : L.hudX - total / 2;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#FFFFFF';
  if (today) {
    ctx.textAlign = 'left';
    const tp = easeOutCubic((t - S.TODAY_T) / 0.6);
    ctx.globalAlpha = a * tp;
    ctx.fillStyle = '#FBE7C2';
    ctx.fillText(digits, x0, L.yearY);
  } else {
    ctx.textAlign = 'center';
    for (let i = 0; i < digits.length; i++) ctx.fillText(digits[i], x0 + cell * (i + 0.5), L.yearY);
  }
  if (suffix) {
    ctx.font = `600 ${sfxPx}px "Inter"`;
    ctx.letterSpacing = `${sfxLs}px`;
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD_TEXT;
    ctx.fillText(suffix, x0 + numW + 14 * u, L.yearY);
  }

  // Population.
  const pop = popAt(year);
  const flash = t > BILLION_T ? Math.exp(-(t - BILLION_T) / 0.7) : 0;
  const lblPx = 11.5 * u;
  const valPx = 25 * u * (1 + 0.1 * flash);
  const label = 'WORLD POPULATION';
  const value = formatPop(pop);
  ctx.font = `600 ${lblPx}px "Inter"`;
  ctx.letterSpacing = `${0.32 * lblPx}px`;
  const lw = ctx.measureText(label).width;
  ctx.font = `600 ${valPx}px "Cinzel"`;
  ctx.letterSpacing = `${0.08 * valPx}px`;
  const vw = ctx.measureText(value).width;
  const gap = 16 * u;
  const tw = lw + gap + vw;
  const px0 = L.hudAlign === 'right' ? L.hudX - tw : L.hudX - tw / 2;
  ctx.globalAlpha = a * 0.62;
  ctx.textAlign = 'left';
  ctx.font = `600 ${lblPx}px "Inter"`;
  ctx.letterSpacing = `${0.32 * lblPx}px`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, px0, L.popY - 3 * u);
  ctx.globalAlpha = a;
  ctx.font = `600 ${valPx}px "Cinzel"`;
  ctx.letterSpacing = `${0.08 * valPx}px`;
  ctx.fillStyle = flash > 0.02 ? `rgb(255,${Math.round(231 + 20 * (1 - flash))},${Math.round(194 + 50 * (1 - flash))})` : '#F6EEDD';
  if (flash > 0.02) {
    ctx.shadowColor = `rgba(255,190,90,${0.9 * flash})`;
    ctx.shadowBlur = 26 * u;
  }
  ctx.fillText(value, px0 + lw + gap, L.popY);
  ctx.restore();

  // Timeline.
  ctx.save();
  const x0t = L.tlX0, x1t = L.tlX1, y = L.tlY;
  const f = clamp((t - 6) / (S.TODAY_T - 6));
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x0t, y - 0.5 * u, x1t - x0t, 1 * u);
  const g = ctx.createLinearGradient(x0t, 0, x0t + (x1t - x0t) * f, 0);
  g.addColorStop(0, 'rgba(230,190,120,0.25)');
  g.addColorStop(1, 'rgba(240,205,140,1)');
  ctx.fillStyle = g;
  ctx.fillRect(x0t, y - 1 * u, (x1t - x0t) * f, 2 * u);
  ctx.font = `500 ${10.5 * u}px "Inter"`;
  ctx.letterSpacing = `${1.6 * u}px`;
  ctx.textAlign = 'center';
  for (const tk of tlTicks) {
    const x = x0t + (x1t - x0t) * tk.f;
    const passed = f >= tk.f;
    ctx.fillStyle = passed ? 'rgba(240,205,140,0.9)' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(x - 0.5 * u, y - 5 * u, 1 * u, 10 * u);
    ctx.fillStyle = passed ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.36)';
    ctx.fillText(tk.label, x + 0.8 * u, y + 25 * u);
  }
  const hx = x0t + (x1t - x0t) * f;
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, SPR.gold, hx, y, 16 * u, a);
  ctx.restore();
}

// ── Scrims, vignette, grain ──────────────────────────────────────────────
const vignette = (() => {
  const c = mk(W, H);
  const x = c.getContext('2d');
  const r = Math.hypot(W, H) / 2;
  const g = x.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r * 1.02);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
})();

const scrim = (() => {
  const c = mk(8, H);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  if (PORTRAIT) {
    g.addColorStop(0, 'rgba(1,3,8,0.78)');
    g.addColorStop(0.1, 'rgba(1,3,8,0.55)');
    g.addColorStop(0.24, 'rgba(1,3,8,0)');
    g.addColorStop(0.5, 'rgba(1,3,8,0)');
    g.addColorStop(0.64, 'rgba(1,3,8,0.6)');
    g.addColorStop(0.8, 'rgba(1,3,8,0.86)');
    g.addColorStop(1, 'rgba(1,3,8,0.95)');
  } else {
    g.addColorStop(0, 'rgba(1,3,8,0)');
    g.addColorStop(0.5, 'rgba(1,3,8,0)');
    g.addColorStop(0.72, 'rgba(1,3,8,0.5)');
    g.addColorStop(0.9, 'rgba(1,3,8,0.84)');
    g.addColorStop(1, 'rgba(1,3,8,0.93)');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, 8, H);
  return c;
})();

const grain = (() => {
  const r = rng(555);
  const tiles = [];
  for (let k = 0; k < 6; k++) {
    const n = 256;
    const c = mk(n, n);
    const x = c.getContext('2d');
    const img = x.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = Math.floor((r() + r()) * 1.6);   // 0..3, triangular
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
})();

function drawGrain(frame) {
  const tile = grain[frame % grain.length];
  const ox = (frame * 97) % 256;
  const oy = (frame * 57) % 256;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(tile, x, y);
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = "rgb(1,1,1)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

// ── Frame ────────────────────────────────────────────────────────────────
let earth = null;

function lightsGain(t) {
  // The lights of the 20th century falter twice.
  const dip = (a, b, depth) => depth * smoothstep(a, a + 0.18, t) * (1 - smoothstep(b - 0.22, b, t));
  const flick = 0.5 + 0.5 * Math.sin(t * 47) * Math.sin(t * 31.7);
  const d = dip(49.2, 49.72, 0.3) + dip(50.0, 50.5, 0.42);
  const growth = lerp(0.6, 1, smoothstep(44, 52.5, t));
  return (1 - d * (0.72 + 0.28 * flick)) * growth * lerp(1, 1.22, smoothstep(53.5, 56, t));
}

// Optional stage timing: set window.__marks = [] to collect [label, ms] pairs.
const mark = (label) => { if (window.__marks) window.__marks.push([label, performance.now()]); };

function renderFrame(t) {
  mark('start');
  t = clamp(t, 0, S.DURATION);
  const frame = Math.round(t * S.FPS);
  const cam = cameraAt(t);
  const year = yearAt(t);

  drawBackground(t, cam);
  mark('background');

  // Earth: surface, then emissive lights into the glow layer.
  const dawn = smoothstep(54.5, 60, t);
  const sun = [-0.5, 0.62, lerp(-0.62, -0.47, dawn)];
  const opts = { year, lights: lightsGain(t), sun, dawn };
  earth.render(cam, { ...opts, mode: 0 });
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(earth.canvas, 0, 0);
  mark('earth');

  fxc.globalCompositeOperation = 'source-over';
  fxc.globalAlpha = 1;
  if (year > 1740) {
    earth.render(cam, { ...opts, mode: 1 });
    fxc.drawImage(earth.canvas, 0, 0);
  } else {
    fxc.fillStyle = '#000';
    fxc.fillRect(0, 0, W, H);
  }

  mark('emissive');
  drawRivers(t, cam);
  drawRoutes(t, cam);
  drawWeb(t, cam);
  drawCities(t, cam);
  drawMoon(t, cam);
  mark('overlays');

  // Glow layer + two-stage bloom.
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.drawImage(fx, 0, 0);
  // Blur at reduced resolution (cheap), then upsample.
  b1c.globalCompositeOperation = 'copy';
  b1c.imageSmoothingQuality = 'high';
  b1c.filter = `blur(${2 * u}px)`;
  b1c.drawImage(fx, 0, 0, b1.width, b1.height);
  b2c.globalCompositeOperation = 'copy';
  b2c.imageSmoothingQuality = 'high';
  b2c.filter = `blur(${4.5 * u}px)`;
  b2c.drawImage(b1, 0, 0, b2.width, b2.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(b1, 0, 0, W, H);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(b2, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  mark('bloom');

  drawLabels(t, cam);

  // Lower-third scrim while captions / HUD are up.
  const sa = envelope(t, 5.4, 59.6, 1.0, 0.5);
  if (sa > 0.004) {
    ctx.globalAlpha = sa;
    ctx.drawImage(scrim, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(vignette, 0, 0);

  mark('labels+scrim');
  drawHUD(t);
  drawCaptions(t);
  mark('text');
  drawGrain(frame);
  mark('grain');

  // Fade from / to black.
  const black = 1 - smoothstep(0.0, 1.1, t) + smoothstep(59.25, 59.9, t);
  if (black > 0.002) {
    ctx.globalAlpha = clamp(black);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

async function init() {
  const fonts = [
    '600 64px "Cormorant Garamond"', 'italic 500 64px "Cormorant Garamond"', '500 88px "Cinzel"',
    '600 17px "Cinzel"', '600 17px "Inter"', '500 11px "Inter"',
  ];
  await Promise.all(fonts.map((f) => document.fonts.load(f, 'A–Z 0123 ó·')));
  await document.fonts.ready;

  const [land50, countries110, riverData] = await Promise.all([
    fetch('/node_modules/world-atlas/land-50m.json').then((r) => r.json()),
    fetch('/node_modules/world-atlas/countries-110m.json').then((r) => r.json()),
    fetch('/film/data/rivers.json').then((r) => r.json()),
  ]);
  const land = topojson.feature(land50, land50.objects.land);
  const countries = topojson.feature(countries110, countries110.objects.countries);

  earth = await createEarth(W, H, { d3, land, countries, texBase: '/node_modules/three-globe/example/img/' });
  prepareCities();
  prepareRoutes();
  prepareRivers(riverData);
  prepareLabels();
  tlTicks = TL_TICKS.map(([y, label]) => ({ f: (tOfYear(y) - 6) / (S.TODAY_T - 6), label }));

  window.renderFrame = renderFrame;
  window.grabFrame = (t) => {
    renderFrame(t);
    return ctx.getImageData(0, 0, W, H).data;
  };
  return { duration: S.DURATION, fps: S.FPS, width: W, height: H };
}

window.filmReady = init();
