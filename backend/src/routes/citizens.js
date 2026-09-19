/**
 * Citizens Routes — /api/citizens
 *
 * Handles citizen status reporting ("I'm Safe", "Need Help") and situational
 * awareness reporting for emergency response teams.
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const CitizenCheckIn = require('../models/CitizenCheckIn');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/citizens/check-in — Submit "I'm Safe" or "Need Help"
// Public endpoint called by the Flutter mobile app
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/check-in',
  [
    body('userId').isMongoId().withMessage('Valid userId required'),
    body('status').isIn(['safe', 'need_help', 'family_safe']).withMessage('Status must be safe, need_help, or family_safe'),
    body('coordinates').isArray({ min: 2, max: 2 }).withMessage('coordinates must be [longitude, latitude]'),
    body('district').optional().isString(),
    body('state').optional().isString(),
    body('eventId').optional().isMongoId(),
    body('message').optional().isString().isLength({ max: 500 }),
    body('peopleCount').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        userId, status, coordinates, district, state,
        eventId, message, peopleCount = 1,
      } = req.body;

      const user = await User.findById(userId);

      const checkIn = await CitizenCheckIn.create({
        userId,
        phone: user ? user.phone : undefined,
        citizenName: user ? user.name : 'Citizen User',
        status,
        location: {
          type: 'Point',
          coordinates,
        },
        district: district || 'Varanasi',
        state: state || 'Uttar Pradesh',
        eventId,
        message,
        peopleCount,
      });

      // Update user's last known location and timestamp
      if (user) {
        user.lastKnownLocation = { type: 'Point', coordinates };
        user.locationUpdatedAt = new Date();
        await user.save();
      }

      res.status(201).json({
        success: true,
        message: status === 'safe'
          ? 'Safe status recorded. Stay alert.'
          : 'SOS / Help request registered. Response teams notified.',
        checkInId: checkIn._id,
        status: checkIn.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/citizens/situational-awareness — Admin aggregate metrics
// Returns breakdown of safe vs distressed citizens per district/event
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/situational-awareness',
  protect,
  [
    query('district').optional().isString(),
    query('eventId').optional().isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.district) filter.district = req.query.district;
      if (req.query.eventId) filter.eventId = req.query.eventId;

      // Aggregated counts by status
      const [counts, distressedList] = await Promise.all([
        CitizenCheckIn.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$status',
              totalCitizens: { $sum: 1 },
              totalPeople: { $sum: '$peopleCount' },
            },
          },
        ]),
        // List recent critical "Need Help" reports
        CitizenCheckIn.find({ ...filter, status: 'need_help' })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
      ]);

      const summary = {
        safe: 0,
        need_help: 0,
        family_safe: 0,
        totalReports: 0,
      };

      counts.forEach((c) => {
        if (summary[c._id] !== undefined) summary[c._id] = c.totalCitizens;
        summary.totalReports += c.totalCitizens;
      });

      res.json({
        success: true,
        summary,
        distressedCount: summary.need_help,
        distressedList,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/citizens/:id/acknowledge — Mark SOS request as handled by responder
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/acknowledge',
  protect,
  [param('id').isMongoId().withMessage('Invalid check-in ID')],
  validate,
  async (req, res, next) => {
    try {
      const checkIn = await CitizenCheckIn.findByIdAndUpdate(
        req.params.id,
        { $set: { isAcknowledgedByResponders: true } },
        { new: true }
      );

      if (!checkIn) {
        return res.status(404).json({ success: false, message: 'Check-in not found' });
      }

      res.json({ success: true, message: 'Help request marked as dispatched / acknowledged', checkIn });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
