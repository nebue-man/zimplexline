const jwt = require('jsonwebtoken');
const db = require('../database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7);

  if (!token) {
    return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication token required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query(
      'SELECT id, full_name, email, role, parent_id, verification_status, is_deleted FROM users WHERE id = $1',
      [payload.user_id]
    );

    if (result.rows.length === 0 || result.rows[0].is_deleted) {
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'User account not found or suspended.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Insufficient permissions for this action.' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
