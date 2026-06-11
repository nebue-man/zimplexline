const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /commissions
router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).withMessage(`limit must be 1-${MAX_LIMIT}.`),
    query('type').optional().isString(),
    query('date_from').optional().isISO8601().withMessage('date_from must be ISO 8601.'),
    query('date_to').optional().isISO8601().withMessage('date_to must be ISO 8601.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id: userId, role } = req.user;
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;

      const params = [];
      let whereClause = '';

      if (role === 'admin') {
        whereClause = 'WHERE c.commission_type != $1';
        params.push('agent_locked');
      } else {
        whereClause = 'WHERE c.beneficiary_id = $1 AND c.commission_type != $2';
        params.push(userId, 'agent_locked');
      }

      let paramIndex = params.length + 1;

      if (req.query.type) {
        whereClause += ` AND c.commission_type = $${paramIndex++}`;
        params.push(req.query.type);
      }
      if (req.query.date_from) {
        whereClause += ` AND c.created_at >= $${paramIndex++}`;
        params.push(req.query.date_from);
      }
      if (req.query.date_to) {
        whereClause += ` AND c.created_at <= $${paramIndex++}`;
        params.push(req.query.date_to + 'T23:59:59.999Z');
      }

      const countResult = await db.query(
        `SELECT COUNT(*) FROM commissions c ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `SELECT c.id, c.transaction_id AS "transactionId", c.beneficiary_id AS "beneficiaryId",
                b.full_name AS "beneficiaryName", b.role AS "beneficiaryRole",
                c.source_user_id AS "sourceUserId", s.full_name AS "sourceName",
                c.commission_type AS type, c.percentage, c.amount, c.created_at AS date
         FROM commissions c
         JOIN users b ON b.id = c.beneficiary_id
         JOIN users s ON s.id = c.source_user_id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const commissions = dataResult.rows.map((c) => ({
        id: c.id,
        transactionId: c.transactionId,
        beneficiaryId: c.beneficiaryId,
        beneficiaryName: c.beneficiaryName,
        beneficiaryRole: c.beneficiaryRole,
        sourceUserId: c.sourceUserId,
        sourceName: c.sourceName,
        type: c.type,
        percentage: parseFloat(c.percentage),
        amount: parseFloat(c.amount),
        date: c.date ? new Date(c.date).toISOString() : null,
      }));

      return res.json({
        success: true,
        data: {
          commissions,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      });
    } catch (err) {
      console.error('List commissions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch commissions.' });
    }
  }
);

module.exports = router;
