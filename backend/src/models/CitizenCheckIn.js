/**
 * CitizenCheckIn Schema
 *
 * Records citizen status reports ("I am Safe", "Need Help", "Family Safe")
 * during active emergency events or localized disasters.
 *
 * Fed into the Situational Awareness dashboard in the Admin Console so emergency
 * dispatchers and SDMA teams can pinpoint trapped or distressed citizens.
 */

const mongoose = require('mongoose');

const CHECK_IN_STATUSES = ['safe', 'need_help', 'family_safe'];

const citizenCheckInSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    citizenName: {
      type: String,
      trim: true,
      default: 'Anonymous Citizen',
    },

    status: {
      type: String,
      required: true,
      enum: CHECK_IN_STATUSES,
      index: true,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    district: {
      type: String,
      trim: true,
      index: true,
    },

    state: {
      type: String,
      trim: true,
      default: 'Uttar Pradesh',
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      index: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    peopleCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    isAcknowledgedByResponders: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

citizenCheckInSchema.index({ location: '2dsphere' });
citizenCheckInSchema.index({ status: 1, createdAt: -1 });
citizenCheckInSchema.index({ district: 1, status: 1 });

module.exports = mongoose.model('CitizenCheckIn', citizenCheckInSchema);
module.exports.CHECK_IN_STATUSES = CHECK_IN_STATUSES;
