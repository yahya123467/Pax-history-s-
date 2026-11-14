// One-off converter: Natural Earth 1:50m river centerlines (public domain) -> compact JSON.
// Source: https://github.com/nvkelso/natural-earth-vector  (geojson/ne_50m_rivers_lake_centerlines.geojson)
// Usage: node scripts/build-rivers.mjs <path-to-geojson>
import fs from 'node:fs';
const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-rivers.mjs <ne_50m_rivers_lake_centerlines.geojson>'); process.exit(1); }
const gj = JSON.parse(fs.readFileSync(src, 'utf8'));
const out = [];
for (const f of gj.features) {
  if (!f.geometry) continue;
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const line of lines) {
    const c = [];
    let last = null;
    for (const [x, y] of line) {
      const p = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
      if (last && last[0] === p[0] && last[1] === p[1]) continue;
      c.push(p); last = p;
    }
    if (c.length > 1) out.push({ n: f.properties.name || '', r: f.properties.scalerank, c });
  }
}
fs.writeFileSync(new URL('../film/data/rivers.json', import.meta.url), JSON.stringify(out));
console.log('rivers:', out.length, 'lines');
