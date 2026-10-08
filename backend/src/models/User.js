/**
 * User Schema
 *
 * Represents an end-user of the Flutter mobile app.
 * Stores the FCM token for push delivery and the last-known GPS
 * location (GeoJSON Point) so the alert-trigger service can run
 * Turf.js point-in-polygon queries without pulling from device.
 *
 * Sensitive fields (none currently, phone is indexed for lookup).
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name must be ≤ 80 characters'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Phone must be a valid international number'],
    },

    // ── FCM token (refreshed by the Flutter app on each session) ──────────────
    fcmToken: {
      type: String,
      trim: true,
      // Optional at creation — provided after FCM registration in the app
    },

    fcmTokenUpdatedAt: Date,

    // ── Last known location (GeoJSON Point) ───────────────────────────────────
    // Flutter app POSTs this periodically (or on significant movement).
    // Field is intentionally omitted on new registrations — the 2dsphere index
    // is sparse so documents without coordinates are not indexed.
    lastKnownLocation: {
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

    locationUpdatedAt: Date,

    // ── Localisation ──────────────────────────────────────────────────────────
    preferredLanguage: {
      type: String,
      enum: ['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'or'],
      default: 'en',
    },

    // ── Account status ────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // ── Notification preferences ──────────────────────────────────────────────
    notificationsEnabled: { type: Boolean, default: true },

    // Minimum severity the user wants to be alerted about
    alertThreshold: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low', // receive all alerts by default
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ lastKnownLocation: '2dsphere' }, { sparse: true }); // sparse: skips docs without location
userSchema.index({ isActive: 1, fcmToken: 1 });

module.exports = mongoose.model('User', userSchema);
