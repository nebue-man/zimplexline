const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

// GET /notifications
router.get(
  '/',
  authenticateToken,
  [
    query('is_read').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id: userId } = req.user;
      const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);
      let whereClause = 'WHERE n.recipient_id = $1';
      const params = [userId];

      if (req.query.is_read !== undefined) {
        whereClause += ` AND n.is_read = $2`;
        params.push(req.query.is_read === 'true');
      }

      const result = await db.query(
        `SELECT n.id, n.type, n.title, n.message, n.is_read, n.created_at,
                n.transaction_id, n.sender_id,
                s.full_name AS sender_name, s.role AS sender_role
         FROM notifications n
         JOIN users s ON s.id = n.sender_id
         ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT ${limit}`,
        params
      );

      return res.json({
        success: true,
        data: result.rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at ? new Date(n.created_at).toISOString() : null,
          transaction_id: n.transaction_id || null,
          sender_id: n.sender_id,
          sender: { full_name: n.sender_name, role: n.sender_role },
        })),
      });
    } catch (err) {
      console.error('List notifications error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch notifications.' });
    }
  }
);

// GET /notifications/unread-count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );
    return res.json({ success: true, data: { count: parseInt(result.rows[0].count, 10) } });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch unread count.' });
  }
});

// PATCH /notifications/:id/read
router.patch(
  '/:id/read',
  authenticateToken,
  [param('id').isUUID().withMessage('Invalid notification ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      await db.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2',
        [req.params.id, req.user.id]
      );
      return res.json({ success: true });
    } catch (err) {
      console.error('Mark read error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to mark notification as read.' });
    }
  }
);

// PATCH /notifications/read-all
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );
    return res.json({ success: true, data: { count: result.rowCount } });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to mark all as read.' });
  }
});

module.exports = router;
