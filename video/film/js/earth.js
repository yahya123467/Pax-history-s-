// WebGL2 Earth: a ray-traced sphere shaded as a moonlit night planet with a thin
// dawn crescent, atmosphere, bump-mapped relief and NASA night lights that switch
// on region by region as the film's year advances.

import { D2R } from './util.js';

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;       // canvas size in px
uniform vec2  uCenter;    // globe centre in px (y down)
uniform float uScale;     // px per unit on the tangent plane
uniform float uP;         // camera distance from Earth's centre, in radii
uniform mat3  uView;      // columns = east, north, out  (world <- view)
uniform vec3  uSun;       // sun direction in view space
uniform float uYear;      // drives the night lights
uniform float uLights;    // master gain for texture lights
uniform float uDawn;      // 0..1 extra daylight (finale)
uniform int   uMode;      // 0 = surface + atmosphere, 1 = emissive lights only

uniform sampler2D uDay;
uniform sampler2D uTopo;
uniform sampler2D uMask;
uniform sampler2D uNight;

out vec4 outColor;

const float PI = 3.141592653589793;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 pix = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = (pix - uCenter) / uScale;
  q.y = -q.y;

  float rl  = sqrt((uP - 1.0) / (uP + 1.0));   // limb radius on the plane
  float rho = length(q);

  // Ray from the camera through the tangent plane, intersected with the unit sphere.
  vec3 C = vec3(0.0, 0.0, uP);
  vec3 d = vec3(q, 1.0 - uP);
  float a = dot(d, d);
  float b = dot(C, d);
  float c = uP * uP - 1.0;
  float disc = b * b - a * c;

  // ---- Atmosphere halo outside the limb --------------------------------
  vec2 dir = rho > 1e-6 ? q / rho : vec2(0.0, 1.0);
  float zl = 1.0 / uP;
  vec3 nLimb = vec3(dir * sqrt(1.0 - zl * zl), zl);
  float sunLimb = dot(nLimb, uSun);
  float sunSide = smoothstep(-0.45, 0.55, sunLimb);
  float dr = max(rho - rl, 0.0) / rl;
  float halo = exp(-dr / 0.018) * 0.85 + exp(-dr / 0.07) * 0.30 + exp(-dr / 0.25) * 0.05;
  vec3 airBlue = vec3(0.22, 0.48, 1.0);
  vec3 airWarm = vec3(1.0, 0.56, 0.24);
  float warm = smoothstep(0.05, 0.75, sunLimb) * exp(-dr / 0.012);
  vec3 haloCol = mix(airBlue, airWarm, warm * 0.75) * halo * (0.10 + 1.15 * sunSide + 0.5 * uDawn * sunSide);

  float cov = clamp((rl - rho) * uScale + 0.5, 0.0, 1.0);

  if (disc < 0.0 || cov <= 0.0) {
    if (uMode == 1) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    haloCol += (hash(gl_FragCoord.xy + 3.7) - 0.5) / 255.0 * step(0.004, halo);
    outColor = vec4(max(haloCol, 0.0), 0.0);   // additive glow over the star field
    return;
  }

  float t = (-b - sqrt(max(disc, 0.0))) / a;
  vec3 n = normalize(C + t * d);            // view-space normal
  vec3 w = uView * n;                       // world-space normal
  float lat = asin(clamp(w.z, -1.0, 1.0));
  float lon = atan(w.y, w.x);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);

  // Seam-safe derivatives for mip selection.
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  if (abs(dx.x) > 0.5) dx.x -= sign(dx.x);
  if (abs(dy.x) > 0.5) dy.x -= sign(dy.x);

  vec3 V = normalize(C - n);
  float cosV = clamp(dot(n, V), 0.0, 1.0);
  float limbFade = smoothstep(0.0, 0.22, cosV);
  float sunDot = dot(n, uSun);
  float dayF = smoothstep(-0.10, 0.26, sunDot);

  if (uMode == 1) {
    // ---- Emissive: NASA night lights, switched on by ignition year -----
    vec4 nt = textureGrad(uNight, uv, dx, dy);
    float L = nt.r;
    float ig = 1700.0 + nt.g * 400.0;
    float on = smoothstep(ig, ig + 14.0, uYear);
    float lum = pow(L, 0.85) * on * uLights;
    vec3 colL = mix(vec3(1.0, 0.62, 0.28), vec3(1.0, 0.93, 0.78), L * L);
    vec3 e = colL * lum * (1.0 - dayF) * mix(0.35, 1.0, limbFade);
    outColor = vec4(e * cov, 1.0);
    return;
  }

  // ---- Surface ----------------------------------------------------------
  vec3 day = textureGrad(uDay, uv, dx, dy).rgb;
  float land = textureGrad(uMask, uv, dx, dy).r;
  float lum = dot(day, vec3(0.299, 0.587, 0.114));

  // Bump from the pre-differentiated elevation map (RG = d/du, d/dv, biased by 0.5).
  vec2 hg = (textureGrad(uTopo, uv, dx, dy).rg - 0.5) * 2.0;
  float hx = hg.x;
  float hy = hg.y;
  vec3 E = normalize(vec3(-w.y, w.x, 1e-5));
  vec3 N = cross(w, E);
  float cl = max(cos(lat), 0.15);
  vec3 wb = normalize(w - 7.0 * (hx / cl * E - hy * N) * land);
  vec3 nb = transpose(uView) * wb;

  // Night side: cool moonlight, relief picked out by the bump.
  vec3 moonDir = normalize(vec3(-0.50, 0.58, 0.64));
  float relief = dot(nb, moonDir) - dot(n, moonDir);
  vec3 moonTint = vec3(0.26, 0.38, 0.66);
  vec3 landNight = moonTint * (0.10 + 0.60 * lum) * 0.80 + day * vec3(0.05, 0.045, 0.035);
  landNight *= clamp(1.0 + 1.7 * relief, 0.62, 1.55);
  vec3 seaNight = vec3(0.007, 0.017, 0.042) + day * vec3(0.03, 0.05, 0.09);
  vec3 night = mix(seaNight, landNight, land);
  night *= mix(0.42, 1.0, pow(cosV, 0.55));          // limb darkening

  // Day side (only a crescent is ever visible).
  float ndl = max(dot(nb, uSun), 0.0);
  vec3 dayCol = day * (0.22 + 1.05 * ndl);
  vec3 Rv = reflect(-uSun, n);
  float spec = pow(max(dot(Rv, V), 0.0), 36.0) * (1.0 - land) * 0.55;
  dayCol += vec3(1.0, 0.92, 0.80) * spec;
  dayCol = mix(dayCol, vec3(0.30, 0.52, 0.95), 0.18);  // air light

  vec3 col = mix(night, dayCol, dayF);

  // Coastline: a crisp isoline of the land mask, with a faint wider glow.
  float fw = max(fwidth(land), 1e-4);
  float dEdge = abs(land - 0.5) / fw;
  float coastLine = 1.0 - smoothstep(0.35, 1.15, dEdge);
  float coastGlow = 1.0 - smoothstep(0.0, 4.5, dEdge);
  col += vec3(0.42, 0.56, 0.86) * (coastLine * 0.34 + coastGlow * 0.07) * (1.0 - 0.6 * dayF) * mix(0.3, 1.0, limbFade);

  // Terminator: a warm band of first light.
  float band = exp(-pow((sunDot - 0.03) / 0.085, 2.0));
  col += vec3(1.0, 0.42, 0.14) * band * 0.10 * (0.4 + 0.6 * land);

  // Atmosphere seen against the planet (fresnel rim).
  float rim = pow(1.0 - cosV, 3.2);
  col += airBlue * rim * (0.10 + 0.95 * dayF);
  col += airBlue * pow(1.0 - cosV, 8.0) * 0.35 * (0.2 + sunSide);

  // Fine dither so the dark gradients never band.
  col += (hash(gl_FragCoord.xy + fract(uYear) * 7.0) - 0.5) / 255.0;

  vec3 outside = haloCol;
  outColor = vec4(mix(outside, col, cov), cov);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + url));
    img.src = url;
  });
}

// Years in which each region's lights begin / finish switching on.
const REGION_YEARS = {
  WEU: [1765, 1925],
  NAM: [1805, 1950],
  EEU: [1830, 1960],
  JPN: [1868, 1950],
  OCE: [1840, 1965],
  LAT: [1850, 1990],
  MEN: [1870, 2000],
  EAS: [1880, 2008],
  SAS: [1880, 2012],
  SEA: [1890, 2012],
  SSA: [1900, 2020],
};

const REGION_BY_NAME = {
  WEU: ['United Kingdom', 'Ireland', 'France', 'Belgium', 'Netherlands', 'Luxembourg', 'Germany', 'Switzerland',
    'Austria', 'Italy', 'Spain', 'Portugal', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Czechia'],
  NAM: ['United States of America', 'Canada'],
  JPN: ['Japan'],
  OCE: ['Australia', 'New Zealand'],
  EEU: ['Russia', 'Poland', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Serbia', 'Croatia', 'Slovenia',
    'Bosnia and Herz.', 'Montenegro', 'North Macedonia', 'Macedonia', 'Albania', 'Kosovo', 'Estonia', 'Latvia',
    'Lithuania', 'Belarus', 'Ukraine', 'Moldova', 'Cyprus', 'Kazakhstan', 'Georgia', 'Armenia', 'Azerbaijan'],
  EAS: ['China', 'South Korea', 'North Korea', 'Taiwan', 'Mongolia'],
  SAS: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Afghanistan'],
  SEA: ['Indonesia', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Myanmar', 'Cambodia', 'Laos', 'Brunei',
    'Timor-Leste', 'Papua New Guinea'],
  MEN: ['Turkey', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Israel', 'Palestine', 'Jordan', 'Saudi Arabia', 'Yemen',
    'Oman', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco',
    'W. Sahara', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'],
};
const NAME_TO_REGION = {};
for (const [r, names] of Object.entries(REGION_BY_NAME)) for (const n of names) NAME_TO_REGION[n] = r;

function regionFor(name, lon, lat) {
  if (NAME_TO_REGION[name]) return NAME_TO_REGION[name];
  if (lon < -30) return 'LAT';
  if (lon > 110 && lat < 0) return 'OCE';
  if (lon >= -20 && lon <= 52 && lat < 20) return 'SSA';
  if (lon >= -11 && lon < 30 && lat > 35) return 'WEU';
  return 'SSA';
}

/**
 * Build the lights texture: R = brightness from NASA's night image,
 * G = ignition year (1700..2100) derived from region and brightness.
 */
function buildLights(nightImg, countries, d3) {
  const LW = 4096;
  const LH = 2048;
  const nc = new OffscreenCanvas(LW, LH);
  const nx = nc.getContext('2d', { willReadFrequently: true });
  nx.drawImage(nightImg, 0, 0, LW, LH);
  const nd = nx.getImageData(0, 0, LW, LH).data;

  // Region map (equirectangular), drawn fat so coastal cities stay inside.
  const RW = 1024;
  const RH = 512;
  const rc = new OffscreenCanvas(RW, RH);
  const rx = rc.getContext('2d', { willReadFrequently: true });
  const enc = (y) => Math.round(((y - 1700) / 400) * 255);
  const def = REGION_YEARS.SSA;
  rx.fillStyle = `rgb(${enc(def[0])},${enc(def[1])},0)`;
  rx.fillRect(0, 0, RW, RH);
  const proj = d3.geoEquirectangular().scale(RW / (2 * Math.PI)).translate([RW / 2, RH / 2]);
  const path = d3.geoPath(proj, rx);
  const styled = countries.features.map((f) => {
    const [lon, lat] = d3.geoCentroid(f);
    const yrs = REGION_YEARS[regionFor(f.properties.name, lon, lat)];
    return { f, css: `rgb(${enc(yrs[0])},${enc(yrs[1])},0)` };
  });
  rx.lineJoin = 'round';
  rx.lineWidth = 9;
  for (const s of styled) { rx.strokeStyle = s.css; rx.beginPath(); path(s.f); rx.stroke(); }
  for (const s of styled) { rx.fillStyle = s.css; rx.beginPath(); path(s.f); rx.fill(); }
  const up = new OffscreenCanvas(LW, LH);
  const ux = up.getContext('2d', { willReadFrequently: true });
  ux.imageSmoothingEnabled = true;
  ux.drawImage(rc, 0, 0, LW, LH);
  const rd = ux.getImageData(0, 0, LW, LH).data;

  const out = new Uint8Array(LW * LH * 4);
  let seed = 1234567;
  for (let i = 0, p = 0; i < LW * LH; i++, p += 4) {
    // In NASA's composite only artificial light is red-bright.
    let L = (nd[p] / 255 - 0.085) / 0.36;
    L = L < 0 ? 0 : L > 1 ? 1 : L;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296;
    const y0 = 1700 + (rd[p] / 255) * 400;
    const y1 = 1700 + (rd[p + 1] / 255) * 400;
    let u = 1 - Math.pow(L, 1.15) + (noise - 0.5) * 0.3 - 0.04;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ig = y0 + (y1 - y0) * u;
    out[p] = Math.round(L * 255);
    out[p + 1] = Math.max(0, Math.min(255, Math.round(((ig - 1700) / 400) * 255)));
    out[p + 3] = 255;
  }
  return { data: out, width: LW, height: LH };
}

/** Elevation -> texture-space gradient (R = d/du, G = d/dv), so the shader needs one fetch. */
function buildReliefGradient(topoImg) {
  const w = topoImg.width;
  const h = topoImg.height;
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(topoImg, 0, 0);
  const src = x.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  const at = (i, j) => src[(Math.max(0, Math.min(h - 1, j)) * w + ((i + w) % w)) * 4];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = (j * w + i) * 4;
      out[p] = Math.max(0, Math.min(255, 127.5 + (at(i + 1, j) - at(i - 1, j)) * 0.5));
      out[p + 1] = Math.max(0, Math.min(255, 127.5 + (at(i, j + 1) - at(i, j - 1)) * 0.5));
      out[p + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

function buildLandMask(land, d3, size) {
  const c = new OffscreenCanvas(size, size / 2);
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size / 2);
  const proj = d3.geoEquirectangular().scale(size / (2 * Math.PI)).translate([size / 2, size / 4]);
  const path = d3.geoPath(proj, x);
  x.fillStyle = '#fff';
  x.beginPath();
  path(land);
  x.fill();
  return c;
}

export async function createEarth(W, H, { d3, land, countries, texBase }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('WebGL2 unavailable');

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  function texture(unit, source, { width, height, data } = {}) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  const [dayImg, topoImg, nightImg] = await Promise.all([
    loadImage(texBase + 'earth-blue-marble.jpg'),
    loadImage(texBase + 'earth-topology.png'),
    loadImage(texBase + 'earth-night.jpg'),
  ]);

  texture(0, dayImg);
  texture(1, null, buildReliefGradient(topoImg));
  texture(2, buildLandMask(land, d3, Math.min(8192, maxTex)));
  const lights = buildLights(nightImg, countries, d3);
  texture(3, null, lights);

  const U = {};
  for (const name of ['uRes', 'uCenter', 'uScale', 'uP', 'uView', 'uSun', 'uYear', 'uLights', 'uDawn', 'uMode',
    'uDay', 'uTopo', 'uMask', 'uNight']) {
    U[name] = gl.getUniformLocation(prog, name);
  }
  gl.uniform1i(U.uDay, 0);
  gl.uniform1i(U.uTopo, 1);
  gl.uniform1i(U.uMask, 2);
  gl.uniform1i(U.uNight, 3);
  gl.uniform2f(U.uRes, W, H);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  /**
   * cam: { lon, lat, P, s, cx, cy }  (degrees, radii, px/unit, px)
   * opts: { mode, year, lights, sun:[x,y,z], dawn }
   */
  function render(cam, opts) {
    const l = cam.lon * D2R;
    const p = cam.lat * D2R;
    const sl = Math.sin(l), cl = Math.cos(l), sp = Math.sin(p), cp = Math.cos(p);
    // Column-major mat3 with columns east, north, out.
    const m = new Float32Array([
      -sl, cl, 0,
      -sp * cl, -sp * sl, cp,
      cp * cl, cp * sl, sp,
    ]);
    gl.uniformMatrix3fv(U.uView, false, m);
    gl.uniform2f(U.uCenter, cam.cx, cam.cy);
    gl.uniform1f(U.uScale, cam.s);
    gl.uniform1f(U.uP, cam.P);
    const s = opts.sun;
    const sn = Math.hypot(s[0], s[1], s[2]);
    gl.uniform3f(U.uSun, s[0] / sn, s[1] / sn, s[2] / sn);
    gl.uniform1f(U.uYear, opts.year);
    gl.uniform1f(U.uLights, opts.lights);
    gl.uniform1f(U.uDawn, opts.dawn || 0);
    gl.uniform1i(U.uMode, opts.mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { canvas, render };
}
