/**
 * Safety Guide Routes  —  /api/guides
 *
 * POST   /api/guides              Create a guide (admin)
 * GET    /api/guides              List guides (?disasterType=Flood&language=en)
 * GET    /api/guides/:id          Get a single guide
 * PUT    /api/guides/:id          Update guide steps (admin)
 * DELETE /api/guides/:id          Delete guide (admin)
 *
 * The compound unique index (disasterType × language) enforces one guide per type per language.
 * Admins can add new languages by creating additional documents.
 */

const express = require('express');
const { body, query, param } = require('express-validator');

const SafetyGuide = require('../models/SafetyGuide');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'or'];
const DISASTER_TYPES = [
  'Flood','Earthquake','Cyclone','Landslide','Fire',
  'Tsunami','Drought','Heatwave','ChemicalSpill','Other',
];

const stepValidator = [
  body('steps').isArray({ min: 1 }).withMessage('At least one step required'),
  body('steps.*.order').isInt({ min: 1 }).withMessage('Step order must be a positive integer'),
  body('steps.*.instruction')
    .trim()
    .notEmpty()
    .withMessage('Step instruction text is required')
    .isLength({ max: 1000 }),
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/guides
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  [
    body('disasterType').isIn(DISASTER_TYPES).withMessage('Invalid disaster type'),
    body('language').isIn(SUPPORTED_LANGUAGES).withMessage('Unsupported language code'),
    body('title').trim().notEmpty().isLength({ max: 120 }),
    body('summary').optional().trim().isLength({ max: 300 }),
    body('isPublished').optional().isBoolean(),
    ...stepValidator,
  ],
  validate,
  async (req, res, next) => {
    try {
      const { disasterType, language, title, summary, steps, isPublished } = req.body;

      const guide = await SafetyGuide.create({
        disasterType,
        language,
        title,
        summary,
        steps,
        isPublished: isPublished ?? true,
        createdBy: req.admin._id,
      });

      res.status(201).json({ success: true, guide });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/guides
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('disasterType').optional().isIn(DISASTER_TYPES),
    query('language').optional().isIn(SUPPORTED_LANGUAGES),
    query('published').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.disasterType) filter.disasterType = req.query.disasterType;
      if (req.query.language) filter.language = req.query.language;
      if (req.query.published !== undefined)
        filter.isPublished = req.query.published === 'true';

      const guides = await SafetyGuide.find(filter)
        .sort({ disasterType: 1, language: 1 })
        .lean();

      res.json({ success: true, total: guides.length, guides });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/guides/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid guide ID')],
  validate,
  async (req, res, next) => {
    try {
      const guide = await SafetyGuide.findById(req.params.id);
      if (!guide) return res.status(404).json({ success: false, message: 'Safety guide not found' });
      res.json({ success: true, guide });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/guides/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid guide ID'),
    body('title').optional().trim().isLength({ max: 120 }),
    body('summary').optional().trim().isLength({ max: 300 }),
    body('isPublished').optional().isBoolean(),
    ...stepValidator.map((v) => v.optional()),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['title', 'summary', 'steps', 'isPublished'];
      const updates = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

      if (updates.steps) updates.version = undefined; // will be incremented below

      const guide = await SafetyGuide.findById(req.params.id);
      if (!guide) return res.status(404).json({ success: false, message: 'Safety guide not found' });

      Object.assign(guide, updates);
      if (updates.steps) guide.version += 1;
      await guide.save();

      res.json({ success: true, guide });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/guides/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid guide ID')],
  validate,
  async (req, res, next) => {
    try {
      const guide = await SafetyGuide.findByIdAndDelete(req.params.id);
      if (!guide) return res.status(404).json({ success: false, message: 'Safety guide not found' });
      res.json({ success: true, message: 'Safety guide deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
