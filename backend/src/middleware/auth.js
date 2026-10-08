/**
 * JWT Authentication Middleware
 *
 * Protects admin routes. Expects "Authorization: Bearer <token>" header.
 * Attaches decoded admin payload to req.admin for downstream handlers.
 */

const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch admin from DB to ensure account still active / not deleted
    const admin = await AdminUser.findById(decoded.id).select('-passwordHash');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Admin account not found or inactive' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Role-gating middleware factory.
 * Usage: router.delete('/event/:id', protect, requireRole('super_admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) {
    return res
      .status(403)
      .json({ success: false, message: `Role "${req.admin?.role}" is not authorised for this action` });
  }
  next();
};

module.exports = { protect, requireRole };
