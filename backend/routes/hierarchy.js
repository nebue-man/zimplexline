const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { getDownline, getCapacityInfo } = require('../utils/hierarchyUtils');
const db = require('../database');

// GET /hierarchy/downline/:userId
router.get(
  '/downline/:userId',
  authenticateToken,
  [param('userId').isUUID().withMessage('Invalid user ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.user.id;
      const requesterRole = req.user.role;

      // Only admin can view arbitrary user's downline; others can only view own
      if (requesterRole !== 'admin' && userId !== requesterId) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You can only view your own downline.' });
      }

      const targetResult = await db.query(
        'SELECT id FROM users WHERE id = $1 AND is_deleted = false',
        [userId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const downline = await getDownline(userId);

      return res.json({ success: true, data: downline });
    } catch (err) {
      console.error('Downline error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch downline.' });
    }
  }
);

// GET /hierarchy/capacity/:userId
router.get(
  '/capacity/:userId',
  authenticateToken,
  [param('userId').isUUID().withMessage('Invalid user ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.user.id;
      const requesterRole = req.user.role;

      if (requesterRole !== 'admin' && userId !== requesterId) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
      }

      const targetResult = await db.query(
        'SELECT id FROM users WHERE id = $1 AND is_deleted = false',
        [userId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const capacity = await getCapacityInfo(userId);
      return res.json({ success: true, data: capacity });
    } catch (err) {
      console.error('Capacity error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch capacity.' });
    }
  }
);

module.exports = router;
