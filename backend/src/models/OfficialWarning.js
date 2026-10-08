/**
 * OfficialWarning Schema
 *
 * Ingests and normalizes official warnings and bulletins issued by Indian agencies:
 *   - IMD (India Meteorological Department): District rainfall/weather warnings
 *   - CWC (Central Water Commission): Daily flood situation bulletins & river danger levels
 *   - NDMA / SACHET: Multi-hazard CAP alert bulletins
 */

const mongoose = require('mongoose');

const WARNING_SOURCES = ['IMD', 'CWC', 'NDMA_SACHET', 'SDMA', 'INCOIS'];

const SEVERITY_TIERS = ['Advisory', 'Watch', 'Warning', 'Emergency', 'Low', 'Medium', 'High', 'Critical'];

const officialWarningSchema = new mongoose.Schema(
  {
    externalAlertId: {
      type: String,
      trim: true,
      index: true,
    },

    source: {
      type: String,
      required: true,
      enum: WARNING_SOURCES,
      index: true,
    },

    hazardType: {
      type: String,
      required: true,
      trim: true,
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

    severity: {
      type: String,
      required: true,
      enum: SEVERITY_TIERS,
      index: true,
    },

    headline: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    recommendedAction: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    validFrom: {
      type: Date,
      default: Date.now,
    },

    validTo: {
      type: Date,
      index: true,
    },

    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

officialWarningSchema.index({ district: 1, hazardType: 1, validTo: -1 });

module.exports = mongoose.model('OfficialWarning', officialWarningSchema);
module.exports.WARNING_SOURCES = WARNING_SOURCES;
module.exports.SEVERITY_TIERS = SEVERITY_TIERS;
