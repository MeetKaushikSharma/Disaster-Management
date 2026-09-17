/**
 * ZoneMap — Leaflet map with polygon draw and circle (radius) draw tools.
 *
 * FIXES applied:
 * 1. leaflet-draw CSS loaded via CDN in index.html (not bundled via Vite — avoids broken icons)
 * 2. onZoneChange passed correctly via stable ref to avoid stale closure in L.Draw event handler
 * 3. drawControlRef reinit only when map is ready (avoids race on first render)
 * 4. Both polygon and circle draw shapes now use proper Leaflet-draw options
 * 5. Robust ring-closing logic for polygon coordinates
 */
import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import type { ZoneType } from '../types';

// Fix Leaflet's missing default marker icon in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface ZoneData {
  zoneType: ZoneType;
  polygon?: { type: 'Polygon'; coordinates: [number, number][][] };
  centre?: { type: 'Point'; coordinates: [number, number] };
  radiusKm?: number;
}

interface Props {
  zoneType: ZoneType;
  onZoneChange: (data: ZoneData | null) => void;
}

export default function ZoneMap({ zoneType, onZoneChange }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const drawnLayersRef  = useRef<L.FeatureGroup | null>(null);
  const drawControlRef  = useRef<L.Control.Draw | null>(null);
  // Stable ref to the latest onZoneChange callback — avoids stale closure in event listeners
  const onZoneChangeRef = useRef(onZoneChange);
  useEffect(() => { onZoneChangeRef.current = onZoneChange; });

  // ── Helper: install a fresh draw control ────────────────────────────────────
  const installDrawControl = useCallback((map: L.Map, drawnItems: L.FeatureGroup, type: ZoneType) => {
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }
    drawnItems.clearLayers();
    onZoneChangeRef.current(null);

    const drawOptions: L.Control.DrawConstructorOptions = {
      position: 'topleft',
      edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: true,
      },
      draw: {
        polygon: type === 'polygon' ? {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#000000',
            weight: 2.5,
            fillOpacity: 0.15,
            fillColor: '#000000',
          },
        } : false,
        circle: type === 'radius' ? {
          shapeOptions: {
            color: '#000000',
            weight: 2.5,
            fillOpacity: 0.15,
            fillColor: '#000000',
          },
          showRadius: true,
          metric: true,
          feet: false,
        } : false,
        rectangle: false,
        polyline: false,
        marker: false,
        circlemarker: false,
      } as any,
    };

    const control = new L.Control.Draw(drawOptions);
    map.addControl(control);
    drawControlRef.current = control;
  }, []);

  // ── Initialise map once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629], // Geographic centre of India
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    mapRef.current = map;
    drawnLayersRef.current = drawnItems;

    // ── Draw created handler ─────────────────────────────────────────────────
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      if (layer instanceof L.Circle) {
        const centre = layer.getLatLng();
        const radiusM = layer.getRadius();
        onZoneChangeRef.current({
          zoneType: 'radius',
          centre: { type: 'Point', coordinates: [centre.lng, centre.lat] },
          radiusKm: parseFloat((radiusM / 1000).toFixed(3)),
        });
      } else if (layer instanceof L.Polygon) {
        // Polygon.getLatLngs() returns LatLng[][] — we only need the outer ring
        const outer = (layer.getLatLngs() as L.LatLng[][])[0];
        if (!outer || outer.length < 3) {
          onZoneChangeRef.current(null);
          return;
        }
        const coords: [number, number][] = outer.map(ll => [ll.lng, ll.lat]);
        // GeoJSON requires the ring to be explicitly closed (first === last point)
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        onZoneChangeRef.current({
          zoneType: 'polygon',
          polygon: { type: 'Polygon', coordinates: [coords] },
        });
      }
    });

    // ── Draw deleted handler ─────────────────────────────────────────────────
    map.on(L.Draw.Event.DELETED, () => {
      onZoneChangeRef.current(null);
    });

    // Install initial draw control
    installDrawControl(map, drawnItems, 'polygon');

    return () => {
      map.remove();
      mapRef.current = null;
      drawnLayersRef.current = null;
      drawControlRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swap draw control when zoneType prop changes ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnLayersRef.current;
    if (!map || !drawnItems) return;
    installDrawControl(map, drawnItems, zoneType);
  }, [zoneType, installDrawControl]);

  return (
    <div className="map-container">
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
