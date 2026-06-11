const { validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
}

module.exports = { handleValidationErrors };
