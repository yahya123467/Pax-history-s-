/**
 * World map (MapLibre GL, no basemap tiles — just our province polygons).
 *
 * Design decisions:
 * - The GeoJSON is static and loaded once; ownership changes only rewrite the
 *   `fill-color` match expression, so a redraw after a turn is instant.
 * - Nation labels are HTML markers rather than a symbol layer, so the map needs no
 *   external glyph server and works fully offline.
 */
import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// maplibre v6 runs its tile worker from a separate, self-contained module; Vite's dep
// pre-bundling would break its relative URL, so we hand it an explicit asset URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState } from 'react';
import type { WorldState } from '../../../shared/types';

interface Props {
  state: WorldState;
  selected: string | null;
  onSelect: (provinceId: string | null) => void;
}

maplibregl.setWorkerUrl(workerUrl);

type Geo = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { id: string; name: string }>;

/** Label anchor per province: centroid of its largest polygon, plus that polygon's area for ranking. */
function labelPoints(geo: Geo): Map<string, { at: [number, number]; area: number }> {
  const out = new Map<string, { at: [number, number]; area: number }>();
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = { at: [0, 0] as [number, number], area: -1 };
    for (const poly of polys) {
      const ring = poly[0];
      let a = 0, x = 0, y = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const k = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        a += k; x += (ring[j][0] + ring[i][0]) * k; y += (ring[j][1] + ring[i][1]) * k;
      }
      if (Math.abs(a) > best.area && a !== 0) best = { at: [x / (3 * a), y / (3 * a)], area: Math.abs(a) };
    }
    out.set(f.properties.id, best);
  }
  return out;
}

function colorExpression(state: WorldState): ExpressionSpecification {
  const pairs: string[] = [];
  for (const p of Object.values(state.provinces)) pairs.push(p.id, state.nations[p.owner]?.color ?? '#333');
  return ['match', ['get', 'id'], ...pairs, '#2a2f36'] as unknown as ExpressionSpecification;
}

export function MapView({ state, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; id: string } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'sea', type: 'background', paint: { 'background-color': '#0d1b2a' } }],
      },
      center: [15, 49],
      zoom: 3.3,
      minZoom: 1.2,
      maxZoom: 8,
      renderWorldCopies: false,
      dragRotate: false,
      attributionControl: { compact: true, customAttribution: 'Borders: Natural Earth' },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    map.on('load', async () => {
      const data: Geo = await fetch('/geo/provinces.geojson').then((r) => r.json());
      map.addSource('provinces', { type: 'geojson', data, promoteId: 'id' });
      map.addLayer({
        id: 'province-fill',
        type: 'fill',
        source: 'provinces',
        paint: {
          'fill-color': '#2a2f36',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.86],
        },
      });
      map.addLayer({
        id: 'province-line',
        type: 'line',
        source: 'provinces',
        paint: { 'line-color': '#0d1b2a', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 1.4] },
      });
      map.addLayer({
        id: 'player-line',
        type: 'line',
        source: 'provinces',
        filter: ['in', ['get', 'id'], ['literal', []]],
        paint: { 'line-color': '#f2c14e', 'line-width': 1.2, 'line-opacity': 0.8 },
      });
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'provinces',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': '#ffffff', 'line-width': 2.5 },
      });

      let hoverId: string | null = null;
      map.on('mousemove', 'province-fill', (e) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (!f) return;
        const id = String(f.properties.id);
        if (hoverId && hoverId !== id) map.setFeatureState({ source: 'provinces', id: hoverId }, { hover: false });
        hoverId = id;
        map.setFeatureState({ source: 'provinces', id }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
        setHover({ x: e.point.x, y: e.point.y, id });
      });
      map.on('mouseleave', 'province-fill', () => {
        if (hoverId) map.setFeatureState({ source: 'provinces', id: hoverId }, { hover: false });
        hoverId = null;
        map.getCanvas().style.cursor = '';
        setHover(null);
      });
      map.on('click', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['province-fill'] })[0];
        onSelectRef.current(f ? String(f.properties.id) : null);
      });
      const zoomClass = () => container.current?.classList.toggle('zoomed', map.getZoom() >= 4.3);
      map.on('zoom', zoomClass);
      zoomClass();

      setGeo(data);
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Recolour + relabel whenever ownership changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;
    map.setPaintProperty('province-fill', 'fill-color', colorExpression(state));
    const mine = Object.values(state.provinces).filter((p) => p.owner === state.playerNation).map((p) => p.id);
    map.setFilter('player-line', ['in', ['get', 'id'], ['literal', mine]]);

    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const points = labelPoints(geo);
    for (const n of Object.values(state.nations)) {
      if (!n.alive) continue;
      const owned = Object.values(state.provinces).filter((p) => p.owner === n.id);
      const anchor = owned.find((p) => p.id === n.capital) ?? owned.sort((a, b) => (points.get(b.id)?.area ?? 0) - (points.get(a.id)?.area ?? 0))[0];
      const pt = anchor && points.get(anchor.id);
      if (!pt) continue;
      const el = document.createElement('div');
      el.className = `nation-label ${n.minor ? 'minor' : 'major'}${n.id === state.playerNation ? ' player' : ''}`;
      el.textContent = n.name;
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat(pt.at).addTo(map));
    }
  }, [state.provinces, state.nations, state.playerNation, ready, geo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('selected-line', ['==', ['get', 'id'], selected ?? '']);
  }, [selected, ready]);

  const hoverProv = hover ? state.provinces[hover.id] : null;
  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      {hoverProv && (
        <div className="map-tooltip" style={{ left: hover!.x + 14, top: hover!.y + 14 }}>
          <strong>{hoverProv.name}</strong>
          <span>
            <i className="swatch" style={{ background: state.nations[hoverProv.owner]?.color }} />
            {state.nations[hoverProv.owner]?.name}
          </span>
        </div>
      )}
      {!ready && <div className="map-loading">Loading map…</div>}
    </div>
  );
}
