// Export timing cues from the film script so the score can hit them exactly.
//   node scripts/cues.mjs  ->  out/cues.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './server.mjs';
import { CITIES } from '../film/js/cities.js';
import { tOfYear, BILLION_T } from '../film/js/timeline.js';

const ignitions = CITIES
  .filter((c) => c[5] >= 2)
  .map(([name, lat, lon, from, , mag]) => ({ name, t: name === 'Uruk' ? 6 : +tOfYear(from).toFixed(3), mag, lon }))
  .sort((a, b) => a.t - b.t);

fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/cues.json'), JSON.stringify({ ignitions, billion: +BILLION_T.toFixed(3) }, null, 1));
console.log('cues:', ignitions.length, 'ignitions; one billion at t =', BILLION_T.toFixed(2));
