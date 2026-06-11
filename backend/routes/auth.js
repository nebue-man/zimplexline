const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, param } = require('express-validator');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { saveIdPhoto } = require('../utils/uploadHandler');
const { checkCapacity } = require('../utils/checkCapacity');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '8h';

function generateToken(user) {
  return jwt.sign(
    { user_id: user.id, role: user.role, parent_id: user.parent_id || null },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function formatUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email || undefined,
    dob: u.date_of_birth ? new Date(u.date_of_birth).toISOString().split('T')[0] : undefined,
    role: u.role,
    status: u.verification_status,
    parentId: u.parent_id || undefined,
    parentName: u.parent_name || undefined,
    childrenCount: parseInt(u.children_count || 0, 10),
    joinedAt: u.created_at ? new Date(u.created_at).toISOString() : null,
    idPhoto: u.id_photo_url || undefined,
    rejectReason: u.reject_reason || undefined,
  };
}

function isAtLeast18(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 18;
}

// POST /auth/signup — Admin registration
router.post(
  '/signup',
  [
    body('fullName').notEmpty().withMessage('Full name is required.').trim(),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('dob').notEmpty().withMessage('Date of birth is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fullName, email, dob, password } = req.body;

      if (!isAtLeast18(dob)) {
        return res.status(400).json({ success: false, code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old.' });
      }

      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await db.query(
        `INSERT INTO users (full_name, email, date_of_birth, password_hash, role, verification_status)
         VALUES ($1, $2, $3, $4, 'admin', 'approved')
         RETURNING id, full_name, role, parent_id`,
        [fullName, email, dob, passwordHash]
      );

      const user = result.rows[0];
      const token = generateToken(user);

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'admin_signup', $1, $2)`,
        [user.id, JSON.stringify({ email })]
      );

      return res.status(201).json({
        success: true,
        data: { token, user_id: user.id, role: user.role, full_name: user.full_name },
      });
    } catch (err) {
      console.error('Signup error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed. Please try again.' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Identifier is required.').trim(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { identifier, password } = req.body;

      const result = await db.query(
        `SELECT id, full_name, email, password_hash, role, parent_id, verification_status, reject_reason, is_deleted
         FROM users WHERE (full_name = $1 OR id::text = $1) AND is_deleted = false`,
        [identifier]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
      }

      const user = result.rows[0];

      if (user.verification_status === 'pending') {
        return res.status(403).json({ success: false, code: 'ACCOUNT_PENDING', message: 'Your account is pending verification.' });
      }

      if (user.verification_status === 'rejected') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_REJECTED',
          message: 'Your account has been rejected.',
          data: { rejectReason: user.reject_reason },
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
      }

      const token = generateToken(user);

      return res.json({
        success: true,
        data: { token, user_id: user.id, role: user.role, full_name: user.full_name, parent_id: user.parent_id },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Login failed.' });
    }
  }
);

// POST /auth/register — Invite link registration
router.post(
  '/register',
  [
    body('fullName').notEmpty().withMessage('Full name is required.').trim(),
    body('dob').notEmpty().withMessage('Date of birth is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Passwords do not match.');
      return true;
    }),
    body('parentId').notEmpty().withMessage('Parent ID is required.').isUUID().withMessage('Invalid parent ID.'),
    body('idPhoto').notEmpty().withMessage('ID photo is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fullName, dob, password, parentId, idPhoto } = req.body;

      if (!isAtLeast18(dob)) {
        return res.status(400).json({ success: false, code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old.' });
      }

      const parentResult = await db.query(
        'SELECT id, full_name, role FROM users WHERE id = $1 AND is_deleted = false AND verification_status = $2',
        [parentId, 'approved']
      );
      if (parentResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'PARENT_NOT_FOUND', message: 'Invite link is invalid or the inviter is not active.' });
      }

      const parent = parentResult.rows[0];

      const ROLE_MAP = { admin: 'manager', manager: 'agent', agent: 'subagent', subagent: 'subagent' };
      const childRole = ROLE_MAP[parent.role];

      const capacity = await checkCapacity(parentId);
      if (!capacity.allowed) {
        return res.status(409).json({ success: false, code: 'CAPACITY_EXCEEDED', message: capacity.reason });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const photoUrl = await saveIdPhoto(idPhoto);

      const result = await db.query(
        `INSERT INTO users (full_name, date_of_birth, password_hash, role, parent_id, verification_status, id_photo_url)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id, full_name, role`,
        [fullName, dob, passwordHash, childRole, parentId, photoUrl]
      );

      const newUser = result.rows[0];

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'user_registered', $2, $3)`,
        [parentId, newUser.id, JSON.stringify({ childRole, parentName: parent.full_name })]
      );

      return res.status(201).json({
        success: true,
        data: {
          user_id: newUser.id,
          message: `Registration submitted. ${parent.full_name} will review your ID.`,
          parent_name: parent.full_name,
        },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed.' });
    }
  }
);

// GET /auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.date_of_birth, u.role, u.verification_status,
              u.parent_id, u.id_photo_url, u.reject_reason, u.created_at,
              p.full_name AS parent_name,
              (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS children_count
       FROM users u
       LEFT JOIN users p ON p.id = u.parent_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
    }

    return res.json({ success: true, data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch profile.' });
  }
});

// GET /auth/parent-info/:parentId — Public
router.get(
  '/parent-info/:parentId',
  [param('parentId').isUUID().withMessage('Invalid parent ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, full_name, role FROM users WHERE id = $1 AND is_deleted = false AND verification_status = $2',
        [req.params.parentId, 'approved']
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Inviter not found or not active.' });
      }

      const u = result.rows[0];
      return res.json({ success: true, data: { id: u.id, fullName: u.full_name, role: u.role } });
    } catch (err) {
      console.error('Parent info error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch parent info.' });
    }
  }
);

// PATCH /auth/verify/:userId
router.patch(
  '/verify/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Invalid user ID.'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject.'),
    body('reason').custom((value, { req }) => {
      if (req.body.action === 'reject' && (!value || !value.trim())) {
        throw new Error('Rejection reason is required.');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { action, reason } = req.body;
      const requesterId = req.user.id;
      const requesterRole = req.user.role;

      const targetResult = await db.query(
        'SELECT id, full_name, parent_id, role, verification_status FROM users WHERE id = $1 AND is_deleted = false',
        [userId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const target = targetResult.rows[0];

      if (requesterRole !== 'admin' && target.parent_id !== requesterId) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You can only verify your own direct recruits.' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await db.query(
        `UPDATE users SET verification_status = $1, verified_by = $2, reject_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [newStatus, requesterId, action === 'reject' ? reason.trim() : null, userId]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)`,
        [requesterId, `verification_${newStatus}`, userId, JSON.stringify({ reason: reason || null })]
      );

      return res.json({
        success: true,
        data: { userId, status: newStatus, message: `User has been ${newStatus}.` },
      });
    } catch (err) {
      console.error('Verify error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Verification failed.' });
    }
  }
);

// PATCH /auth/resubmit-id
router.patch(
  '/resubmit-id',
  authenticateToken,
  [body('idPhoto').notEmpty().withMessage('ID photo is required.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      if (req.user.verification_status !== 'rejected') {
        return res.status(400).json({ success: false, code: 'INVALID_STATUS', message: 'You can only resubmit when your status is rejected.' });
      }

      const photoUrl = await saveIdPhoto(req.body.idPhoto);

      await db.query(
        `UPDATE users SET id_photo_url = $1, verification_status = 'pending', reject_reason = NULL, updated_at = NOW()
         WHERE id = $2`,
        [photoUrl, req.user.id]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id) VALUES ($1, 'id_resubmitted', $1)`,
        [req.user.id]
      );

      return res.json({ success: true, data: { message: 'ID photo resubmitted for review.' } });
    } catch (err) {
      console.error('Resubmit ID error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Resubmission failed.' });
    }
  }
);

module.exports = router;
