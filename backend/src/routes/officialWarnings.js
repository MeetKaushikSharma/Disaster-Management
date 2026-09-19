/**
 * Official Warnings Routes — /api/official-warnings
 *
 * Ingestion and retrieval of official agency bulletins (IMD, CWC, NDMA/SACHET).
 */

const express = require('express');
const { body, query } = require('express-validator');
const OfficialWarning = require('../models/OfficialWarning');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/official-warnings — List active official warnings
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('district').optional().isString(),
    query('source').optional().isString(),
    query('hazardType').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { district, source, hazardType } = req.query;
      const filter = { isActive: true };

      if (district) filter.district = district;
      if (source) filter.source = source;
      if (hazardType) filter.hazardType = hazardType;

      const warnings = await OfficialWarning.find(filter)
        .sort({ issuedAt: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        count: warnings.length,
        warnings,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/official-warnings — Ingest official warning
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('source').notEmpty().withMessage('Source is required'),
    body('hazardType').notEmpty().withMessage('hazardType is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('district').notEmpty().withMessage('District is required'),
    body('severity').notEmpty().withMessage('Severity is required'),
    body('headline').notEmpty().withMessage('Headline is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const warning = await OfficialWarning.create(req.body);
      res.status(201).json({ success: true, warning });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
