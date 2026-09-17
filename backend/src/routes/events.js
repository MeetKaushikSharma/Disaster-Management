/**
 * Disaster Event Routes  —  /api/events
 *
 * POST   /api/events              Create a new disaster event (admin)
 * GET    /api/events              List events (supports ?status=active|all)
 * GET    /api/events/:id          Get a single event
 * PUT    /api/events/:id          Update event details (admin)
 * PATCH  /api/events/:id/retract  Retract / cancel a false alarm (admin)
 * DELETE /api/events/:id          Hard-delete (super_admin only)
 * POST   /api/events/:id/trigger  Manually trigger alert dispatch for event
 */

const express = require('express');
const { body, query, param } = require('express-validator');

const DisasterEvent = require('../models/DisasterEvent');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const alertService = require('../services/alertService');

const router = express.Router();

// ── Shared validators ─────────────────────────────────────────────────────────
const eventBodyValidators = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
  body('type')
    .notEmpty()
    .isIn(DisasterEvent.DISASTER_TYPES || [
      'Flood','Earthquake','Cyclone','Landslide','Fire',
      'Tsunami','Drought','Heatwave','ChemicalSpill','Other',
    ])
    .withMessage('Invalid disaster type'),
  body('severity')
    .notEmpty()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Severity must be Low | Medium | High | Critical'),
  body('zoneType')
    .notEmpty()
    .isIn(['polygon', 'radius'])
    .withMessage('zoneType must be "polygon" or "radius"'),
  body('bufferRadiusKm').optional().isFloat({ min: 0, max: 100 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be an ISO8601 date'),
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  eventBodyValidators,
  validate,
  async (req, res, next) => {
    try {
      const {
        title, type, severity, description, zoneType,
        polygon, centre, radiusKm, bufferRadiusKm,
        safetyGuideId, expiresAt,
      } = req.body;

      const event = await DisasterEvent.create({
        title, type, severity, description, zoneType,
        polygon, centre, radiusKm,
        bufferRadiusKm: bufferRadiusKm ?? Number(process.env.DEFAULT_BUFFER_RADIUS_KM ?? 5),
        safetyGuideId,
        expiresAt,
        createdBy: req.admin._id,
      });

      // ── Auto-dispatch alerts to users in the disaster zone (fire-and-forget) ──
      alertService.dispatchAlerts(event).then((result) => {
        console.log(
          `[Events] Auto-dispatch for "${event.title}": ${result.alertsSent} sent, ` +
          `${result.usersTargeted} targeted, ${result.duplicatesSkipped} deduped`
        );
      }).catch((err) => {
        console.error('[Events] Auto-dispatch failed:', err.message);
      });

      res.status(201).json({ success: true, event });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/public  — NO AUTH (mobile app uses this to poll active events)
// Returns active, non-expired events with limited fields (no admin details).
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/public',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 20;

      const events = await DisasterEvent.find({ status: 'active' })
        .populate('safetyGuideId', 'title disasterType language')
        .select('-createdBy -retractedBy -__v')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.json({ success: true, events });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events
// Query params: ?status=active (default) | all | retracted | expired
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('status').optional().isIn(['active', 'retracted', 'expired', 'cancelled', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const status = req.query.status || 'active';
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const filter = status === 'all' ? {} : { status };

      const [events, total] = await Promise.all([
        DisasterEvent.find(filter)
          .populate('safetyGuideId', 'title disasterType language')
          .populate('createdBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        DisasterEvent.countDocuments(filter),
      ]);

      res.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        events,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id)
        .populate('safetyGuideId')
        .populate('createdBy', 'name email')
        .populate('retractedBy', 'name email');

      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      res.json({ success: true, event });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/events/:id  — update mutable fields
// (Cannot change zoneType; use retract+new-event for zone corrections)
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('expiresAt').optional().isISO8601(),
    body('bufferRadiusKm').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['title', 'severity', 'description', 'safetyGuideId', 'expiresAt', 'bufferRadiusKm'];
      const updates = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

      const event = await DisasterEvent.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      res.json({ success: true, event });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/events/:id/retract  — retract / cancel with correction push
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/retract',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('correctionMessage')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Correction message must be ≤ 500 chars'),
    body('action')
      .optional()
      .isIn(['retract', 'cancel'])
      .withMessage('action must be "retract" or "cancel"'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (event.status !== 'active') {
        return res.status(409).json({
          success: false,
          message: `Cannot retract an event with status "${event.status}"`,
        });
      }

      const newStatus = req.body.action === 'cancel' ? 'cancelled' : 'retracted';
      event.status = newStatus;
      event.retractedAt = new Date();
      event.retractedBy = req.admin._id;
      event.correctionMessage = req.body.correctionMessage || 'This alert has been retracted';
      await event.save();

      // Dispatch correction push notification to all previously alerted users
      alertService.sendRetractionNotification(event).catch((err) =>
        console.error('[AlertService] Retraction push failed:', err)
      );

      res.json({ success: true, message: `Event ${newStatus}`, event });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/events/:id  — hard delete (super_admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  protect,
  requireRole('super_admin'),
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findByIdAndDelete(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, message: 'Event permanently deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/:id/trigger  — manually dispatch alerts for an event
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/trigger',
  protect,
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (event.status !== 'active') {
        return res.status(409).json({
          success: false,
          message: 'Can only trigger alerts for active events',
        });
      }

      // Fire-and-forget — alert service handles FCM and logging
      const result = await alertService.dispatchAlerts(event);

      res.json({
        success: true,
        message: 'Alert dispatch initiated',
        usersTargeted: result.usersTargeted,
        alertsSent: result.alertsSent,
        duplicatesSkipped: result.duplicatesSkipped,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
