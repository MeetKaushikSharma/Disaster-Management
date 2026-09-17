/**
 * AlertLog Schema
 *
 * Audit trail for every push notification dispatched to a user.
 * Used for:
 *   - Deduplication  — prevents resending the same event to the same user
 *   - Analytics      — how many users were notified, how many acknowledged
 *   - Retraction     — marks all prior sends for a retracted event
 *
 * deduplicationKey = `${eventId}:${userId}` (set as unique index).
 * If a user falls inside two overlapping disaster zones, only one
 * AlertLog document is created per event per user — the service checks
 * existence before inserting.
 */

const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema(
  {
    // ── Relations ─────────────────────────────────────────────────────────────
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Deduplication guard ───────────────────────────────────────────────────
    // Format: "<eventId>:<userId>"
    // Unique sparse index prevents duplicate sends for the same event+user pair.
    deduplicationKey: {
      type: String,
      unique: true,
      required: true,
    },

    // ── Delivery state ────────────────────────────────────────────────────────
    sentAt: {
      type: Date,
      default: Date.now,
    },

    // FCM message ID returned by firebase-admin
    fcmMessageId: String,

    // Whether the FCM send itself succeeded
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },

    deliveryError: String, // FCM error code / message on failure

    // ── User acknowledgement (read receipt from Flutter app) ──────────────────
    acknowledgedAt: Date,

    // ── Push payload snapshot (for audit / replay) ────────────────────────────
    payloadSnapshot: {
      type: mongoose.Schema.Types.Mixed,
    },

    // ── Retraction tracking ───────────────────────────────────────────────────
    // Set to true when a correction push is sent because the event was retracted
    isRetraction: { type: Boolean, default: false },

    retractionSentAt: Date,

    // ── Severity at time of send (event severity may change via downgrade) ─────
    severityAtSend: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
    },

    // ── Location snapshot (user's coords at time of alert) ────────────────────
    userLocationAtSend: {
      type: [Number], // [longitude, latitude]
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
alertLogSchema.index({ eventId: 1, deliveryStatus: 1 });
alertLogSchema.index({ userId: 1, sentAt: -1 });
alertLogSchema.index({ sentAt: -1 }); // dashboard time-series queries

module.exports = mongoose.model('AlertLog', alertLogSchema);
