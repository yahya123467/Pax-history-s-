// Small math + geometry helpers shared by the film modules.

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutQuart = (t) => 1 - Math.pow(1 - clamp(t), 4);
export const easeInOutCubic = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

/** Fade envelope: 0 → 1 over [t0, t0+fin], hold, 1 → 0 over [t1-fout, t1]. */
export const envelope = (t, t0, t1, fin = 0.4, fout = 0.4) =>
  smoothstep(t0, t0 + fin, t) * (1 - smoothstep(t1 - fout, t1, t));

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monotone cubic (PCHIP) interpolation through (xs, ys).
 * No overshoot, eases to rest at local extrema — ideal for camera moves.
 */
export function pchip(xs, ys) {
  const n = xs.length;
  const h = new Array(n - 1);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

/** Unit vector for a lon/lat in degrees (x→lon 0, y→lon 90E, z→north pole). */
export function lonLatToVec(lon, lat) {
  const l = lon * D2R;
  const p = lat * D2R;
  const c = Math.cos(p);
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
}

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Angle between two unit vectors, radians. */
export const angleBetween = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));

/** Spherical interpolation between unit vectors. */
export function slerp(a, b, f) {
  const w = angleBetween(a, b);
  if (w < 1e-6) return a.slice();
  const s = Math.sin(w);
  const ka = Math.sin((1 - f) * w) / s;
  const kb = Math.sin(f * w) / s;
  return [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]];
}

/**
 * Smooth a polyline of [lon, lat] waypoints with a Catmull-Rom spline (it still
 * passes through every waypoint). Longitudes are unwrapped across the antimeridian.
 */
export function smoothPath(waypoints, perSeg = 10) {
  const p = waypoints.map((w) => w.slice());
  for (let i = 1; i < p.length; i++) {
    while (p[i][0] - p[i - 1][0] > 180) p[i][0] -= 360;
    while (p[i][0] - p[i - 1][0] < -180) p[i][0] += 360;
  }
  const out = [];
  const at = (i) => p[Math.max(0, Math.min(p.length - 1, i))];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

/**
 * Densely sample a polyline of [lon, lat] waypoints along great circles.
 * Returns { pts: Float32Array(xyz…), len: Float32Array(cumulative radians), total, n }.
 */
export function sampleRoute(waypoints, stepDeg = 0.6) {
  const vs = waypoints.map(([lon, lat]) => lonLatToVec(lon, lat));
  const pts = [];
  const len = [];
  let total = 0;
  for (let i = 0; i < vs.length - 1; i++) {
    const a = vs[i];
    const b = vs[i + 1];
    const w = angleBetween(a, b);
    const n = Math.max(1, Math.ceil((w * R2D) / stepDeg));
    for (let j = i === 0 ? 0 : 1; j <= n; j++) {
      const v = slerp(a, b, j / n);
      pts.push(v[0], v[1], v[2]);
      len.push(total + (w * j) / n);
    }
    total += w;
  }
  return { pts: new Float32Array(pts), len: new Float32Array(len), total, n: len.length };
}
