/**
 * User Routes  —  /api/users
 *
 * POST   /api/users/register         Register a new app user
 * PUT    /api/users/:id/location      Update last known location (called by Flutter app)
 * PUT    /api/users/:id/fcm-token     Refresh FCM token
 * GET    /api/users                   List users (admin only, paginated)
 * GET    /api/users/:id               Get a single user (admin only)
 * PUT    /api/users/:id/preferences   Update language / alert threshold
 * DELETE /api/users/:id               Soft-deactivate user
 * POST   /api/users/:id/acknowledge   Mark an alert as acknowledged
 */

const express = require('express');
const { body, param, query } = require('express-validator');

const User = require('../models/User');
const AlertLog = require('../models/AlertLog');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/register  — public (called by Flutter on first launch)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
    body('phone')
      .trim()
      .notEmpty()
      .matches(/^\+?[0-9]{7,15}$/)
      .withMessage('Valid phone number required'),
    body('preferredLanguage')
      .optional()
      .isIn(['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'or']),
    body('fcmToken').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, preferredLanguage, fcmToken } = req.body;

      // Find existing user or create new one
      let user = await User.findOne({ phone });

      if (user) {
        // Update mutable fields on re-registration
        user.name = name;
        if (preferredLanguage) user.preferredLanguage = preferredLanguage;
        if (fcmToken) {
          user.fcmToken = fcmToken;
          user.fcmTokenUpdatedAt = new Date();
        }
        await user.save();
      } else {
        user = await User.create({
          name,
          phone,
          preferredLanguage: preferredLanguage || 'en',
          ...(fcmToken && { fcmToken, fcmTokenUpdatedAt: new Date() }),
        });
      }

      res.status(201).json({ success: true, userId: user._id, user });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id/location  — public (called by Flutter on location change)
// Accepts either:
//   { coordinates: [lng, lat] }          ← Flutter ApiService format
//   { longitude: float, latitude: float } ← legacy format
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:id/location',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('coordinates must be [longitude, latitude]'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  ],
  validate,
  async (req, res, next) => {
    try {
      let lng, lat;

      if (Array.isArray(req.body.coordinates) && req.body.coordinates.length === 2) {
        // Flutter format: { coordinates: [lng, lat] }
        [lng, lat] = req.body.coordinates;
      } else if (req.body.longitude != null && req.body.latitude != null) {
        // Legacy format: { longitude, latitude }
        lng = req.body.longitude;
        lat = req.body.latitude;
      } else {
        return res.status(400).json({ success: false, message: 'Provide coordinates:[lng,lat] or longitude+latitude' });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            lastKnownLocation: { type: 'Point', coordinates: [lng, lat] },
            locationUpdatedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, message: 'Location updated', locationUpdatedAt: user.locationUpdatedAt });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id/fcm-token  — public
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:id/fcm-token',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('fcmToken').notEmpty().withMessage('FCM token required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { fcmToken: req.body.fcmToken, fcmTokenUpdatedAt: new Date() } },
        { new: true }
      );

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, message: 'FCM token updated' });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users  — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('language').optional().isString(),
    query('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.language) filter.preferredLanguage = req.query.language;
      if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
      ]);

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), users });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id  — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id/preferences  — public (user's own settings)
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:id/preferences',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('preferredLanguage')
      .optional()
      .isIn(['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'or'])
      .withMessage('Unsupported language code'),
    body('alertThreshold')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid alert threshold'),
    body('notificationsEnabled').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['preferredLanguage', 'alertThreshold', 'notificationsEnabled'];
      const updates = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/users/:id  — soft-deactivate (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { isActive: false } },
        { new: true }
      );
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, message: 'User deactivated' });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/:id/acknowledge  — mark alert as read (public, called by app)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/acknowledge',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('eventId').isMongoId().withMessage('Valid eventId required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const deduplicationKey = `${req.body.eventId}:${req.params.id}`;
      const log = await AlertLog.findOneAndUpdate(
        { deduplicationKey },
        { $set: { acknowledgedAt: new Date() } },
        { new: true }
      );

      if (!log) {
        return res.status(404).json({ success: false, message: 'Alert log not found' });
      }

      res.json({ success: true, message: 'Alert acknowledged', acknowledgedAt: log.acknowledgedAt });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
