/**
 * Hazard Readings Routes — /api/hazard-readings
 *
 * Ingestion and time-series telemetry endpoints for IMD weather, CWC river gauges,
 * and environmental sensors.
 */

const express = require('express');
const { body, query } = require('express-validator');
const HazardReading = require('../models/HazardReading');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hazard-readings/batch — Ingest multiple telemetry readings
// Used by Python AI ingestion service & automated station fetchers
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/batch',
  [
    body('readings').isArray({ min: 1 }).withMessage('readings array is required'),
    body('readings.*.state').notEmpty().withMessage('State is required'),
    body('readings.*.district').notEmpty().withMessage('District is required'),
    body('readings.*.indicator').notEmpty().withMessage('Indicator is required'),
    body('readings.*.value').isNumeric().withMessage('Value must be a number'),
    body('readings.*.source').notEmpty().withMessage('Source is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const sanitizedReadings = req.body.readings.map((r) => {
        if (!r.location || !r.location.coordinates || !Array.isArray(r.location.coordinates) || r.location.coordinates.length !== 2) {
          const { location: _loc, ...rest } = r;
          return rest;
        }
        return {
          ...r,
          location: {
            type: 'Point',
            coordinates: r.location.coordinates,
          },
        };
      });

      const inserted = await HazardReading.insertMany(sanitizedReadings, { ordered: false });

      res.status(201).json({
        success: true,
        count: inserted.length,
        message: `Successfully ingested ${inserted.length} hazard readings`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hazard-readings — Query time-series telemetry
// Supports filtering by state, district, indicator, and days (e.g. last 30 days)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('district').optional().isString(),
    query('indicator').optional().isString(),
    query('days').optional().isInt({ min: 1, max: 365 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { district, indicator, days, limit = 100 } = req.query;
      const filter = {};

      if (district) filter.district = district;
      if (indicator) filter.indicator = indicator;

      if (days) {
        const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
        filter.timestamp = { $gte: since };
      }

      const readings = await HazardReading.find(filter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        count: readings.length,
        readings,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hazard-readings/district-summary — Latest status for all districts
// Aggregates the most recent readings for key indicators per district
// ─────────────────────────────────────────────────────────────────────────────
router.get('/district-summary', async (req, res, next) => {
  try {
    // Delhi-NCR districts tracked by the OpenWeatherMap-backed AI service
    const NCR_DISTRICTS = [
      'Delhi',
      'Noida',
      'Ghaziabad',
      'Faridabad',
      'Gurugram',
      'Gautam Buddha Nagar',
    ];

    const NCR_STATES = {
      Delhi: 'Delhi',
      Noida: 'Uttar Pradesh',
      Ghaziabad: 'Uttar Pradesh',
      Faridabad: 'Haryana',
      Gurugram: 'Haryana',
      'Gautam Buddha Nagar': 'Uttar Pradesh',
    };

    const targetDistricts = req.query.district ? [req.query.district] : NCR_DISTRICTS;

    const summaries = await Promise.all(
      targetDistricts.map(async (dist) => {
        const [latestRain, latestRiver, latestTemp] = await Promise.all([
          HazardReading.findOne({ district: dist, indicator: 'rainfall_mm' }).sort({ timestamp: -1 }),
          HazardReading.findOne({ district: dist, indicator: 'river_level_m' }).sort({ timestamp: -1 }),
          HazardReading.findOne({ district: dist, indicator: 'temperature_c' }).sort({ timestamp: -1 }),
        ]);

        return {
          district: dist,
          state: NCR_STATES[dist] || 'Delhi NCR',
          rainfall: latestRain ? { value: latestRain.value, unit: 'mm', timestamp: latestRain.timestamp, isAnomaly: latestRain.isAnomaly } : null,
          riverLevel: latestRiver ? {
            value: latestRiver.value,
            unit: 'm',
            warningLevel: latestRiver.warningLevel,
            dangerLevel: latestRiver.dangerLevel,
            timestamp: latestRiver.timestamp,
            isAnomaly: latestRiver.isAnomaly,
          } : null,
          temperature: latestTemp ? { value: latestTemp.value, unit: '°C', timestamp: latestTemp.timestamp, isAnomaly: latestTemp.isAnomaly } : null,
        };
      })
    );

    res.json({
      success: true,
      data: summaries,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
