const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getAdminSummary,
  getManagerSummary,
  getAgentSummary,
  getSubagentSummary,
  getDirectAgentSummary,
  getEarningsHistory,
} = require('../utils/dashboardQueries');
const db = require('../database');

// GET /dashboard/summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let data;

    if (role === 'admin') {
      data = await getAdminSummary(userId);
    } else if (role === 'manager') {
      data = await getManagerSummary(userId);
    } else if (role === 'agent') {
      data = await getAgentSummary(userId);
    } else if (role === 'direct_agent') {
      data = await getDirectAgentSummary(userId);
    } else {
      data = await getSubagentSummary(userId);
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch summary.' });
  }
});

// GET /dashboard/team
router.get('/team', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role === 'admin') {
      const result = await db.query(
        `SELECT u.id, u.full_name AS "fullName", u.role, u.verification_status AS status,
                u.parent_id AS "parentId", p.full_name AS "parentName",
                u.created_at AS "joinedAt",
                (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS "childrenCount"
         FROM users u
         LEFT JOIN users p ON p.id = u.parent_id
         WHERE u.is_deleted = false AND u.role != 'admin'
         ORDER BY u.created_at DESC`
      );
      return res.json({ success: true, data: result.rows.map(formatTeamMember) });
    }

    const result = await db.query(
      `WITH RECURSIVE downline AS (
         SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
         UNION ALL
         SELECT u.id FROM users u
         INNER JOIN downline d ON u.parent_id = d.id
         WHERE u.is_deleted = false
       )
       SELECT u.id, u.full_name AS "fullName", u.role, u.verification_status AS status,
              u.parent_id AS "parentId", p.full_name AS "parentName",
              u.created_at AS "joinedAt",
              (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS "childrenCount"
       FROM users u
       LEFT JOIN users p ON p.id = u.parent_id
       WHERE u.id IN (SELECT id FROM downline)
       ORDER BY u.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, data: result.rows.map(formatTeamMember) });
  } catch (err) {
    console.error('Team error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch team.' });
  }
});

function formatTeamMember(u) {
  return {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    parentId: u.parentId || undefined,
    parentName: u.parentName || undefined,
    joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : null,
    childrenCount: parseInt(u.childrenCount || 0, 10),
  };
}

// GET /dashboard/earnings-history
router.get(
  '/earnings-history',
  authenticateToken,
  [
    query('period').optional().isIn(['30d', '90d', 'all']).withMessage('period must be 30d, 90d, or all.'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('groupBy must be day, week, or month.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id: userId, role } = req.user;
      const period = req.query.period || '30d';
      const groupBy = req.query.groupBy || 'day';

      const data = await getEarningsHistory(userId, role, period, groupBy);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('Earnings history error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch earnings history.' });
    }
  }
);

// GET /dashboard/pending-verifications
router.get('/pending-verifications', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    let result;
    if (role === 'admin') {
      result = await db.query(
        `WITH RECURSIVE my_hierarchy AS (
           SELECT id FROM users WHERE parent_id = $1
           UNION ALL
           SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
         )
         SELECT u.id, u.full_name AS "fullName", u.role, u.id_photo_url AS "idPhoto",
                u.promo_screenshot_url AS "promoScreenshotUrl",
                u.date_of_birth AS dob, u.created_at AS "joinedAt",
                p.full_name AS "parentName", u.parent_id AS "parentId"
         FROM users u
         LEFT JOIN users p ON p.id = u.parent_id
         WHERE u.id IN (SELECT id FROM my_hierarchy)
           AND u.verification_status = 'pending'
           AND u.is_deleted = false
         ORDER BY u.created_at ASC`,
        [userId]
      );
    } else {
      result = await db.query(
        `SELECT u.id, u.full_name AS "fullName", u.role, u.id_photo_url AS "idPhoto",
                u.promo_screenshot_url AS "promoScreenshotUrl",
                u.date_of_birth AS dob, u.created_at AS "joinedAt",
                p.full_name AS "parentName", u.parent_id AS "parentId"
         FROM users u
         LEFT JOIN users p ON p.id = u.parent_id
         WHERE u.parent_id = $1 AND u.verification_status = 'pending' AND u.is_deleted = false
         ORDER BY u.created_at ASC`,
        [userId]
      );
    }

    const items = result.rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      idPhoto: u.idPhoto || undefined,
      promo_screenshot_url: u.promoScreenshotUrl || undefined,
      dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : null,
      joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : null,
      parentName: u.parentName || null,
      parentId: u.parentId || null,
    }));

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('Pending verifications error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch pending verifications.' });
  }
});

// GET /dashboard/subagent-thresholds
router.get('/subagent-thresholds', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'agent' && role !== 'admin' && role !== 'direct_agent') {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only agents can view subagent thresholds.' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const ratesResult = await db.query(
      'SELECT rate_value FROM commission_rates WHERE rate_key = $1',
      ['subagent_monthly_threshold']
    );
    const threshold = ratesResult.rows.length > 0 ? parseFloat(ratesResult.rows[0].rate_value) : 20000;

    const result = await db.query(
      `SELECT u.id, u.full_name AS name, u.role,
              COALESCE(mdt.total_deposits, 0) AS total_deposits,
              COALESCE(mdt.rate_upgraded, false) AS rate_upgraded
       FROM users u
       LEFT JOIN monthly_deposit_totals mdt
         ON mdt.user_id = u.id AND mdt.agent_id = $1 AND mdt.year = $2 AND mdt.month = $3
       WHERE u.parent_id = $1 AND u.is_deleted = false AND u.verification_status = 'approved'`,
      [userId, year, month]
    );

    const data = result.rows.map((r) => ({
      userId: r.id,
      name: r.name,
      role: r.role,
      totalDepositsThisMonth: parseFloat(r.total_deposits),
      threshold,
      remaining: Math.max(0, threshold - parseFloat(r.total_deposits)),
      rateUpgraded: r.rate_upgraded,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Subagent thresholds error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch thresholds.' });
  }
});

// GET /dashboard/agent-unlock-status
router.get('/agent-unlock-status', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'agent' && role !== 'admin' && role !== 'direct_agent') {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only agents can view unlock status.' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const thresholdKey = role === 'direct_agent' ? 'direct_agent_unlock_threshold' : 'agent_unlock_threshold';
    const ratesResult = await db.query(
      'SELECT rate_value FROM commission_rates WHERE rate_key = $1',
      [thresholdKey]
    );
    const threshold = ratesResult.rows.length > 0 ? parseFloat(ratesResult.rows[0].rate_value) : 10000;

    const unlockResult = await db.query(
      'SELECT * FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
      [userId, year, month]
    );

    const row = unlockResult.rows[0];
    const totalOwnDeposits = row ? parseFloat(row.total_own_deposits) : 0;
    const isUnlocked = row ? row.is_unlocked : false;

    return res.json({
      success: true,
      data: {
        isUnlocked,
        totalOwnDeposits,
        threshold,
        remaining: Math.max(0, threshold - totalOwnDeposits),
        unlockedAt: row && row.unlocked_at ? new Date(row.unlocked_at).toISOString() : null,
      },
    });
  } catch (err) {
    console.error('Agent unlock status error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch unlock status.' });
  }
});

module.exports = router;
