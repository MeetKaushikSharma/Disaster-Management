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
      'Flood','FlashFlood','HeavyRainfall','UrbanWaterlogging','Earthquake',
      'Cyclone','Landslide','Fire','Tsunami','Drought','Heatwave','Coldwave','ChemicalSpill','Other',
    ])
    .withMessage('Invalid disaster type'),
  body('severity')
    .notEmpty()
    .isIn(DisasterEvent.SEVERITY_LEVELS || ['Low', 'Medium', 'High', 'Critical', 'Advisory', 'Watch', 'Warning', 'Emergency'])
    .withMessage('Invalid severity level'),
  body('zoneType')
    .notEmpty()
    .isIn(['polygon', 'radius'])
    .withMessage('zoneType must be "polygon" or "radius"'),
  body('bufferRadiusKm').optional().isFloat({ min: 0, max: 100 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be an ISO8601 date'),
  body('state').optional().trim(),
  body('district').optional().trim(),
  body('targetStates').optional().isArray().withMessage('targetStates must be an array of state names'),
  body('targetDistricts').optional().isArray().withMessage('targetDistricts must be an array of district names'),
  body('status').optional().isIn(DisasterEvent.EVENT_STATUSES || ['draft', 'pending_approval', 'approved', 'published', 'active', 'retracted', 'expired', 'cancelled']),
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
        safetyGuideId, expiresAt, state, district,
        targetStates, targetDistricts,
        translations, status = 'active', capIdentifier,
      } = req.body;

      const resolvedStates = (Array.isArray(targetStates) && targetStates.length > 0)
        ? targetStates
        : (state ? [state] : ['Uttar Pradesh']);
      const resolvedDistricts = (Array.isArray(targetDistricts) && targetDistricts.length > 0)
        ? targetDistricts
        : (district ? [district] : ['Varanasi']);

      const event = await DisasterEvent.create({
        title, type, severity, description, zoneType,
        polygon, centre, radiusKm,
        bufferRadiusKm: bufferRadiusKm ?? Number(process.env.DEFAULT_BUFFER_RADIUS_KM ?? 5),
        safetyGuideId,
        expiresAt,
        targetStates: resolvedStates,
        targetDistricts: resolvedDistricts,
        state: resolvedStates[0],
        district: resolvedDistricts[0],
        translations: translations || {},
        status,
        capIdentifier,
        createdBy: req.admin._id,
        approvalWorkflow: {
          submittedBy: req.admin._id,
          submittedAt: new Date(),
          ...(status === 'active' || status === 'published'
            ? { approvedBy: req.admin._id, approvedAt: new Date() }
            : {}),
        },
      });

      // ── Auto-dispatch alerts ONLY if published/active ─────────────────────────
      if (status === 'active' || status === 'published') {
        alertService.dispatchAlerts(event).then((result) => {
          console.log(
            `[Events] Auto-dispatch for "${event.title}": ${result.alertsSent} sent, ` +
            `${result.usersTargeted} targeted, ${result.duplicatesSkipped} deduped`
          );
        }).catch((err) => {
          console.error('[Events] Auto-dispatch failed:', err.message);
        });
      }

      res.status(201).json({ success: true, event });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/public  — NO AUTH (mobile app uses this to poll active events)
// Returns active/published, non-expired events with regional and translation data.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/public',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('district').optional().isString(),
    query('state').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const filter = {
        status: { $in: ['active', 'published'] },
      };

      if (req.query.district) {
        filter.$or = [
          { targetDistricts: req.query.district },
          { district: req.query.district },
        ];
      }

      if (req.query.state) {
        const stateClause = {
          $or: [
            { targetStates: req.query.state },
            { state: req.query.state },
          ],
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, stateClause];
          delete filter.$or;
        } else {
          filter.$or = stateClause.$or;
        }
      }

      const events = await DisasterEvent.find(filter)
        .populate('safetyGuideId', 'title disasterType language steps')
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
// Query params: ?status=active|published|pending_approval|draft|all
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('status').optional().isIn([
      'active', 'published', 'draft', 'pending_approval',
      'approved', 'retracted', 'expired', 'cancelled', 'all',
    ]),
    query('district').optional().isString(),
    query('state').optional().isString(),
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

      const filter = {};
      if (status !== 'all') {
        filter.status = status === 'active' ? { $in: ['active', 'published'] } : status;
      }
      if (req.query.district) {
        filter.$or = [
          { targetDistricts: req.query.district },
          { district: req.query.district },
        ];
      }
      if (req.query.state) {
        const stateClause = {
          $or: [
            { targetStates: req.query.state },
            { state: req.query.state },
          ],
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, stateClause];
          delete filter.$or;
        } else {
          filter.$or = stateClause.$or;
        }
      }

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
    body('targetStates').optional().isArray(),
    body('targetDistricts').optional().isArray(),
    body('state').optional().trim(),
    body('district').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['title', 'severity', 'description', 'safetyGuideId', 'expiresAt', 'bufferRadiusKm', 'targetStates', 'targetDistricts', 'state', 'district'];
      const updates = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

      if (updates.targetStates && Array.isArray(updates.targetStates) && updates.targetStates.length > 0) {
        updates.state = updates.targetStates[0];
      }
      if (updates.targetDistricts && Array.isArray(updates.targetDistricts) && updates.targetDistricts.length > 0) {
        updates.district = updates.targetDistricts[0];
      }

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/:id/submit-approval  — Researcher submits draft for SDMA review
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/submit-approval',
  protect,
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (event.status !== 'draft') {
        return res.status(400).json({ success: false, message: `Cannot submit event with status "${event.status}"` });
      }

      event.status = 'pending_approval';
      event.approvalWorkflow = event.approvalWorkflow || {};
      event.approvalWorkflow.submittedBy = req.admin._id;
      event.approvalWorkflow.submittedAt = new Date();
      await event.save();

      res.json({
        success: true,
        message: 'Event submitted for SDMA approval',
        event,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/:id/approve  — SDMA Operator approves & publishes event
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/approve',
  protect,
  requireRole('admin', 'super_admin', 'sdma_operator'),
  [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('reviewNotes').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (event.status === 'published' || event.status === 'active') {
        return res.status(409).json({ success: false, message: 'Event is already published' });
      }

      event.status = 'published';
      event.approvalWorkflow = event.approvalWorkflow || {};
      event.approvalWorkflow.approvedBy = req.admin._id;
      event.approvalWorkflow.approvedAt = new Date();
      if (req.body.reviewNotes) {
        event.approvalWorkflow.reviewNotes = req.body.reviewNotes;
      }
      await event.save();

      // Trigger multi-channel alert dispatch (FCM push to targeted citizens)
      alertService.dispatchAlerts(event).then((result) => {
        console.log(`[SDMA Approval] Dispatch for "${event.title}": ${result.alertsSent} sent`);
      }).catch((err) => {
        console.error('[SDMA Approval] Dispatch failed:', err.message);
      });

      res.json({
        success: true,
        message: 'Event approved and published to citizen apps & CAP feed',
        event,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/:id/reject  — SDMA Operator rejects draft with feedback
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/reject',
  protect,
  requireRole('admin', 'super_admin', 'sdma_operator'),
  [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('reviewNotes').notEmpty().withMessage('Rejection reason/notes are required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await DisasterEvent.findById(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      event.status = 'draft';
      event.approvalWorkflow = event.approvalWorkflow || {};
      event.approvalWorkflow.reviewNotes = req.body.reviewNotes;
      await event.save();

      res.json({
        success: true,
        message: 'Event returned to draft status with reviewer feedback',
        event,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
