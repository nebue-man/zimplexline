const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const adminOnly = [authenticateToken, authorizeRoles('admin')];

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
                n.transaction_id, n.sender_id, n.metadata,
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
          metadata: n.metadata || null,
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

// PATCH /notifications/:id/approve-commissions — Admin only
router.patch(
  '/:id/approve-commissions',
  ...adminOnly,
  [param('id').isUUID().withMessage('Invalid notification ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const notifResult = await db.query(
        'SELECT id, metadata, recipient_id FROM notifications WHERE id = $1',
        [req.params.id]
      );
      if (notifResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Notification not found.' });
      }

      const notif = notifResult.rows[0];
      if (notif.recipient_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
      }

      const transactionId = notif.metadata?.transaction_id;
      if (!transactionId) {
        return res.status(400).json({ success: false, code: 'NO_TRANSACTION', message: 'No transaction linked to this notification.' });
      }

      const updateResult = await db.query(
        `UPDATE commissions SET commission_status = 'approved'
         WHERE transaction_id = $1 AND commission_status = 'pending'`,
        [transactionId]
      );

      await db.query(
        'UPDATE notifications SET is_read = true WHERE id = $1',
        [req.params.id]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'COMMISSIONS_APPROVED', $1, $2)`,
        [req.user.id, JSON.stringify({ transaction_id: transactionId, notification_id: req.params.id, commission_count: updateResult.rowCount })]
      );

      return res.json({
        success: true,
        data: { approved_count: updateResult.rowCount, transaction_id: transactionId },
      });
    } catch (err) {
      console.error('Approve commissions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to approve commissions.' });
    }
  }
);

// PATCH /notifications/:id/reject-commissions — Admin only
router.patch(
  '/:id/reject-commissions',
  ...adminOnly,
  [
    param('id').isUUID().withMessage('Invalid notification ID.'),
    body('reason').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const notifResult = await db.query(
        'SELECT id, metadata, recipient_id FROM notifications WHERE id = $1',
        [req.params.id]
      );
      if (notifResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Notification not found.' });
      }

      const notif = notifResult.rows[0];
      if (notif.recipient_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
      }

      const transactionId = notif.metadata?.transaction_id;
      if (!transactionId) {
        return res.status(400).json({ success: false, code: 'NO_TRANSACTION', message: 'No transaction linked to this notification.' });
      }

      const updateResult = await db.query(
        `UPDATE commissions SET commission_status = 'rejected'
         WHERE transaction_id = $1 AND commission_status = 'pending'`,
        [transactionId]
      );

      await db.query(
        'UPDATE notifications SET is_read = true WHERE id = $1',
        [req.params.id]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'COMMISSIONS_REJECTED', $1, $2)`,
        [req.user.id, JSON.stringify({ transaction_id: transactionId, notification_id: req.params.id, reason: req.body.reason || null })]
      );

      return res.json({
        success: true,
        data: { rejected_count: updateResult.rowCount, transaction_id: transactionId },
      });
    } catch (err) {
      console.error('Reject commissions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to reject commissions.' });
    }
  }
);

module.exports = router;
