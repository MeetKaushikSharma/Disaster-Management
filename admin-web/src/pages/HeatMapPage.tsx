import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Radar,
  Satellite,
  CloudLightning,
  Eye,
  Gauge,
  Droplets,
  Cloud,
  Snowflake,
  type LucideIcon,
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

type MoreLayerConfig = {
  id: string;
  label: string;
  description: string;
  searchTerms?: string[];
  category: string;
  windyOverlay: string;
  icon: LucideIcon;
  available?: boolean;
};

const MORE_LAYER_CONFIGS: MoreLayerConfig[] = [
  { id: 'weather-radar', label: 'Weather Radar', description: 'Live precipitation radar', searchTerms: ['precipitation'], category: 'Atmospheric & Weather', windyOverlay: 'radar', icon: Radar },
  { id: 'satellite', label: 'Satellite', description: 'Satellite cloud imagery', category: 'Atmospheric & Weather', windyOverlay: 'satellite', icon: Satellite },
  { id: 'wind-gusts', label: 'Wind Gusts', description: 'Forecast wind gusts', category: 'Atmospheric & Weather', windyOverlay: 'gust', icon: Wind },
  { id: 'pressure', label: 'Pressure', description: 'Atmospheric pressure', category: 'Atmospheric & Weather', windyOverlay: 'pressure', icon: Gauge },
  { id: 'humidity', label: 'Humidity', description: 'Relative humidity', category: 'Atmospheric & Weather', windyOverlay: 'rh', icon: Droplets },
  { id: 'dew-point', label: 'Dew Point', description: 'Dew-point temperature', category: 'Atmospheric & Weather', windyOverlay: 'dewpoint', icon: Thermometer },
  { id: 'wet-bulb-temperature', label: 'Wet-Bulb Temperature', description: 'Wet-bulb temperature forecast', category: 'Atmospheric & Weather', windyOverlay: 'wetbulbtemp', icon: Thermometer },
  { id: 'clouds', label: 'Clouds', description: 'Cloud cover', category: 'Atmospheric & Weather', windyOverlay: 'clouds', icon: Cloud },
  { id: 'visibility', label: 'Visibility', description: 'Forecast visibility', category: 'Atmospheric & Weather', windyOverlay: 'visibility', icon: Eye },
  { id: 'rain-accumulation', label: 'Rain Accumulation', description: 'Accumulated precipitation', category: 'Rain & Storm', windyOverlay: 'rainAccu', icon: CloudRain },
  { id: 'rain-thunder', label: 'Rain, Thunder', description: 'Rain and thunder forecast', searchTerms: ['thunderstorms', 'storm'], category: 'Rain & Storm', windyOverlay: 'thunder', icon: CloudLightning },
  { id: 'thunderstorms', label: 'Thunderstorms', description: 'Separate thunderstorm layer is not exposed by this embed', category: 'Rain & Storm', windyOverlay: '', icon: CloudLightning, available: false },
  { id: 'cape', label: 'CAPE Index', description: 'Atmospheric instability forecast', category: 'Rain & Storm', windyOverlay: 'cape', icon: Gauge },
  { id: 'precipitation-type', label: 'Precipitation Type', description: 'Rain, snow, and mixed precipitation', category: 'Rain & Storm', windyOverlay: 'ptype', icon: CloudRain },
  { id: 'weather-warnings', label: 'Weather Warnings', description: 'Official weather warning areas', category: 'Rain & Storm', windyOverlay: 'capAlerts', icon: AlertTriangle },
  { id: 'extreme-forecast', label: 'Extreme Forecast', description: 'Extreme forecast index for wind', searchTerms: ['efi', 'extreme wind'], category: 'Rain & Storm', windyOverlay: 'efiWind', icon: TrendingUp },
  { id: 'hurricane-tracker', label: 'Hurricane Tracker', description: 'Tracker is not exposed as a selectable overlay in this embed', category: 'Cyclone / Severe Weather', windyOverlay: '', icon: Radar, available: false },
  { id: 'fire-danger', label: 'Fire Danger', description: 'Fire weather index', category: 'Cyclone / Severe Weather', windyOverlay: 'fwi', icon: AlertTriangle },
  { id: 'drought-monitoring', label: 'Drought Monitoring', description: 'Drought monitoring index', category: 'Cyclone / Severe Weather', windyOverlay: 'drought40', icon: Eye },
  { id: 'avalanche-danger', label: 'Avalanche Danger', description: 'Not exposed as a selectable overlay in this embed', category: 'Cyclone / Severe Weather', windyOverlay: '', icon: AlertTriangle, available: false },
  { id: 'new-snow', label: 'New Snow', description: 'Accumulated new snow', category: 'Cyclone / Severe Weather', windyOverlay: 'snowAccu', icon: Snowflake },
  { id: 'snow-depth', label: 'Snow Depth', description: 'Snow-depth conditions', category: 'Cyclone / Severe Weather', windyOverlay: 'snowcover', icon: Snowflake },
  { id: 'waves', label: 'Waves', description: 'Forecast wave conditions', category: 'Water / Coastal', windyOverlay: 'waves', icon: Waves },
  { id: 'swell', label: 'Swell', description: 'Ocean swell conditions', category: 'Water / Coastal', windyOverlay: 'swell1', icon: Waves },
  { id: 'sea-temperature', label: 'Sea Temperature', description: 'Sea-surface temperature', category: 'Water / Coastal', windyOverlay: 'sst', icon: Thermometer },
  { id: 'currents', label: 'Currents', description: 'Ocean current conditions', category: 'Water / Coastal', windyOverlay: 'currents', icon: Waves },
  { id: 'tidal-currents', label: 'Tidal Currents', description: 'Tidal current conditions', category: 'Water / Coastal', windyOverlay: 'currentsTide', icon: Waves },
  { id: 'wave-power', label: 'Wave Power', description: 'Not exposed as a selectable overlay in this embed', category: 'Water / Coastal', windyOverlay: '', icon: Waves, available: false },
  { id: 'air-quality-index', label: 'Air Quality Index', description: 'Windy air-quality index', searchTerms: ['aqi', 'air quality'], category: 'Air Quality', windyOverlay: 'airQ', icon: Wind },
  { id: 'pm25', label: 'PM2.5', description: 'Particulate matter concentration', searchTerms: ['air quality', 'aqi'], category: 'Air Quality', windyOverlay: 'pm2p5', icon: Wind },
  { id: 'aerosol', label: 'Aerosol', description: 'Aerosol optical depth', searchTerms: ['air quality'], category: 'Air Quality', windyOverlay: 'aod550', icon: Cloud },
  { id: 'no2', label: 'NO₂', description: 'Nitrogen dioxide concentration', searchTerms: ['air quality', 'no2'], category: 'Air Quality', windyOverlay: 'no2', icon: Cloud },
  { id: 'so2', label: 'SO₂', description: 'Sulfur dioxide concentration', searchTerms: ['air quality', 'so2'], category: 'Air Quality', windyOverlay: 'tcso2', icon: Cloud },
  { id: 'ozone', label: 'Ozone Layer', description: 'Total-column ozone', searchTerms: ['air quality'], category: 'Air Quality', windyOverlay: 'gtco3', icon: Cloud },
  { id: 'carbon-monoxide', label: 'CO Concentration', description: 'Carbon monoxide concentration', searchTerms: ['air quality', 'co'], category: 'Air Quality', windyOverlay: 'cosc', icon: Cloud },
  { id: 'dust', label: 'Dust Mass', description: 'Dust concentration', searchTerms: ['air quality'], category: 'Air Quality', windyOverlay: 'dustsm', icon: Wind },
];

const RECOMMENDED_LAYER_IDS = [
  'weather-radar',
  'satellite',
  'rain-accumulation',
  'rain-thunder',
  'wind-gusts',
  'visibility',
];

const LAYER_CATEGORIES = [
  'Atmospheric & Weather',
  'Rain & Storm',
  'Cyclone / Severe Weather',
  'Water / Coastal',
  'Air Quality',
];

const ALL_WINDY_LAYERS = [...LAYER_CONFIGS, ...MORE_LAYER_CONFIGS];

const normalizeLayerSearch = (value: string): string =>
  value.toLocaleLowerCase().replaceAll('₂', '2').replaceAll('₃', '3');

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

const formatRisk = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : 'Unavailable';

const riskColor = (severity?: string): string => {
  switch (severity) {
    case 'Emergency':
      return '#dc2626';
    case 'Warning':
      return '#d97706';
    case 'Watch':
      return '#0284c7';
    case 'Advisory':
      return '#15803d';
    default:
      return '#64748b';
  }
};

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
  const [activeWindyLayerId, setActiveWindyLayerId] = useState<string>('wind');
  const [activeHorizon, setActiveHorizon] = useState<string>('now');
  const [gridPoints, setGridPoints] = useState<HeatmapGridPoint[]>([]);
  const [forecasts, setForecasts] = useState<DistrictForecast[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>('Delhi');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [forecastsLoading, setForecastsLoading] = useState<boolean>(true);
  const [forecastsError, setForecastsError] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [isLayerBrowserOpen, setIsLayerBrowserOpen] = useState<boolean>(false);
  const [layerSearch, setLayerSearch] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Atmospheric & Weather']);
  const [isWindyLayerLoading, setIsWindyLayerLoading] = useState<boolean>(false);
  const [windyLayerLoadError, setWindyLayerLoadError] = useState<boolean>(false);
  const [windyRetryKey, setWindyRetryKey] = useState<number>(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const layerSearchRef = useRef<HTMLInputElement>(null);
  const layerDialogRef = useRef<HTMLElement>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const wasLayerBrowserOpenRef = useRef(false);

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
  const fetchForecasts = useCallback(async () => {
    setForecastsLoading(true);
    try {
      const res = await getPredictionsForecast();
      if (res.data && Array.isArray(res.data.predictions)) {
        setForecasts(res.data.predictions);
        setForecastsError(false);
        return true;
      }
      setForecasts([]);
      setForecastsError(true);
      return false;
    } catch (err) {
      console.error('Error fetching predictions forecast:', err);
      setForecastsError(true);
      return false;
    } finally {
      setForecastsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchForecasts();
  }, [fetchForecasts]);

  useEffect(() => {
    if (!isLayerBrowserOpen) {
      if (wasLayerBrowserOpenRef.current) {
        moreButtonRef.current?.focus();
        wasLayerBrowserOpenRef.current = false;
      }
      return;
    }

    wasLayerBrowserOpenRef.current = true;
    layerSearchRef.current?.focus();
    const previousBodyOverflow = document.body.style.overflow;
    const pageContent = document.querySelector<HTMLElement>('.page-content');
    const previousPageOverflow = pageContent?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (pageContent) pageContent.style.overflowY = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLayerBrowserOpen(false);
        return;
      }
      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          layerDialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          ) || []
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (!first || !last) {
          event.preventDefault();
          layerDialogRef.current?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (pageContent && previousPageOverflow !== undefined) {
        pageContent.style.overflowY = previousPageOverflow;
      }
    };
  }, [isLayerBrowserOpen]);

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
  const activeWindyLayer = useMemo(
    () => ALL_WINDY_LAYERS.find((layer) => layer.id === activeWindyLayerId) || LAYER_CONFIGS[0],
    [activeWindyLayerId]
  );
  const activeMoreLayer = viewMode === 'windy'
    ? MORE_LAYER_CONFIGS.find((layer) => layer.id === activeWindyLayerId)
    : undefined;
  const activePrimaryLayerId = viewMode === 'sensor'
    ? activeLayer
    : activeMoreLayer
      ? null
      : activeWindyLayerId;
  const searchResults = useMemo(() => {
    const query = normalizeLayerSearch(layerSearch.trim());
    if (!query) return [];
    const rank = (layer: MoreLayerConfig) => {
      const name = normalizeLayerSearch(layer.label);
      const description = normalizeLayerSearch(layer.description);
      const searchTerms = normalizeLayerSearch((layer.searchTerms || []).join(' '));
      if (name === query) return 0;
      if (name.startsWith(query)) return 1;
      if (name.includes(query)) return 2;
      if (description.includes(query)) return 3;
      if (searchTerms.includes(query)) return 4;
      if (normalizeLayerSearch(layer.category).includes(query)) return 5;
      return 6;
    };
    return MORE_LAYER_CONFIGS
      .filter((layer) =>
        normalizeLayerSearch(`${layer.label} ${layer.description} ${(layer.searchTerms || []).join(' ')}`).includes(query)
      )
      .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  }, [layerSearch]);

  const highestRiskForecast = useMemo(() => {
    const scoredForecasts = forecasts.filter(
      (forecast) =>
        typeof forecast.riskScores?.composite === 'number' &&
        Number.isFinite(forecast.riskScores.composite)
    );
    if (scoredForecasts.length === 0) return null;
    return [...scoredForecasts].sort(
      (a, b) => b.riskScores.composite - a.riskScores.composite
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
        : riskSev === 'Advisory'
        ? '#10b981'
        : '#64748b';
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
    const overlay = activeWindyLayer.windyOverlay || 'wind';
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
  }, [activeWindyLayer]);

  const selectPrimaryLayer = (layerId: string) => {
    const layerChanged = activeWindyLayerId !== layerId;
    const retryCurrentLayer = viewMode === 'windy' && !layerChanged && windyLayerLoadError;
    setActiveLayer(layerId);
    setActiveWindyLayerId(layerId);
    setWindyLayerLoadError(false);
    setIsWindyLayerLoading(viewMode === 'windy' && (layerChanged || retryCurrentLayer));
    if (retryCurrentLayer) setWindyRetryKey((key) => key + 1);
  };

  const selectMoreLayer = (layer: MoreLayerConfig) => {
    if (layer.available === false) return;
    const layerChanged = activeWindyLayerId !== layer.id || viewMode !== 'windy';
    setActiveWindyLayerId(layer.id);
    setViewMode('windy');
    setWindyLayerLoadError(false);
    setIsWindyLayerLoading(layerChanged);
    setIsLayerBrowserOpen(false);
  };

  const toggleLayerCategory = (category: string) => {
    setExpandedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  return (
    <div className={`windy-page-container ${isLayerBrowserOpen ? 'layer-browser-open' : ''}`}>
      <header className="windy-top-bar">
        <div className="windy-title-badge">
          <span className={`windy-badge-pulse ${activeHorizon !== 'now' ? 'predictive' : ''}`} aria-hidden="true" />
          <div className="windy-title-text">
            <h2>
              <ShieldAlert size={20} aria-hidden="true" />
              <span>RakṣāSetu</span>
              <span className="windy-title-divider" aria-hidden="true">/</span>
              <span>Windy Early Warning Radar</span>
            </h2>
            <span className="windy-title-meta">
              Delhi-NCR · {activeHorizon === 'now' ? 'Live view' : `Forecast · ${activeHorizon}`} · Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="windy-mode-toggle-card" role="group" aria-label="Map display mode">
          <button
            type="button"
            className={`windy-mode-pill ${viewMode === 'windy' ? 'active' : ''}`}
            onClick={() => {
              if (viewMode !== 'windy') {
                setViewMode('windy');
                setIsWindyLayerLoading(true);
                setWindyLayerLoadError(false);
              }
            }}
            aria-pressed={viewMode === 'windy'}
            title="Interactive Windy Map with Animated Streamlines & Numerical Weather Overlays"
          >
            <Compass size={15} aria-hidden="true" />
            <span>Windy Live Radar</span>
          </button>
          <button
            type="button"
            className={`windy-mode-pill ${viewMode === 'sensor' ? 'active' : ''}`}
            onClick={() => setViewMode('sensor')}
            aria-pressed={viewMode === 'sensor'}
            title="Dense Spatial Interpolation from Regional Sensor Feeds"
          >
            <Layers size={15} aria-hidden="true" />
            <span>AI Sensor Grid</span>
          </button>
        </div>

        <div className="windy-quick-stats">
          <div className="windy-metric-chip">
            <span className="windy-metric-label">Model engine</span>
            <span className="windy-metric-val"><Cpu size={14} aria-hidden="true" /> XGB + LSTM</span>
          </div>
          <div className="windy-metric-chip">
            <span className="windy-metric-label">Peak risk</span>
            <span className={`windy-metric-val ${highestRiskForecast ? 'has-value' : 'is-unavailable'}`}>
              {highestRiskForecast
                ? `${highestRiskForecast.district} · ${formatRisk(highestRiskForecast.riskScores?.composite)}`
                : 'Unavailable'}
            </span>
          </div>
          <button
            type="button"
            className={`windy-sync-button ${syncStatus}`}
            onClick={() => {
              void (async () => {
                setSyncStatus('syncing');
                setActiveHorizon('now');
                const synced = await fetchForecasts();
                setLastRefreshed(new Date());
                setSyncStatus(synced ? 'synced' : 'error');
              })();
            }}
            disabled={syncStatus === 'syncing'}
            aria-busy={syncStatus === 'syncing'}
            title="Sync Live Telemetry & Predictions"
          >
            <RefreshCw size={15} className={syncStatus === 'syncing' ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'error' ? 'Retry Sync' : 'Sync'}</span>
          </button>
        </div>
      </header>

      <nav className="windy-district-strip" aria-label="District monitoring">
        {STATIONS.map((station) => {
          const forecast = forecasts.find((item) => item.district === station.district);
          const selected = selectedDistrict === station.district;
          const severity = forecast?.predictedSeverity;
          return (
            <button
              key={station.district}
              type="button"
              className={`windy-station-chip ${selected ? 'selected' : ''}`}
              onClick={() => setSelectedDistrict(station.district)}
              aria-pressed={selected}
              aria-label={`${station.district}, risk ${formatRisk(forecast?.riskScores?.composite)}, ${severity || 'severity unavailable'}`}
            >
              <span className="windy-station-dot" style={{ backgroundColor: riskColor(severity) }} aria-hidden="true" />
              <span className="windy-station-name">{station.district}</span>
              <span className={`windy-station-score ${severity ? severity.toLowerCase() : 'unavailable'}`}>
                {formatRisk(forecast?.riskScores?.composite)}
              </span>
            </button>
          );
        })}
      </nav>

      <main className="windy-workspace">
        <section className="windy-map-region" aria-label="Weather map">
          <div
            ref={mapStageRef}
            className="windy-map-stage"
            tabIndex={-1}
            aria-label={`Map showing ${activeWindyLayer.label}`}
          >
            {viewMode === 'windy' ? (
              <div className="windy-canvas-container">
                <iframe
                  key={`${activeWindyLayer.id}-${windyRetryKey}`}
                  src={windyEmbedUrl}
                  title="Windy Early Warning Radar Engine"
                  className="windy-iframe-viewport"
                  frameBorder="0"
                  onLoad={() => {
                    setIsWindyLayerLoading(false);
                    setWindyLayerLoadError(false);
                  }}
                  onError={() => {
                    setIsWindyLayerLoading(false);
                    setWindyLayerLoadError(true);
                  }}
                />
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
                <LeafletHeatLayer points={gridPoints} layer={activeLayer} radius={34} blur={22} />
                {STATIONS.map((station) => {
                  const forecast = forecasts.find((item) => item.district === station.district);
                  const severity = forecast?.predictedSeverity || 'Unavailable';
                  return (
                    <Marker
                      key={station.district}
                      position={[station.lat, station.lng]}
                      icon={customMarkerIcon(station.district, severity)}
                      eventHandlers={{ click: () => setSelectedDistrict(station.district) }}
                    >
                      <Popup>
                        <div className="windy-popup">
                          <h4>{station.district} Station</h4>
                          <div><strong>6h Forecast Severity:</strong> {severity}</div>
                          <div>Rain: {forecast?.predictions?.rainfall_6h?.value ?? forecast?.predictions?.rainfall_mm?.value ?? 'Unavailable'} mm</div>
                          <div>Temp: {forecast?.predictions?.temperature_6h?.value ?? forecast?.predictions?.temperature_c?.value ?? 'Unavailable'} °C</div>
                          <div>Wind: {forecast?.predictions?.wind_speed_6h?.value ?? forecast?.predictions?.wind_speed_kmh?.value ?? 'Unavailable'} km/h</div>
                          <div>Flood Risk: {formatRisk(forecast?.riskScores?.flood)}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
            {viewMode === 'sensor' && isLoading && (
              <div className="windy-map-loading" role="status">Loading sensor grid…</div>
            )}
            {viewMode === 'windy' && isWindyLayerLoading && (
              <div className="windy-map-loading" role="status">Loading layer…</div>
            )}
            {viewMode === 'windy' && windyLayerLoadError && (
              <div className="windy-map-loading error" role="alert">
                <span>Layer temporarily unavailable</span>
                <button
                  type="button"
                  onClick={() => {
                    setWindyLayerLoadError(false);
                    setIsWindyLayerLoading(true);
                    setWindyRetryKey((key) => key + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {activeMoreLayer ? (
            <div className="windy-legend-card no-scale">
              <strong>{activeMoreLayer.label}</strong>
              <span>Scale is provided by Windy when available.</span>
            </div>
          ) : (
            <div className="windy-legend-card" aria-label={`${activeConfig.label} legend`}>
              <div className="windy-legend-title">
                <strong>{activeConfig.label}</strong>
                <span>{activeConfig.unit}</span>
              </div>
              <div className="windy-legend-ramp" style={{ background: activeConfig.ramp }} />
              <div className="windy-legend-labels">
                <span>{activeConfig.min}</span>
                <span>{activeConfig.min + (activeConfig.max - activeConfig.min) / 2}</span>
                <span>{activeConfig.max}+</span>
              </div>
            </div>
          )}
        </section>

        <aside className="windy-side-panel" aria-label="Forecast and selected district details">
          <section className="windy-panel-section">
            <div className="windy-card-header">
              <div>
                <span className="windy-section-eyebrow">District outlook</span>
                <h3>6-Hour ML Forecasts</h3>
              </div>
              <TrendingUp size={18} aria-hidden="true" />
            </div>

            {forecastsLoading && forecasts.length === 0 && (
              <div className="windy-panel-message" role="status">Loading district forecasts…</div>
            )}
            {forecastsError && forecasts.length === 0 && (
              <div className="windy-panel-message error" role="alert">
                <span>Live forecasts temporarily unavailable.</span>
                <button type="button" onClick={() => void fetchForecasts()}>Retry</button>
              </div>
            )}
            {!forecastsLoading && !forecastsError && forecasts.length === 0 && (
              <div className="windy-panel-message" role="status">No district forecast data available.</div>
            )}
            {forecasts.map((forecast) => {
              const severity = forecast.predictedSeverity || 'Unavailable';
              const selected = selectedDistrict === forecast.district;
              return (
                <button
                  key={forecast.district}
                  type="button"
                  className={`windy-district-row ${selected ? 'selected' : ''}`}
                  onClick={() => setSelectedDistrict(forecast.district)}
                  aria-pressed={selected}
                >
                  <span className="windy-district-copy">
                    <span className="windy-dist-name">{forecast.district}</span>
                    <span className="windy-district-data">
                      Rain {forecast.predictions?.rainfall_6h?.value ?? forecast.predictions?.rainfall_mm?.value ?? 'Unavailable'} mm
                      <span aria-hidden="true"> · </span>
                      Wind {forecast.predictions?.wind_speed_6h?.value ?? forecast.predictions?.wind_speed_kmh?.value ?? 'Unavailable'} km/h
                    </span>
                  </span>
                  <span className={`windy-dist-risk ${severity.toLowerCase()}`}>{severity}</span>
                </button>
              );
            })}
          </section>

          <section className="windy-panel-section windy-deep-dive">
            <div className="windy-card-header">
              <div>
                <span className="windy-section-eyebrow">Selected district</span>
                <h3>{selectedDistrict || 'No district selected'}</h3>
              </div>
              <MapPin size={17} aria-hidden="true" />
            </div>
            {selectedForecast ? (
              <>
                <p className="windy-explanation">
                  {selectedForecast.explanation || 'Explanation unavailable.'}
                </p>
                <div className="windy-risk-grid">
                  <div><span>Flood risk</span><strong>{formatRisk(selectedForecast.riskScores?.flood)}</strong></div>
                  <div><span>Storm risk</span><strong>{formatRisk(selectedForecast.riskScores?.storm)}</strong></div>
                  <div><span>Heatwave risk</span><strong>{formatRisk(selectedForecast.riskScores?.heatwave)}</strong></div>
                  <div><span>River breach</span><strong>{formatRisk(selectedForecast.riskScores?.riverBreach)}</strong></div>
                </div>
              </>
            ) : (
              <p className="windy-explanation">
                {forecastsLoading ? 'Loading district risk analysis…' : 'Risk analysis unavailable for this district.'}
              </p>
            )}
            <span className="windy-risk-source">Risk source · RakṣāSetu AI</span>
          </section>
        </aside>
      </main>

      <footer className="windy-control-dock" aria-label="Map controls">
        {createPortal(
          <div
            className="windy-layer-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setIsLayerBrowserOpen(false);
            }}
            hidden={!isLayerBrowserOpen}
          >
            <section
            className="windy-layer-browser"
            id="windy-layer-browser"
            ref={layerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="windy-layer-browser-title"
            tabIndex={-1}
          >
            <header className="windy-layer-browser-header">
              <div>
                <span className="windy-section-eyebrow">RakṣāSetu map layers</span>
                <h3 id="windy-layer-browser-title">More Weather &amp; Disaster Layers</h3>
              </div>
              <button
                type="button"
                className="windy-layer-browser-close"
                onClick={() => setIsLayerBrowserOpen(false)}
                aria-label="Close weather and disaster layers"
                title="Close weather and disaster layers"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </header>
            <div className="windy-layer-browser-content">
            <label className="windy-layer-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={layerSearchRef}
                type="search"
                value={layerSearch}
                onChange={(event) => setLayerSearch(event.target.value)}
                placeholder="Search layers..."
                aria-label="Search weather and disaster layers"
              />
              {layerSearch && (
                <button type="button" onClick={() => setLayerSearch('')} aria-label="Clear layer search">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </label>

            {layerSearch.trim() ? (
              <section className="windy-layer-results" aria-live="polite">
                <h4>Search results</h4>
                {searchResults.length ? (
                  <div className="windy-layer-card-grid">
                    {searchResults.map((layer) => {
                      const Icon = layer.icon;
                      const active = activeWindyLayerId === layer.id;
                      return (
                        <button
                          type="button"
                          key={layer.id}
                          className={`windy-more-layer-card ${active ? 'selected' : ''} ${layer.available === false ? 'unavailable' : ''}`}
                          onClick={() => selectMoreLayer(layer)}
                          aria-pressed={active}
                          disabled={layer.available === false}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span className="windy-more-layer-copy">
                            <strong>{layer.label}</strong>
                            <small>{layer.category} · {layer.description}</small>
                          </span>
                          {layer.available === false
                            ? <span className="windy-layer-availability">Embed unavailable</span>
                            : active && <span className="windy-active-layer"><Check size={12} /> Active</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="windy-no-layer-results">No matching layers</p>
                )}
              </section>
            ) : (
              <>
                <section className="windy-layer-recommendations">
                  <h4><ShieldAlert size={15} aria-hidden="true" /> Recommended for Disaster Monitoring</h4>
                  <div className="windy-layer-card-grid">
                    {RECOMMENDED_LAYER_IDS.map((id) => {
                      const layer = MORE_LAYER_CONFIGS.find((item) => item.id === id);
                      if (!layer) return null;
                      const Icon = layer.icon;
                      const active = activeWindyLayerId === layer.id;
                      return (
                        <button
                          type="button"
                          key={layer.id}
                          className={`windy-more-layer-card recommended ${active ? 'selected' : ''} ${layer.available === false ? 'unavailable' : ''}`}
                          onClick={() => selectMoreLayer(layer)}
                          aria-pressed={active}
                          disabled={layer.available === false}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span className="windy-more-layer-copy">
                            <strong>{layer.label}</strong>
                            <small>{layer.description}</small>
                          </span>
                          {layer.available === false
                            ? <span className="windy-layer-availability">Embed unavailable</span>
                            : active && <span className="windy-active-layer"><Check size={12} /> Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <div className="windy-layer-categories">
                  {LAYER_CATEGORIES.map((category) => {
                    const layers = MORE_LAYER_CONFIGS.filter((layer) => layer.category === category);
                    const expanded = expandedCategories.includes(category);
                    const categoryId = `windy-layer-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    return (
                      <section className="windy-layer-category" key={category}>
                        <button
                          type="button"
                          className="windy-layer-category-toggle"
                          aria-expanded={expanded}
                          aria-controls={categoryId}
                          onClick={() => toggleLayerCategory(category)}
                        >
                          {expanded
                            ? <ChevronDown size={15} aria-hidden="true" />
                            : <ChevronRight size={15} aria-hidden="true" />}
                          <span>{category}</span>
                          <small>{layers.length}</small>
                        </button>
                        <div className="windy-layer-category-content" id={categoryId} hidden={!expanded}>
                          {layers.length ? (
                            <div className="windy-layer-card-grid">
                              {layers.map((layer) => {
                                const Icon = layer.icon;
                                const active = activeWindyLayerId === layer.id;
                                return (
                                  <button
                                    type="button"
                                    key={layer.id}
                                    className={`windy-more-layer-card ${active ? 'selected' : ''} ${layer.available === false ? 'unavailable' : ''}`}
                                    onClick={() => selectMoreLayer(layer)}
                                    aria-pressed={active}
                                    disabled={layer.available === false}
                                  >
                                    <Icon size={17} aria-hidden="true" />
                                    <span className="windy-more-layer-copy">
                                      <strong>{layer.label}</strong>
                                      <small>{layer.description}</small>
                                    </span>
                                    {layer.available === false
                                      ? <span className="windy-layer-availability">Embed unavailable</span>
                                      : active && <span className="windy-active-layer"><Check size={12} /> Active</span>}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="windy-layer-empty">
                              No additional layers from this category are currently exposed by the Windy embed.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )}
            </div>
            </section>
          </div>,
          document.body
        )}
        <div className="windy-time-slider-card" role="group" aria-label="Forecast time range">
          <button
            type="button"
            className="windy-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause forecast timeline' : 'Play forecast timeline'}
            aria-pressed={isPlaying}
            title={isPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
          >
            {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <div className="windy-time-steps">
            {TIME_HORIZONS.map((horizon) => {
              const selected = activeHorizon === horizon.id;
              return (
                <button
                  key={horizon.id}
                  type="button"
                  className={`windy-time-chip ${selected ? 'active' : ''}`}
                  onClick={() => setActiveHorizon(horizon.id)}
                  aria-pressed={selected}
                >
                  {horizon.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="windy-tools-row">
          <div className="windy-layers-bar" role="group" aria-label="Map layer">
            {LAYER_CONFIGS.map((layer) => {
              const Icon = layer.icon;
              const selected = activePrimaryLayerId === layer.id;
              const shortLabel = layer.id === 'rainfall' ? 'Rain' : layer.id === 'temperature' ? 'Temp' : layer.id === 'river' ? 'River' : layer.id === 'risk' ? 'Risk' : 'Wind';
              return (
                <button
                  key={layer.id}
                  type="button"
                  className={`windy-layer-btn ${selected ? `active ${layer.id}` : ''}`}
                  onClick={() => selectPrimaryLayer(layer.id)}
                  aria-label={layer.label}
                  aria-pressed={selected}
                  title={layer.label}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{shortLabel}</span>
                </button>
              );
            })}
            <button
              ref={moreButtonRef}
              type="button"
              className={`windy-layer-btn windy-more-button ${isLayerBrowserOpen ? 'active' : ''} ${activeMoreLayer ? 'has-active-layer' : ''}`}
              onClick={() => setIsLayerBrowserOpen((open) => !open)}
              aria-label={`More weather and disaster layers${activeMoreLayer ? `. Active layer: ${activeMoreLayer.label}` : ''}`}
              aria-expanded={isLayerBrowserOpen}
              aria-controls="windy-layer-browser"
              title="More weather and disaster layers"
            >
              <Layers size={15} aria-hidden="true" />
              <span>More</span>
              {isLayerBrowserOpen
                ? <ChevronUp size={13} aria-hidden="true" />
                : <ChevronDown size={13} aria-hidden="true" />}
            </button>
          </div>
          <span className="windy-last-updated">
            {syncStatus === 'syncing' ? 'Syncing forecasts…' : syncStatus === 'error' ? 'Forecast sync failed' : `Updated ${lastRefreshed.toLocaleTimeString()}`}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default HeatMapPage;
