/**
 * AdminUser Schema
 *
 * Represents a verified administrator who can create / manage disaster events.
 * Passwords are hashed with bcryptjs — never stored in plain text.
 *
 * Basic verification workflow:
 *   1. Super-admin creates accounts manually (or via seed script).
 *   2. New admin logs in → receives a JWT.
 *   3. JWT is passed as Bearer token on every protected route.
 *   4. Role field enables future RBAC expansion (e.g., "viewer" vs "editor").
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
      maxlength: [80, 'Name must be ≤ 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
    },

    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },

    role: {
      type: String,
      enum: ['super_admin', 'admin', 'sdma_operator', 'researcher', 'viewer'],
      default: 'admin',
    },

    // ── Regional assignment for State / District Authorities ───────────────────
    assignedState: {
      type: String,
      trim: true,
      default: 'Uttar Pradesh',
    },
    assignedDistricts: [{
      type: String,
      trim: true,
    }],

    // ── Account health ────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // set to true after manual verification

    // Brute-force protection
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,

    lastLoginAt: Date,
    lastLoginIp: String,
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
adminUserSchema.index({ role: 1, isActive: 1 });
adminUserSchema.index({ assignedState: 1, role: 1 });

// ── Password hashing hook ─────────────────────────────────────────────────────
adminUserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ── Instance method: compare plain-text password ──────────────────────────────
adminUserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// ── Instance method: check if account is locked ───────────────────────────────
adminUserSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > new Date();
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
