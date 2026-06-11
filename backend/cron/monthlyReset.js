const cron = require('node-cron');
const db = require('../database');

function scheduleMontlyReset() {
  // Runs at 00:01 on the 1st of every month
  cron.schedule('1 0 1 * *', async () => {
    const now = new Date();
    const resetYear = now.getFullYear();
    const resetMonth = now.getMonth() + 1;

    // The month we're resetting INTO. Previous month is stored; new month rows will be
    // created fresh on first activity. No rows are deleted — reset means the new month
    // starts clean, old months remain for historical reporting.
    const prevMonth = resetMonth === 1 ? 12 : resetMonth - 1;
    const prevYear = resetMonth === 1 ? resetYear - 1 : resetYear;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify no rows already exist for the new month (idempotency guard)
      const existingUnlock = await client.query(
        'SELECT COUNT(*) FROM monthly_agent_unlock WHERE year = $1 AND month = $2',
        [resetYear, resetMonth]
      );
      if (parseInt(existingUnlock.rows[0].count, 10) === 0) {
        // Seed new-month rows for all active agents, pre-initialised to 0/locked
        await client.query(
          `INSERT INTO monthly_agent_unlock (agent_id, year, month, total_own_deposits, is_unlocked)
           SELECT id, $1, $2, 0, false
           FROM users
           WHERE role = 'agent' AND is_deleted = false AND verification_status = 'approved'
           ON CONFLICT (agent_id, year, month) DO NOTHING`,
          [resetYear, resetMonth]
        );
      }

      const existingDeposits = await client.query(
        'SELECT COUNT(*) FROM monthly_deposit_totals WHERE year = $1 AND month = $2',
        [resetYear, resetMonth]
      );
      if (parseInt(existingDeposits.rows[0].count, 10) === 0) {
        // Seed new-month deposit total rows for all active subagent/agent pairs
        await client.query(
          `INSERT INTO monthly_deposit_totals (user_id, agent_id, year, month, total_deposits, rate_upgraded)
           SELECT DISTINCT mdt.user_id, mdt.agent_id, $1, $2, 0, false
           FROM monthly_deposit_totals mdt
           JOIN users u ON u.id = mdt.user_id AND u.is_deleted = false
           JOIN users a ON a.id = mdt.agent_id AND a.is_deleted = false
           WHERE mdt.year = $3 AND mdt.month = $4
           ON CONFLICT (user_id, agent_id, year, month) DO NOTHING`,
          [resetYear, resetMonth, prevYear, prevMonth]
        );
      }

      // Log the reset event
      const adminResult = await client.query(
        "SELECT id FROM users WHERE role = 'admin' AND is_deleted = false ORDER BY created_at ASC LIMIT 1"
      );
      if (adminResult.rows.length > 0) {
        await client.query(
          `INSERT INTO audit_logs (actor_id, action, metadata) VALUES ($1, 'monthly_reset', $2)`,
          [
            adminResult.rows[0].id,
            JSON.stringify({ resetYear, resetMonth, triggeredAt: now.toISOString() }),
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`[CRON] Monthly reset complete for ${resetYear}-${String(resetMonth).padStart(2, '0')}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[CRON] Monthly reset failed:', err.message);
    } finally {
      client.release();
    }
  });

  console.log('[CRON] Monthly reset job scheduled (1st of each month at 00:01)');
}

module.exports = { scheduleMontlyReset };
