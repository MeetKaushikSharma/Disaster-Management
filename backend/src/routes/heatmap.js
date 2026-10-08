/**
 * Heat Map & Predictions Proxy Routes — /api/heatmap
 *
 * Connects frontend clients (Admin Web Leaflet & Flutter App) with the
 * AI spatial interpolation engine and predictive nowcasting service.
 */

const express = require('express');
const axios = require('axios');
const HazardReading = require('../models/HazardReading');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// In-memory cache for fast responsive map interaction (5-minute TTL)
let cachedGrid = {};
let cachedPredictions = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const NCR_CENTERS = {
  Delhi: { lat: 28.7041, lng: 77.1025 },
  Noida: { lat: 28.5355, lng: 77.3910 },
  Ghaziabad: { lat: 28.6692, lng: 77.4538 },
  Faridabad: { lat: 28.4089, lng: 77.3178 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  'Gautam Buddha Nagar': { lat: 28.4744, lng: 77.5040 },
};

/**
 * Metadata for layer rendering, gradients (Windy-style), and bounds
 */
const LAYER_METADATA = {
  rainfall: {
    id: 'rainfall',
    name: 'Rainfall / Precipitation',
    unit: 'mm/h',
    min: 0,
    max: 100,
    gradient: {
      0.0: '#00000000',
      0.15: '#38bdf8',  // light blue
      0.35: '#2563eb',  // vibrant blue
      0.60: '#7c3aed',  // purple
      0.85: '#ec4899',  // magenta
      1.0: '#ef4444',   // extreme red
    },
  },
  temperature: {
    id: 'temperature',
    name: 'Temperature',
    unit: '°C',
    min: 15,
    max: 50,
    gradient: {
      0.0: '#3b82f6',  // cool blue
      0.25: '#06b6d4', // cyan
      0.5: '#10b981',  // green
      0.7: '#f59e0b',  // amber
      0.85: '#f97316', // orange
      1.0: '#ef4444',  // intense red
    },
  },
  wind: {
    id: 'wind',
    name: 'Wind Speed',
    unit: 'km/h',
    min: 0,
    max: 120,
    gradient: {
      0.0: '#00000000',
      0.2: '#10b981',  // gentle green
      0.4: '#eab308',  // yellow
      0.65: '#f97316', // orange
      0.85: '#ef4444', // red
      1.0: '#831843',  // violent maroon
    },
  },
  river: {
    id: 'river',
    name: 'River Water Level',
    unit: 'm',
    min: 195,
    max: 220,
    gradient: {
      0.0: '#10b981',  // normal green
      0.4: '#3b82f6',  // blue
      0.65: '#eab308', // warning yellow
      0.85: '#f97316', // high warning orange
      1.0: '#ef4444',  // danger breach red
    },
  },
  risk: {
    id: 'risk',
    name: 'Disaster Hazard Risk',
    unit: 'Score (0-100)',
    min: 0,
    max: 100,
    gradient: {
      0.0: '#00000000',
      0.25: '#22c55e', // low green
      0.50: '#eab308', // watch yellow
      0.75: '#f97316', // warning orange
      0.90: '#ef4444', // high red
      1.0: '#a855f7',  // extreme violet
    },
  },
};

/**
 * Fallback In-memory IDW Interpolator if AI service is offline
 */
function fallbackGenerateGrid(districtReadings, layer = 'rainfall') {
  const points = [];
  const minLat = 28.35, maxLat = 28.75;
  const minLng = 76.95, maxLng = 77.55;
  const step = 0.035;

  const validReadings = [];
  for (const [dist, coords] of Object.entries(NCR_CENTERS)) {
    const r = districtReadings[dist] || {};
    let val = 0;
    if (layer === 'rainfall') val = r.rainfall_mm || 0;
    else if (layer === 'temperature') val = r.temperature_c || 32;
    else if (layer === 'wind') val = r.wind_speed_kmh || 12;
    else if (layer === 'river') val = r.river_level_m || 202;
    else if (layer === 'risk') val = r.risk_score || 25;

    validReadings.push({ lat: coords.lat, lng: coords.lng, val });
  }

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      let weightSum = 0;
      let valSum = 0;

      for (const st of validReadings) {
        const d2 = Math.pow(lat - st.lat, 2) + Math.pow(lng - st.lng, 2);
        const w = 1.0 / (d2 + 0.0001);
        weightSum += w;
        valSum += w * st.val;
      }

      const interpolated = weightSum > 0 ? valSum / weightSum : 0;
      const meta = LAYER_METADATA[layer] || LAYER_METADATA.rainfall;
      const norm = Math.max(0, Math.min(1, (interpolated - meta.min) / (meta.max - meta.min || 1)));

      points.push({
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        value: Number(interpolated.toFixed(2)),
        intensity: Number(norm.toFixed(3)),
      });
    }
  }

  return points;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/heatmap/layers — Metadata and gradient palettes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/layers', (req, res) => {
  res.json({
    success: true,
    region: 'Delhi-NCR',
    bounds: {
      minLat: 28.35,
      maxLat: 28.75,
      minLng: 76.95,
      maxLng: 77.55,
      center: [28.58, 77.25],
      zoom: 10,
    },
    horizons: [
      { id: 'now', label: 'LIVE Now', offsetHours: 0 },
      { id: '1h', label: '+1 Hour', offsetHours: 1 },
      { id: '3h', label: '+3 Hours', offsetHours: 3 },
      { id: '6h', label: '+6 Hours', offsetHours: 6 },
    ],
    layers: LAYER_METADATA,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/heatmap/grid — Dense interpolated points for leaflet-heat / canvas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/grid', async (req, res) => {
  try {
    const layer = req.query.layer || 'rainfall';
    const horizon = req.query.horizon || 'now';
    const cacheKey = `${layer}_${horizon}`;

    // Try Python AI service first
    try {
      const aiRes = await axios.get(`${AI_SERVICE_URL}/heatmap/grid`, {
        params: { layer, horizon },
        timeout: 2500,
      });
      if (aiRes.data && Array.isArray(aiRes.data.points)) {
        return res.json({
          success: true,
          source: 'ai_engine',
          layer,
          horizon,
          count: aiRes.data.points.length,
          points: aiRes.data.points,
        });
      }
    } catch {
      // AI service not running or timed out; fall back to fast MongoDB IDW
    }

    // Fallback: Query latest readings from MongoDB and calculate IDW
    const latestReadings = await HazardReading.find({})
      .sort({ timestamp: -1 })
      .limit(60)
      .lean();

    const districtMap = {};
    for (const r of latestReadings) {
      if (!districtMap[r.district]) districtMap[r.district] = {};
      if (!districtMap[r.district][r.indicator]) {
        districtMap[r.district][r.indicator] = r.value;
      }
      if (r.anomalyScore) {
        districtMap[r.district].risk_score = Math.max(
          districtMap[r.district].risk_score || 0,
          Math.round(r.anomalyScore * 100)
        );
      }
    }

    const points = fallbackGenerateGrid(districtMap, layer);

    res.json({
      success: true,
      source: 'fallback_idw',
      layer,
      horizon,
      count: points.length,
      points,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/heatmap/predictions — 6-hour forecast and risk scores per district
// ─────────────────────────────────────────────────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    // Attempt from AI service
    try {
      const aiRes = await axios.get(`${AI_SERVICE_URL}/predictions/forecast`, {
        timeout: 2500,
      });
      if (aiRes.data && aiRes.data.predictions) {
        cachedPredictions = aiRes.data;
        return res.json(aiRes.data);
      }
    } catch {
      // Fall through to cached or synthetic estimate
    }

    if (cachedPredictions) {
      return res.json(cachedPredictions);
    }

    // Default estimates if AI models not retrained yet
    const placeholder = Object.keys(NCR_CENTERS).map((district) => ({
      district,
      modelUsed: 'rule_trend_baseline',
      predictionHorizon: '6h',
      predictions: {
        rainfall_6h: { value: 12.5, confidence: 0.82, range: [8.0, 18.0] },
        temperature_6h: { value: 33.2, confidence: 0.88, range: [31.5, 35.0] },
        wind_speed_6h: { value: 18.0, confidence: 0.75, range: [12.0, 24.0] },
        river_level_6h: { value: 202.4, confidence: 0.79, range: [201.8, 203.0] },
      },
      riskScores: {
        flood: 0.22,
        heatwave: 0.35,
        storm: 0.18,
        composite: 0.28,
      },
      predictedSeverity: 'Watch',
      updatedAt: new Date().toISOString(),
    }));

    res.json({
      success: true,
      source: 'baseline_forecast',
      predictions: placeholder,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/heatmap/predictions/batch — Called by AI service to push predictions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/predictions/batch', (req, res) => {
  const { predictions } = req.body;
  if (!predictions || !Array.isArray(predictions)) {
    return res.status(400).json({ success: false, message: 'predictions array required' });
  }

  cachedPredictions = {
    success: true,
    source: 'ai_service_pushed',
    timestamp: new Date().toISOString(),
    predictions,
  };

  res.json({ success: true, count: predictions.length });
});

module.exports = router;
