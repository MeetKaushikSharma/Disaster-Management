/**
 * HazardReading Schema
 *
 * Stores normalized time-series readings for environmental and hydrological indicators
 * across Indian districts and monitoring stations (IMD weather stations, CWC river gauges,
 * CPCB AQI stations, and ground researcher observations).
 */

const mongoose = require('mongoose');

const INDICATOR_TYPES = [
  'rainfall_mm',
  'river_level_m',
  'temperature_c',
  'humidity_pct',
  'wind_speed_kmh',
  'aqi_index',
  'water_discharge_cusecs',
];

const DATA_SOURCES = [
  'IMD',
  'CWC',
  'CPCB',
  'INCOIS',
  'NDMA_SACHET',
  'FIELD_RESEARCHER',
  'SIMULATED',
  'TEST_SUITE',
];

const hazardReadingSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    district: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    stationId: {
      type: String,
      trim: true,
      index: true,
    },

    stationName: {
      type: String,
      trim: true,
    },

    location: {
      _id: false,
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        validate: {
          validator: (v) => !v || v.length === 2,
          message: 'coordinates must be [longitude, latitude]',
        },
      },
    },

    indicator: {
      type: String,
      required: true,
      enum: INDICATOR_TYPES,
      index: true,
    },

    value: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      required: true,
      enum: DATA_SOURCES,
    },

    // Optional gauge thresholds (e.g. for CWC river stations)
    warningLevel: Number,
    dangerLevel: Number,

    // AI Anomaly detection annotation
    isAnomaly: {
      type: Boolean,
      default: false,
      index: true,
    },
    anomalyScore: Number, // 0.0 to 1.0

    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for time-series aggregation and lookup
hazardReadingSchema.index({ district: 1, indicator: 1, timestamp: -1 });
hazardReadingSchema.index({ state: 1, district: 1, timestamp: -1 });
hazardReadingSchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('HazardReading', hazardReadingSchema);
module.exports.INDICATOR_TYPES = INDICATOR_TYPES;
module.exports.DATA_SOURCES = DATA_SOURCES;
