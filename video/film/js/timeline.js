// Time ↔ year ↔ population. Pure functions shared by the renderer and the
// cue exporter that drives the score.

import { pchip, lerp } from './util.js';
import { YEAR_KEYS, POPULATION, TODAY_T } from './script.js';

export const yearAt = pchip(YEAR_KEYS.map((k) => k[0]), YEAR_KEYS.map((k) => k[1]));

/** Film time (s) at which the counter reaches a given year. */
export function tOfYear(y) {
  let lo = 6;
  let hi = TODAY_T;
  if (y <= yearAt(lo)) return lo;
  if (y >= yearAt(hi)) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (yearAt(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** World population estimate in millions (log-interpolated). */
export function popAt(year) {
  const P = POPULATION;
  if (year <= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++) {
    if (year <= P[i + 1][0]) {
      const f = (year - P[i][0]) / (P[i + 1][0] - P[i][0]);
      return Math.exp(lerp(Math.log(P[i][1]), Math.log(P[i + 1][1]), f));
    }
  }
  return P[P.length - 1][1];
}

/** Film time at which the estimate passes one billion people. */
export const BILLION_T = (() => {
  let lo = 1700;
  let hi = 1850;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (popAt(m) < 1000) lo = m;
    else hi = m;
  }
  return tOfYear((lo + hi) / 2);
})();
