/**
 * SafetyGuide Schema
 *
 * Stores multilingual step-by-step safety instructions keyed by
 * disaster type and language code.  When the admin publishes an event
 * they link a SafetyGuide; the Flutter app shows this guide on alert
 * and caches it in Hive for offline access.
 *
 * Structure is intentionally flat (JSON steps array) so it can be
 * directly serialised into i18next / easy_localization bundles.
 */

const mongoose = require('mongoose');
const { DISASTER_TYPES } = require('./DisasterEvent');

// ── Sub-schema: a single instructional step ───────────────────────────────────
const stepSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    instruction: {
      type: String,
      required: [true, 'Step instruction text is required'],
      trim: true,
      maxlength: [1000, 'Step instruction must be ≤ 1000 characters'],
    },
    // Optional icon slug (maps to an icon in the Flutter asset bundle)
    iconSlug: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const safetyGuideSchema = new mongoose.Schema(
  {
    // ── Classification ────────────────────────────────────────────────────────
    disasterType: {
      type: String,
      required: [true, 'Disaster type is required'],
      enum: { values: DISASTER_TYPES, message: '{VALUE} is not a valid disaster type' },
    },

    language: {
      type: String,
      required: [true, 'Language code is required'],
      enum: {
        values: ['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'or'],
        message: '{VALUE} is not a supported language code',
      },
    },

    // ── Content ───────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Guide title is required'],
      trim: true,
      maxlength: [120, 'Title must be ≤ 120 characters'],
    },

    summary: {
      type: String,
      trim: true,
      maxlength: [300, 'Summary must be ≤ 300 characters'],
    },

    steps: {
      type: [stepSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'At least one step is required',
      },
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    version: { type: Number, default: 1 },
    isPublished: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound unique index: one guide per (disasterType × language) ────────────
safetyGuideSchema.index({ disasterType: 1, language: 1 }, { unique: true });
safetyGuideSchema.index({ disasterType: 1, isPublished: 1 });

module.exports = mongoose.model('SafetyGuide', safetyGuideSchema);
