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

// ── Severity tiers (Supports both legacy and NDMA/IMD standard tiers) ─────────
const SEVERITY_LEVELS = [
  'Low', 'Medium', 'High', 'Critical',
  'Advisory', 'Watch', 'Warning', 'Emergency',
];

// ── Disaster type vocabulary (India NDMA / IMD Hazard Taxonomy) ───────────────
const DISASTER_TYPES = [
  'Flood',
  'FlashFlood',
  'HeavyRainfall',
  'UrbanWaterlogging',
  'Earthquake',
  'Cyclone',
  'Landslide',
  'Fire',
  'Tsunami',
  'Drought',
  'Heatwave',
  'Coldwave',
  'ChemicalSpill',
  'Other',
];

// ── Event lifecycle status ───────────────────────────────────────────────────
const EVENT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'published',
  'active',
  'retracted',
  'expired',
  'cancelled',
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

    // ── Regional / Administrative Targeting (India) ───────────────────────────
    state: {
      type: String,
      trim: true,
      default: 'Uttar Pradesh',
    },

    district: {
      type: String,
      trim: true,
      default: 'Varanasi',
    },

    // ── Multi-language Content (Hindi & Regional) ─────────────────────────────
    translations: {
      hi: {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
      },
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

    // ── Lifecycle & SDMA Approval Flow ────────────────────────────────────────
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: 'active',
    },

    approvalWorkflow: {
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
      },
      submittedAt: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
      },
      approvedAt: Date,
      reviewNotes: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
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

    // ── OASIS CAP 1.2 Standards Metadata ─────────────────────────────────────
    capIdentifier: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    urgency: {
      type: String,
      enum: ['Immediate', 'Expected', 'Future', 'Past', 'Unknown'],
      default: 'Expected',
    },
    certainty: {
      type: String,
      enum: ['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'],
      default: 'Likely',
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
disasterEventSchema.index({ state: 1, district: 1, status: 1 });
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
  return (
    (this.status === 'active' || this.status === 'published') &&
    (!this.expiresAt || this.expiresAt > new Date())
  );
});

module.exports = mongoose.model('DisasterEvent', disasterEventSchema);
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.DISASTER_TYPES = DISASTER_TYPES;
module.exports.EVENT_STATUSES = EVENT_STATUSES;
