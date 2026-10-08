import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  CloudRain,
  Thermometer,
  Wind,
  Waves,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Cpu,
  TrendingUp,
  MapPin,
  ShieldAlert,
  Compass,
  Layers,
} from 'lucide-react';
import {
  getHeatmapGrid,
  getPredictionsForecast,
} from '../api/services';
import type { HeatmapGridPoint, DistrictForecast } from '../types';
import './HeatMapPage.css';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Windy API Access Token provided by user
const WINDY_API_KEY =
  import.meta.env.VITE_WINDY_API_KEY ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfdTkzZGc0dmQiLCJqdGkiOiIzZmVhYWE2OWFiOTczNWFlNTFlZjk0N2U1MGEzOWUxNCJ9.8BaRQCak3VMYT59hiN0Z-D02KGSzCP2kogkcvNGf19I';

const LAYER_CONFIGS = [
  { id: 'wind', label: 'Wind Speed', icon: Wind, unit: 'km/h', min: 0, max: 100, ramp: 'linear-gradient(to right, #10b981, #eab308, #f97316, #ef4444, #831843)', windyOverlay: 'wind' },
  { id: 'rainfall', label: 'Rainfall', icon: CloudRain, unit: 'mm/h', min: 0, max: 80, ramp: 'linear-gradient(to right, #38bdf8, #2563eb, #7c3aed, #ec4899, #ef4444)', windyOverlay: 'rain' },
  { id: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', min: 20, max: 48, ramp: 'linear-gradient(to right, #3b82f6, #06b6d4, #10b981, #f59e0b, #ef4444)', windyOverlay: 'temp' },
  { id: 'river', label: 'River / Waves', icon: Waves, unit: '% cap', min: 0, max: 100, ramp: 'linear-gradient(to right, #10b981, #3b82f6, #eab308, #f97316, #ef4444)', windyOverlay: 'waves' },
  { id: 'risk', label: 'Disaster Risk', icon: AlertTriangle, unit: 'Score', min: 0, max: 100, ramp: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444, #a855f7)', windyOverlay: 'radar' },
];

const TIME_HORIZONS = [
  { id: 'now', label: 'LIVE Now', offset: '0h' },
  { id: '1h', label: '+1 Hour', offset: '1h' },
  { id: '3h', label: '+3 Hours', offset: '3h' },
  { id: '6h', label: '+6 Hours', offset: '6h' },
];

const LAYER_GRADIENTS: Record<string, Record<number, string>> = {
  rainfall: { 0.15: '#38bdf8', 0.35: '#2563eb', 0.6: '#7c3aed', 0.85: '#ec4899', 1.0: '#ef4444' },
  temperature: { 0.2: '#06b6d4', 0.4: '#10b981', 0.65: '#f59e0b', 0.85: '#f97316', 1.0: '#ef4444' },
  wind: { 0.2: '#10b981', 0.4: '#eab308', 0.65: '#f97316', 0.85: '#ef4444', 1.0: '#831843' },
  river: { 0.3: '#3b82f6', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' },
  risk: { 0.25: '#22c55e', 0.5: '#eab308', 0.75: '#f97316', 0.9: '#ef4444', 1.0: '#a855f7' },
};

const STATIONS = [
  { district: 'Delhi', lat: 28.7041, lng: 77.1025, river: 'Yamuna' },
  { district: 'Noida', lat: 28.5355, lng: 77.3910, river: 'Yamuna/Hindon' },
  { district: 'Ghaziabad', lat: 28.6692, lng: 77.4538, river: 'Hindon' },
  { district: 'Faridabad', lat: 28.4089, lng: 77.3178, river: 'Yamuna' },
  { district: 'Gurugram', lat: 28.4595, lng: 77.0266, river: 'Najafgarh' },
  { district: 'Gautam Buddha Nagar', lat: 28.4744, lng: 77.5040, river: 'Yamuna' },
];

// Inner Leaflet component to attach/update the heatLayer in Sensor Grid Mode
function LeafletHeatLayer({
  points,
  layer,
  radius = 32,
  blur = 24,
}: {
  points: HeatmapGridPoint[];
  layer: string;
  radius?: number;
  blur?: number;
}) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    // Format points as [lat, lng, intensity]
    const heatData = points.map((p) => [p.lat, p.lng, Math.max(0.1, p.intensity)]);

    // Remove existing layer if any
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    try {
      const gradient = LAYER_GRADIENTS[layer] || LAYER_GRADIENTS.rainfall;
      const heat = (L as any).heatLayer(heatData, {
        radius,
        blur,
        maxZoom: 14,
        max: 1.0,
        minOpacity: 0.25,
        gradient,
      });

      heat.addTo(map);
      heatLayerRef.current = heat;
    } catch (err) {
      console.error('Failed to create heat layer:', err);
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, layer, radius, blur]);

  return null;
}

export const HeatMapPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'windy' | 'sensor'>('windy');
  const [activeLayer, setActiveLayer] = useState<string>('wind');
  const [activeHorizon, setActiveHorizon] = useState<string>('now');
  const [gridPoints, setGridPoints] = useState<HeatmapGridPoint[]>([]);
  const [forecasts, setForecasts] = useState<DistrictForecast[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>('Delhi');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Load grid points when layer or horizon changes (for sensor grid mode)
  useEffect(() => {
    let isCancelled = false;
    const loadGrid = async () => {
      setIsLoading(true);
      try {
        const res = await getHeatmapGrid(activeLayer, activeHorizon);
        if (!isCancelled && res.data && res.data.points) {
          setGridPoints(res.data.points);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        console.error('Error fetching heatmap grid:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadGrid();
    return () => {
      isCancelled = true;
    };
  }, [activeLayer, activeHorizon]);

  // Load 6-hour ML predictions
  const fetchForecasts = async () => {
    try {
      const res = await getPredictionsForecast();
      if (res.data && res.data.predictions) {
        setForecasts(res.data.predictions);
      }
    } catch (err) {
      console.error('Error fetching predictions forecast:', err);
    }
  };

  useEffect(() => {
    fetchForecasts();
  }, []);

  // Time loop animation player (Windy-style)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveHorizon((prev) => {
        const idx = TIME_HORIZONS.findIndex((h) => h.id === prev);
        const nextIdx = (idx + 1) % TIME_HORIZONS.length;
        return TIME_HORIZONS[nextIdx].id;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeConfig = useMemo(
    () => LAYER_CONFIGS.find((c) => c.id === activeLayer) || LAYER_CONFIGS[0],
    [activeLayer]
  );

  const highestRiskForecast = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;
    return [...forecasts].sort(
      (a, b) => (b.riskScores?.composite || 0) - (a.riskScores?.composite || 0)
    )[0];
  }, [forecasts]);

  const selectedForecast = useMemo(() => {
    if (!selectedDistrict) return null;
    return forecasts.find((f) => f.district === selectedDistrict) || null;
  }, [forecasts, selectedDistrict]);

  const customMarkerIcon = (district: string, riskSev: string) => {
    const color =
      riskSev === 'Emergency'
        ? '#ef4444'
        : riskSev === 'Warning'
        ? '#f59e0b'
        : riskSev === 'Watch'
        ? '#38bdf8'
        : '#10b981';
    return L.divIcon({
      className: 'windy-station-marker',
      html: `
        <div style="background: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 12px ${color};"></div>
        <div class="windy-marker-label">${district}</div>
      `,
      iconSize: [60, 30],
      iconAnchor: [30, 7],
    });
  };

  // Build the dynamic Windy Embed URL utilizing user's API access token & current layer
  const windyEmbedUrl = useMemo(() => {
    const overlay = activeConfig.windyOverlay || 'wind';
    const centerLat = 28.58;
    const centerLon = 77.25;
    const zoom = 10;
    return (
      `https://embed.windy.com/embed2.html?lat=${centerLat}&lon=${centerLon}` +
      `&detailLat=${centerLat}&detailLon=${centerLon}` +
      `&width=100%25&height=100%25&zoom=${zoom}&level=surface` +
      `&overlay=${overlay}&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=` +
      `&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1` +
      `&key=${encodeURIComponent(WINDY_API_KEY)}`
    );
  }, [activeConfig, WINDY_API_KEY]);

  return (
    <div className="windy-page-container">
      {/* Top Floating Glass Header */}
      <div className="windy-top-bar">
        <div className="windy-glass-card windy-title-badge">
          <span className={`windy-badge-pulse ${activeHorizon !== 'now' ? 'predictive' : ''}`} />
          <div className="windy-title-text">
            <h2>
              <ShieldAlert size={20} color="#38bdf8" />
              Windy Early Warning Radar
            </h2>
            <span>
              Delhi-NCR • {activeHorizon === 'now' ? 'Real-Time Sensor Telemetry' : `ML Forecast (${activeHorizon})`} •{' '}
              {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* View Mode Toggle: Windy Live Radar vs AI Sensor Grid */}
        <div className="windy-glass-card windy-mode-toggle-card">
          <button
            className={`windy-mode-pill ${viewMode === 'windy' ? 'active' : ''}`}
            onClick={() => setViewMode('windy')}
            title="Interactive Windy Map with Animated Streamlines & Numerical Weather Overlays"
          >
            <Compass size={15} />
            <span>Windy Live Radar</span>
          </button>
          <button
            className={`windy-mode-pill ${viewMode === 'sensor' ? 'active' : ''}`}
            onClick={() => setViewMode('sensor')}
            title="Dense Spatial Interpolation from Regional Sensor Feeds"
          >
            <Layers size={15} />
            <span>AI Sensor Grid</span>
          </button>
        </div>

        {/* Quick Summary Metrics */}
        <div className="windy-quick-stats">
          <div className="windy-glass-card windy-metric-chip">
            <span className="windy-metric-label">Model Engine</span>
            <span className="windy-metric-val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cpu size={14} /> XGB + LSTM
            </span>
          </div>

          {highestRiskForecast && (
            <div className="windy-glass-card windy-metric-chip">
              <span className="windy-metric-label">Peak Risk District</span>
              <span
                className={`windy-metric-val ${
                  (highestRiskForecast.riskScores?.composite || 0) >= 0.5 ? 'high' : 'warning'
                }`}
              >
                {highestRiskForecast.district} (
                {Math.round((highestRiskForecast.riskScores?.composite || 0) * 100)}%)
              </span>
            </div>
          )}

          <button
            className="windy-glass-card"
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#f1f5f9' }}
            onClick={() => {
              setActiveHorizon('now');
              fetchForecasts();
              setLastRefreshed(new Date());
            }}
            title="Sync Live Telemetry & Predictions"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sync</span>
          </button>
        </div>
      </div>

      {/* Main Map Viewport (Dual-Engine: Windy Radar / Leaflet Sensor Grid) */}
      {viewMode === 'windy' ? (
        <div className="windy-canvas-container">
          <iframe
            src={windyEmbedUrl}
            title="Windy Early Warning Radar Engine"
            className="windy-iframe-viewport"
            frameBorder="0"
          />

          {/* Floating Station Pills over Windy Map Viewport */}
          <div className="windy-station-overlay-bar">
            {STATIONS.map((st) => {
              const fc = forecasts.find((f) => f.district === st.district);
              const score = fc?.riskScores?.composite || 0.05;
              const sev = fc?.predictedSeverity || 'Advisory';
              const isSelected = selectedDistrict === st.district;
              const color =
                sev === 'Emergency'
                  ? '#ef4444'
                  : sev === 'Warning'
                  ? '#f59e0b'
                  : sev === 'Watch'
                  ? '#38bdf8'
                  : '#10b981';

              return (
                <button
                  key={st.district}
                  className={`windy-station-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDistrict(st.district)}
                  style={{ borderColor: isSelected ? color : 'rgba(255,255,255,0.15)' }}
                >
                  <span className="windy-station-dot" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                  <span className="windy-station-name">{st.district}</span>
                  <span className="windy-station-score">{Math.round(score * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <MapContainer
          center={[28.58, 77.25]}
          zoom={10}
          className="windy-map-viewport"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Dense Heatmap Overlay */}
          <LeafletHeatLayer
            points={gridPoints}
            layer={activeLayer}
            radius={34}
            blur={22}
          />

          {/* District Primary Stations */}
          {STATIONS.map((station) => {
            const fc = forecasts.find((f) => f.district === station.district);
            const sev = fc?.predictedSeverity || 'Advisory';

            return (
              <Marker
                key={station.district}
                position={[station.lat, station.lng]}
                icon={customMarkerIcon(station.district, sev)}
                eventHandlers={{
                  click: () => setSelectedDistrict(station.district),
                }}
              >
                <Popup>
                  <div style={{ padding: '6px', minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#38bdf8' }}>
                      {station.district} Station
                    </h4>
                    <div style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
                      <strong>6h Forecast Severity:</strong>{' '}
                      <span
                        style={{
                          color:
                            sev === 'Emergency'
                              ? '#ef4444'
                              : sev === 'Warning'
                              ? '#f59e0b'
                              : '#10b981',
                          fontWeight: 700,
                        }}
                      >
                        {sev}
                      </span>
                    </div>
                    {fc && (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                        <div>
                          Rain: {fc.predictions?.rainfall_6h?.value ?? fc.predictions?.rainfall_mm?.value ?? 'N/A'}{' '}
                          mm/h
                        </div>
                        <div>
                          Temp: {fc.predictions?.temperature_6h?.value ?? fc.predictions?.temperature_c?.value ?? 'N/A'}{' '}
                          °C
                        </div>
                        <div>
                          Wind: {fc.predictions?.wind_speed_6h?.value ?? fc.predictions?.wind_speed_kmh?.value ?? 'N/A'}{' '}
                          km/h
                        </div>
                        <div>Flood Risk: {Math.round((fc.riskScores?.flood || 0) * 100)}%</div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}

      {/* Floating Right Sidebar: District Forecast Breakdown */}
      <div className="windy-side-panel">
        <div className="windy-glass-card">
          <div className="windy-card-header">
            <span>6-Hour ML Forecasts</span>
            <TrendingUp size={14} color="#38bdf8" />
          </div>

          {forecasts.map((fc) => {
            const sevClass = (fc.predictedSeverity || 'advisory').toLowerCase();
            const isSel = selectedDistrict === fc.district;

            return (
              <div
                key={fc.district}
                className={`windy-district-row ${isSel ? 'selected' : ''}`}
                onClick={() => setSelectedDistrict(fc.district)}
              >
                <div>
                  <div className="windy-dist-name">{fc.district}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Rain: {fc.predictions?.rainfall_6h?.value ?? fc.predictions?.rainfall_mm?.value ?? 0} mm • Wind:{' '}
                    {fc.predictions?.wind_speed_6h?.value ?? fc.predictions?.wind_speed_kmh?.value ?? 0} km/h
                  </div>
                </div>
                <div className={`windy-dist-risk ${sevClass}`}>{fc.predictedSeverity}</div>
              </div>
            );
          })}
        </div>

        {/* Selected District Deep-Dive Card */}
        {selectedForecast && (
          <div className="windy-glass-card">
            <div className="windy-card-header">
              <span>{selectedForecast.district} Deep-Dive</span>
              <MapPin size={14} color="#38bdf8" />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              {selectedForecast.explanation ||
                'Composite ensemble nowcast based on temporal sequence and atmospheric barometric features.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
              <div style={{ background: 'rgba(30,41,59,0.5)', padding: '6px', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Flood Risk:</span>{' '}
                <strong style={{ color: '#38bdf8' }}>
                  {Math.round((selectedForecast.riskScores?.flood || 0) * 100)}%
                </strong>
              </div>
              <div style={{ background: 'rgba(30,41,59,0.5)', padding: '6px', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Storm Risk:</span>{' '}
                <strong style={{ color: '#f59e0b' }}>
                  {Math.round((selectedForecast.riskScores?.storm || 0) * 100)}%
                </strong>
              </div>
              <div style={{ background: 'rgba(30,41,59,0.5)', padding: '6px', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Heatwave Risk:</span>{' '}
                <strong style={{ color: '#ef4444' }}>
                  {Math.round((selectedForecast.riskScores?.heatwave || 0) * 100)}%
                </strong>
              </div>
              <div style={{ background: 'rgba(30,41,59,0.5)', padding: '6px', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>River Breach:</span>{' '}
                <strong style={{ color: '#a855f7' }}>
                  {Math.round((selectedForecast.riskScores?.riverBreach || 0) * 100)}%
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div className="windy-glass-card windy-legend-card">
        <div className="windy-legend-title">
          <span>{activeConfig.label}</span>
          <span>{activeConfig.unit}</span>
        </div>
        <div className="windy-legend-ramp" style={{ background: activeConfig.ramp }} />
        <div className="windy-legend-labels">
          <span>{activeConfig.min}</span>
          <span>{activeConfig.max / 2}</span>
          <span>{activeConfig.max}+</span>
        </div>
      </div>

      {/* Floating Bottom Navigation & Controls (Windy Style) */}
      <div className="windy-bottom-bar">
        {/* Time Progression Slider */}
        <div className="windy-time-slider-card">
          <button
            className="windy-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>

          <div className="windy-time-steps">
            {TIME_HORIZONS.map((h) => {
              const isSelected = activeHorizon === h.id;
              const isPred = h.id !== 'now';
              return (
                <button
                  key={h.id}
                  className={`windy-time-chip ${isSelected ? (isPred ? 'active predictive' : 'active') : ''}`}
                  onClick={() => setActiveHorizon(h.id)}
                >
                  {h.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layer Switcher: Switches Windy native overlay and AI heatmap */}
        <div className="windy-layers-bar">
          {LAYER_CONFIGS.map((layer) => {
            const Icon = layer.icon;
            const isSelected = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                className={`windy-layer-btn ${isSelected ? `active ${layer.id}` : ''}`}
                onClick={() => setActiveLayer(layer.id)}
              >
                <Icon size={16} />
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeatMapPage;
