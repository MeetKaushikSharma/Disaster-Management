/**
 * Auth Routes  —  /api/auth
 *
 * POST /api/auth/login          Admin login → returns JWT
 * POST /api/auth/seed-admin     Create the first super-admin (disabled in prod)
 * GET  /api/auth/me             Return current admin profile (protected)
 * POST /api/auth/change-password Change password (protected)
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const AdminUser = require('../models/AdminUser');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ── Rate limiter: 10 login attempts per 15 min per IP ─────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Helper: sign JWT ──────────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const admin = await AdminUser.findOne({ email }).select('+passwordHash');
      if (!admin) {
        // Generic message to prevent user enumeration
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Brute-force lock check
      if (admin.isLocked()) {
        return res.status(423).json({
          success: false,
          message: `Account locked until ${admin.lockedUntil.toISOString()}`,
        });
      }

      if (!admin.isActive) {
        return res.status(401).json({ success: false, message: 'Account inactive' });
      }

      if (!admin.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Account pending verification by super-admin',
        });
      }

      const isMatch = await admin.comparePassword(password);

      if (!isMatch) {
        admin.loginAttempts += 1;
        // Lock after 5 failed attempts for 30 minutes
        if (admin.loginAttempts >= 5) {
          admin.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          admin.loginAttempts = 0;
        }
        await admin.save();
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Success — reset brute-force counters
      admin.loginAttempts = 0;
      admin.lockedUntil = undefined;
      admin.lastLoginAt = new Date();
      admin.lastLoginIp = req.ip;
      await admin.save();

      const token = signToken(admin._id);
      res.json({
        success: true,
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/seed-admin  (disabled in production)
// Creates the very first super-admin account.
// Protected by SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/seed-admin', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not available in production' });
  }

  try {
    const existing = await AdminUser.findOne({ role: 'super_admin' });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Super-admin already exists' });
    }

    const admin = await AdminUser.create({
      name: 'Super Admin',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@disaster.gov.in',
      passwordHash: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123',
      role: 'super_admin',
      isVerified: true,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Super-admin created',
      id: admin._id,
      email: admin.email,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password  (protected)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain a digit'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const admin = await AdminUser.findById(req.admin._id).select('+passwordHash');
      const isMatch = await admin.comparePassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      admin.passwordHash = req.body.newPassword; // pre-save hook will hash it
      await admin.save();
      res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
