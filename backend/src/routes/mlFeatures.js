/**
 * ML Feature Store & Training Data API — /api/ml-features
 *
 * Provides resampled, aligned time-series telemetry data from HazardReadings
 * formatted specifically for ML feature engineering, model training (XGBoost/LSTM),
 * and prediction pipelines.
 */

const express = require('express');
const { query } = require('express-validator');
const HazardReading = require('../models/HazardReading');
const validate = require('../middleware/validate');

const router = express.Router();

const NCR_DISTRICTS = [
  'Delhi',
  'Noida',
  'Ghaziabad',
  'Faridabad',
  'Gurugram',
  'Gautam Buddha Nagar',
];

const DEFAULT_INDICATORS = [
  'rainfall_mm',
  'temperature_c',
  'wind_speed_kmh',
  'river_level_m',
];

/**
 * Helper: Round a Date down to the nearest hour boundary.
 */
function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * GET /api/ml-features/training-data
 *
 * Query params:
 *   - district: District name (e.g. 'Delhi') or 'all'
 *   - indicators: Comma-separated list of indicators (default: rainfall_mm,temperature_c,wind_speed_kmh,river_level_m)
 *   - hours: Lookback window in hours (default: 168 = 7 days, max: 720 = 30 days)
 *   - resample: '1h' | '3h' (default: '1h')
 */
router.get(
  '/training-data',
  [
    query('district').optional().isString(),
    query('indicators').optional().isString(),
    query('hours').optional().isInt({ min: 1, max: 720 }),
    query('resample').optional().isIn(['1h', '3h']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const hours = parseInt(req.query.hours || '168', 10);
      const resample = req.query.resample || '1h';
      const stepHours = resample === '3h' ? 3 : 1;
      const stepMs = stepHours * 60 * 60 * 1000;

      const requestedIndicators = req.query.indicators
        ? req.query.indicators.split(',').map((s) => s.trim())
        : DEFAULT_INDICATORS;

      const requestedDistricts = req.query.district && req.query.district !== 'all'
        ? [req.query.district]
        : NCR_DISTRICTS;

      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Fetch all relevant readings in time window
      const readings = await HazardReading.find({
        district: { $in: requestedDistricts },
        indicator: { $in: requestedIndicators },
        timestamp: { $gte: startTime },
      })
        .select('district indicator value timestamp')
        .sort({ timestamp: 1 })
        .lean();

      // Aggregate into district -> time bucket -> indicators
      const resultByDistrict = {};

      for (const dist of requestedDistricts) {
        resultByDistrict[dist] = {};
      }

      for (const r of readings) {
        const dist = r.district;
        if (!resultByDistrict[dist]) continue;

        // Quantize timestamp to bucket
        const t = new Date(r.timestamp).getTime();
        const bucketTime = Math.floor(t / stepMs) * stepMs;
        const bucketIso = new Date(bucketTime).toISOString();

        if (!resultByDistrict[dist][bucketIso]) {
          resultByDistrict[dist][bucketIso] = {
            timestamp: bucketIso,
          };
          for (const ind of requestedIndicators) {
            resultByDistrict[dist][bucketIso][ind] = null;
          }
        }

        // Store latest value in that bucket or average if multiple
        const existing = resultByDistrict[dist][bucketIso][r.indicator];
        if (existing === null || existing === undefined) {
          resultByDistrict[dist][bucketIso][r.indicator] = r.value;
        } else {
          // Average multiple readings in same window
          resultByDistrict[dist][bucketIso][r.indicator] = Number(
            ((existing + r.value) / 2).toFixed(2)
          );
        }
      }

      // Convert each district dictionary to a sorted array, forward-filling minor gaps
      const formatted = {};
      for (const dist of requestedDistricts) {
        const buckets = Object.values(resultByDistrict[dist]).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Simple forward fill for missing values
        const lastKnown = {};
        for (const b of buckets) {
          for (const ind of requestedIndicators) {
            if (b[ind] !== null && b[ind] !== undefined) {
              lastKnown[ind] = b[ind];
            } else if (lastKnown[ind] !== undefined) {
              b[ind] = lastKnown[ind];
            }
          }
        }

        formatted[dist] = buckets;
      }

      res.json({
        success: true,
        hours,
        resample,
        indicators: requestedIndicators,
        districts: requestedDistricts,
        data: req.query.district && req.query.district !== 'all'
          ? formatted[requestedDistricts[0]] || []
          : formatted,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/ml-features/districts
 * Lists active NCR districts tracked with baseline metadata
 */
router.get('/districts', (req, res) => {
  res.json({
    success: true,
    districts: NCR_DISTRICTS,
    indicators: DEFAULT_INDICATORS,
    bounds: {
      minLat: 28.35,
      maxLat: 28.75,
      minLng: 76.95,
      maxLng: 77.55,
    },
  });
});

module.exports = router;
