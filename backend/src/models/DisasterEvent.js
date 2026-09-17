/**
 * DisasterEvent Schema
 *
 * Represents a single disaster alert zone created by an admin.
 * Supports two zone shapes:
 *   - polygon : arbitrary multi-vertex GeoJSON polygon
 *   - radius  : circle defined by a centre point + radiusKm
 *
 * Turf.js is used server-side to evaluate point-in-polygon and buffer
 * containment; the GeoJSON geometry is stored here verbatim so that
 * Turf can consume it directly without extra mapping.
 */

const mongoose = require('mongoose');

// ── Severity tiers ────────────────────────────────────────────────────────────
const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

// ── Disaster type vocabulary (extensible via SafetyGuide) ─────────────────────
const DISASTER_TYPES = [
  'Flood',
  'Earthquake',
  'Cyclone',
  'Landslide',
  'Fire',
  'Tsunami',
  'Drought',
  'Heatwave',
  'ChemicalSpill',
  'Other',
];

// ── Sub-schema: GeoJSON Point (centre for radius-type zones) ──────────────────
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      validate: {
        validator: (v) => v.length === 2,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

// ── Sub-schema: GeoJSON Polygon (for arbitrary drawn zones) ───────────────────
const polygonSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: {
      type: [[[Number]]], // array of linear rings [[[lng, lat], …]]
      validate: {
        validator: (rings) => rings.length > 0 && rings[0].length >= 4,
        message: 'A polygon ring must have at least 4 positions (closed)',
      },
    },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const disasterEventSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [120, 'Title must be ≤ 120 characters'],
    },

    type: {
      type: String,
      required: [true, 'Disaster type is required'],
      enum: { values: DISASTER_TYPES, message: '{VALUE} is not a valid disaster type' },
    },

    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: { values: SEVERITY_LEVELS, message: '{VALUE} is not a valid severity level' },
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must be ≤ 2000 characters'],
    },

    // ── Zone definition ───────────────────────────────────────────────────────
    zoneType: {
      type: String,
      required: true,
      enum: ['polygon', 'radius'],
    },

    // Used when zoneType === 'polygon'
    polygon: polygonSchema,

    // Used when zoneType === 'radius'
    centre: pointSchema,
    radiusKm: {
      type: Number,
      min: [0.1, 'Radius must be at least 0.1 km'],
      max: [10000, 'Radius must be ≤ 10000 km'],
    },

    // Extra fan-out buffer around the primary zone to catch "nearby" users
    bufferRadiusKm: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },

    // ── Linked resources ──────────────────────────────────────────────────────
    safetyGuideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SafetyGuide',
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'retracted', 'expired', 'cancelled'],
      default: 'active',
    },

    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // TTL index — auto-removes from collection
    },

    // ── Retraction / false-alarm correction ───────────────────────────────────
    retractedAt: Date,
    retractedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
    correctionMessage: {
      type: String,
      trim: true,
      maxlength: [500, 'Correction message must be ≤ 500 characters'],
    },

    // ── Admin authorship ──────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },

    // ── Notification tracking ─────────────────────────────────────────────────
    alertsSentCount: { type: Number, default: 0 },
    lastAlertSentAt: Date,
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
disasterEventSchema.index({ status: 1, createdAt: -1 });
disasterEventSchema.index({ type: 1, severity: 1 });
disasterEventSchema.index({ 'centre': '2dsphere' }); // geospatial queries on radius events

// ── Validation: ensure the correct zone fields are present ────────────────────
disasterEventSchema.pre('validate', function (next) {
  if (this.zoneType === 'polygon') {
    if (!this.polygon || !this.polygon.coordinates) {
      return next(new Error('polygon.coordinates are required when zoneType is "polygon"'));
    }
  } else if (this.zoneType === 'radius') {
    if (!this.centre || !this.centre.coordinates) {
      return next(new Error('centre.coordinates are required when zoneType is "radius"'));
    }
    if (this.radiusKm == null) {
      return next(new Error('radiusKm is required when zoneType is "radius"'));
    }
  }
  next();
});

// ── Virtual: is the event currently active? ───────────────────────────────────
disasterEventSchema.virtual('isLive').get(function () {
  return this.status === 'active' && (!this.expiresAt || this.expiresAt > new Date());
});

module.exports = mongoose.model('DisasterEvent', disasterEventSchema);
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.DISASTER_TYPES = DISASTER_TYPES;
