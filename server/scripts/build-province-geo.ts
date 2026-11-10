/**
 * Derives military geography from the client's province GeoJSON:
 *  - area (km²) of each province: bigger provinces take longer to occupy;
 *  - "near": shortest border-to-border distance (km) between provinces that are within
 *    1,500 km of each other. Used for air-wing range, so that a huge province like Russia
 *    is measured from its border, not its centroid;
 *  - "sea": shortest coast-to-coast distance (km, ≤ 600). A vertex is "coastal" when no other
 *    province has a vertex within a few km of it (i.e. it isn't on a land border), so
 *    landlocked provinces get no sea links. Used for naval landings.
 * Output: server/data/province-geo.json. Run with `npm run province-geo -w server`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Ring = number[][];
interface Feature { properties: { id: string }; geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } }
const here = path.dirname(fileURLToPath(import.meta.url));
const geo = JSON.parse(fs.readFileSync(path.resolve(here, '../../client/public/geo/provinces.geojson'), 'utf8')) as { features: Feature[] };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
function ringArea(ring: Ring): number {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    total += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs((total * R * R) / 2);
}
function km(a: number[], b: number[]): number {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const MAX_KM = 1500;
const areas: Record<string, number> = {};
const pts: { id: string; v: number[][]; box: [number, number, number, number] }[] = [];
for (const f of geo.features) {
  const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let area = 0;
  const v: number[][] = [];
  for (const poly of polys) {
    area += ringArea(poly[0]) - poly.slice(1).reduce((a, h) => a + ringArea(h), 0);
    v.push(...poly[0]);
  }
  areas[f.properties.id] = Math.round(area);
  const xs = v.map((p) => p[0]), ys = v.map((p) => p[1]);
  pts.push({ id: f.properties.id, v, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
}

// Coastline = ring edges not shared with another province. Coastal points are the
// endpoints and midpoints of those edges, so even a one-segment coast (Belgium) counts.
const rings = new Map<string, Ring[]>();
for (const f of geo.features) {
  const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  rings.set(f.properties.id, polys.map((p) => p[0]));
}
const key = (p: number[]) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
const edgeKey = (a: number[], b: number[]) => [key(a), key(b)].sort().join('|');
const edgeCount = new Map<string, number>();
for (const rs of rings.values()) for (const r of rs) for (let i = 0; i < r.length - 1; i++) {
  const k = edgeKey(r[i], r[i + 1]);
  edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
}
const coastal = new Map<string, number[][]>();
for (const [id, rs] of rings) {
  const out: number[][] = [];
  for (const r of rs) for (let i = 0; i < r.length - 1; i++) {
    if ((edgeCount.get(edgeKey(r[i], r[i + 1])) ?? 0) > 1) continue;
    out.push(r[i], r[i + 1], [(r[i][0] + r[i + 1][0]) / 2, (r[i][1] + r[i + 1][1]) / 2]);
  }
  coastal.set(id, out);
}

const near: Record<string, Record<string, number>> = {};
const sea: Record<string, Record<string, number>> = {};
const SEA_KM = 600;
const margin = MAX_KM / 80; // degrees, generous
for (let i = 0; i < pts.length; i++) {
  for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    if (a.box[0] - margin > b.box[2] || b.box[0] - margin > a.box[2] || a.box[1] - margin > b.box[3] || b.box[1] - margin > a.box[3]) continue;
    let best = Infinity;
    for (const p of a.v) for (const q of b.v) {
      if (Math.abs(p[1] - q[1]) > margin) continue;
      const d = km(p, q);
      if (d < best) best = d;
    }
    if (best <= MAX_KM) {
      (near[a.id] ??= {})[b.id] = Math.round(best);
      (near[b.id] ??= {})[a.id] = Math.round(best);
    }
    if (best <= SEA_KM) {
      let s = Infinity;
      for (const p of coastal.get(a.id)!) for (const q of coastal.get(b.id)!) {
        if (Math.abs(p[1] - q[1]) > 6) continue;
        const d = km(p, q);
        if (d < s) s = d;
      }
      if (s <= SEA_KM) {
        (sea[a.id] ??= {})[b.id] = Math.round(s);
        (sea[b.id] ??= {})[a.id] = Math.round(s);
      }
    }
  }
}
fs.writeFileSync(path.resolve(here, '../data/province-geo.json'), JSON.stringify({ areas, near, sea }) + '\n');
const landlocked = pts.filter((p) => coastal.get(p.id)!.length === 0).map((p) => p.id);
console.log(`areas: ${Object.keys(areas).length}; sea CHN-TWN ${sea.CHN?.TWN} km, GBR-FRA ${sea.GBR?.FRA}, JPN-KOR ${sea.JPN?.KOR}, TZA-ZWE ${sea.TZA?.ZWE}, CUB-USA ${sea.CUB?.USA}`);
console.log(`no coast (${landlocked.length}): ${landlocked.join(' ')}`);
for (const id of ['ZWE', 'CHE', 'AUT', 'MLI', 'BOL', 'UKR', 'POL', 'TWN']) console.log(id, coastal.get(id)!.length, '/', pts.find((p) => p.id === id)!.v.length);
