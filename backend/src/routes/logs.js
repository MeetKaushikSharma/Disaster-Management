/**
 * Alert Log Routes  —  /api/logs
 *
 * GET /api/logs                  Paginated alert log (admin only)
 * GET /api/logs/event/:eventId   All logs for a specific event
 * GET /api/logs/user/:userId     All alerts sent to a specific user
 * GET /api/logs/stats            Aggregate stats for dashboard
 */

const express = require('express');
const { query, param } = require('express-validator');

const AlertLog = require('../models/AlertLog');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/logs
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('status').optional().isIn(['pending', 'sent', 'failed']),
    query('isRetraction').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.status) filter.deliveryStatus = req.query.status;
      if (req.query.isRetraction !== undefined)
        filter.isRetraction = req.query.isRetraction === 'true';

      const [logs, total] = await Promise.all([
        AlertLog.find(filter)
          .populate('eventId', 'title type severity status')
          .populate('userId', 'name phone preferredLanguage')
          .sort({ sentAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AlertLog.countDocuments(filter),
      ]);

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), logs });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/logs/event/:eventId
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/event/:eventId',
  protect,
  [param('eventId').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const logs = await AlertLog.find({ eventId: req.params.eventId })
        .populate('userId', 'name phone preferredLanguage')
        .sort({ sentAt: -1 })
        .lean();

      const stats = {
        total: logs.length,
        sent: logs.filter((l) => l.deliveryStatus === 'sent').length,
        failed: logs.filter((l) => l.deliveryStatus === 'failed').length,
        acknowledged: logs.filter((l) => l.acknowledgedAt).length,
      };

      res.json({ success: true, stats, logs });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/logs/user/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/user/:userId',
  protect,
  [param('userId').isMongoId().withMessage('Invalid user ID')],
  validate,
  async (req, res, next) => {
    try {
      const logs = await AlertLog.find({ userId: req.params.userId })
        .populate('eventId', 'title type severity status createdAt')
        .sort({ sentAt: -1 })
        .lean();

      res.json({ success: true, total: logs.length, logs });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/logs/stats  — aggregate numbers for admin dashboard widgets
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/stats',
  protect,
  async (req, res, next) => {
    try {
      const [totals, bySeverity, last24h] = await Promise.all([
        // Overall delivery stats
        AlertLog.aggregate([
          {
            $group: {
              _id: '$deliveryStatus',
              count: { $sum: 1 },
            },
          },
        ]),
        // Alerts grouped by severity at time of send
        AlertLog.aggregate([
          {
            $group: {
              _id: '$severityAtSend',
              count: { $sum: 1 },
              acknowledged: { $sum: { $cond: [{ $ifNull: ['$acknowledgedAt', false] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        // Alerts in last 24 hours
        AlertLog.countDocuments({
          sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      ]);

      const deliveryStats = { pending: 0, sent: 0, failed: 0 };
      totals.forEach(({ _id, count }) => { if (_id) deliveryStats[_id] = count; });

      res.json({
        success: true,
        stats: {
          delivery: deliveryStats,
          bySeverity,
          last24hAlerts: last24h,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
