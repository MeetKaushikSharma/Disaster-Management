/**
 * Request Validation Helper
 *
 * Wraps express-validator's validationResult into a reusable middleware.
 * Apply AFTER the validation chain:
 *
 *   router.post('/event', [...validators], validate, handler)
 */

const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
