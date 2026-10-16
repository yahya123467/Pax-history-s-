/**
 * Builds the game's province layer from Natural Earth admin-0 (1:110m) countries.
 *
 *   npm run geo
 *
 * Outputs (both are committed, so the game works offline):
 *   client/public/geo/provinces.geojson  — slim geometry for the map (id + name only)
 *   server/data/provinces.json           — id, name, centroid, neighbours (for rules + prompts)
 *
 * Design decision: v1 uses modern admin-0 countries as "provinces". A scenario then
 * assigns each one to a historical owner (e.g. Czechia + Slovakia -> Czechoslovakia).
 * One historical split is carved out by hand: Russia's Kaliningrad exclave becomes
 * "East Prussia" so Germany's 1936 borders are recognisable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Ring = [number, number][];
type Polygon = Ring[];
interface Feature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const cacheFile = path.join(root, 'server/data/.cache/ne_110m_admin_0_countries.geojson');
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const NAME_FIXES: Record<string, string> = {
  'Bosnia and Herz.': 'Bosnia',
  'Dem. Rep. Congo': 'Congo (Kinshasa)',
  Congo: 'Congo (Brazzaville)',
  'Central African Rep.': 'Central Africa',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Fr. S. Antarctic Lands': 'Kerguelen',
  'Falkland Is.': 'Falkland Islands',
  'Solomon Is.': 'Solomon Islands',
  'W. Sahara': 'Western Sahara',
  'S. Sudan': 'South Sudan',
  'N. Cyprus': 'Northern Cyprus',
  'United States of America': 'United States',
  Czechia: 'Bohemia-Moravia',
};

async function loadSource(): Promise<{ features: Feature[] }> {
  if (!fs.existsSync(cacheFile)) {
    console.log(`Downloading ${SOURCE_URL}`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, await res.text());
  }
  return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const roundPoly = (p: Polygon): Polygon => p.map((ring) => ring.map(([x, y]) => [round(x), round(y)] as [number, number]));

function polygonsOf(f: Feature): Polygon[] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** Area-weighted centroid of the largest polygon (good enough for label placement). */
function centroid(polys: Polygon[]): [number, number] {
  const biggest = polys.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best));
  const ring = biggest[0];
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (a === 0) return ring[0];
  return [round(x / (3 * a)), round(y / (3 * a))];
}

function isKaliningrad(p: Polygon) {
  const [x, y] = centroid([p]);
  return x > 19 && x < 23 && y > 54 && y < 55.6;
}

async function main() {
  const src = await loadSource();
  const out: { id: string; name: string; polys: Polygon[] }[] = [];

  for (const f of src.features) {
    const id = String(f.properties.ADM0_A3);
    if (id === 'ATA') continue; // Antarctica: nobody's playing for it in 1936
    const rawName = String(f.properties.NAME);
    const name = NAME_FIXES[rawName] ?? rawName;
    let polys = polygonsOf(f).map(roundPoly);
    if (id === 'RUS') {
      const kal = polys.filter(isKaliningrad);
      polys = polys.filter((p) => !isKaliningrad(p));
      if (kal.length) out.push({ id: 'EPR', name: 'East Prussia', polys: kal });
    }
    out.push({ id, name, polys });
  }

  // Adjacency: two provinces border each other if they share a vertex. Natural Earth
  // shares border vertices exactly between neighbours, so this is cheap and reliable.
  const vertexOwners = new Map<string, Set<string>>();
  for (const p of out)
    for (const poly of p.polys)
      for (const ring of poly)
        for (const [x, y] of ring) {
          const k = `${x},${y}`;
          if (!vertexOwners.has(k)) vertexOwners.set(k, new Set());
          vertexOwners.get(k)!.add(p.id);
        }
  const neighbours = new Map<string, Set<string>>(out.map((p) => [p.id, new Set()]));
  for (const owners of vertexOwners.values())
    if (owners.size > 1) for (const a of owners) for (const b of owners) if (a !== b) neighbours.get(a)!.add(b);

  const geojson = {
    type: 'FeatureCollection',
    features: out.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, name: p.name },
      geometry: p.polys.length === 1 ? { type: 'Polygon', coordinates: p.polys[0] } : { type: 'MultiPolygon', coordinates: p.polys },
    })),
  };
  const meta = out
    .map((p) => ({ id: p.id, name: p.name, centroid: centroid(p.polys), neighbours: [...neighbours.get(p.id)!].sort() }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const geoOut = path.join(root, 'client/public/geo/provinces.geojson');
  const metaOut = path.join(root, 'server/data/provinces.json');
  fs.mkdirSync(path.dirname(geoOut), { recursive: true });
  fs.writeFileSync(geoOut, JSON.stringify(geojson));
  fs.writeFileSync(metaOut, JSON.stringify(meta, null, 1));
  console.log(`Wrote ${out.length} provinces -> ${path.relative(root, geoOut)}, ${path.relative(root, metaOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
