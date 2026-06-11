const db = require('../database');

async function getAdminSummary(dbClient) {
  const client = dbClient || db;

  const usersResult = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'manager') AS manager_count,
       COUNT(*) FILTER (WHERE role = 'agent') AS agent_count,
       COUNT(*) FILTER (WHERE role = 'subagent') AS subagent_count,
       COUNT(*) AS total_users
     FROM users WHERE is_deleted = false`
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const txResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS volume
     FROM transactions WHERE transaction_date >= $1`,
    [startOfMonth]
  );

  const commResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM commissions WHERE created_at >= $1 AND commission_type != 'agent_locked'`,
    [startOfMonth]
  );

  const pendingResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE verification_status = 'pending' AND is_deleted = false`
  );

  const u = usersResult.rows[0];
  return {
    totalUsers: parseInt(u.total_users, 10),
    managerCount: parseInt(u.manager_count, 10),
    agentCount: parseInt(u.agent_count, 10),
    subagentCount: parseInt(u.subagent_count, 10),
    transactionVolumeThisMonth: parseFloat(txResult.rows[0].volume),
    totalCommissionsPaidThisMonth: parseFloat(commResult.rows[0].total),
    pendingVerifications: parseInt(pendingResult.rows[0].count, 10),
  };
}

async function getManagerSummary(userId, dbClient) {
  const client = dbClient || db;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const thisMonthResult = await client.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE commission_type IN ('own_deposit','own_withdrawal')), 0) AS self,
       COALESCE(SUM(amount) FILTER (WHERE commission_type IN ('direct_agent_deposit','direct_agent_withdrawal')), 0) AS direct_agents,
       COALESCE(SUM(amount) FILTER (WHERE commission_type IN ('deep_team_deposit','deep_team_withdrawal')), 0) AS deep_team,
       COALESCE(SUM(amount), 0) AS total_this_month
     FROM commissions WHERE beneficiary_id = $1 AND created_at >= $2 AND commission_type != 'agent_locked'`,
    [userId, startOfMonth]
  );

  const allTimeResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS all_time
     FROM commissions WHERE beneficiary_id = $1 AND commission_type != 'agent_locked'`,
    [userId]
  );

  const teamResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE parent_id = $1 AND is_deleted = false`,
    [userId]
  );

  const pendingResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE parent_id = $1 AND verification_status = 'pending' AND is_deleted = false`,
    [userId]
  );

  const r = thisMonthResult.rows[0];
  return {
    totalEarningsThisMonth: parseFloat(r.total_this_month),
    allTimeEarnings: parseFloat(allTimeResult.rows[0].all_time),
    earningsFromOwn: parseFloat(r.self),
    earningsFromDirect: parseFloat(r.direct_agents),
    earningsFromDeep: parseFloat(r.deep_team),
    teamSize: parseInt(teamResult.rows[0].count, 10),
    pendingVerifications: parseInt(pendingResult.rows[0].count, 10),
    breakdown: {
      self: parseFloat(r.self),
      directAgents: parseFloat(r.direct_agents),
      deepTeam: parseFloat(r.deep_team),
    },
  };
}

async function getAgentSummary(userId, dbClient) {
  const client = dbClient || db;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const thisMonthResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM commissions WHERE beneficiary_id = $1 AND created_at >= $2 AND commission_type != 'agent_locked'`,
    [userId, startOfMonth]
  );

  const allTimeResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS all_time
     FROM commissions WHERE beneficiary_id = $1 AND commission_type != 'agent_locked'`,
    [userId]
  );

  const teamResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE parent_id = $1 AND is_deleted = false`,
    [userId]
  );

  const pendingResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE parent_id = $1 AND verification_status = 'pending' AND is_deleted = false`,
    [userId]
  );

  const unlockResult = await client.query(
    'SELECT * FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
    [userId, year, month]
  );

  const ratesResult = await client.query(
    'SELECT rate_value FROM commission_rates WHERE rate_key = $1',
    ['agent_unlock_threshold']
  );
  const threshold = ratesResult.rows.length > 0 ? parseFloat(ratesResult.rows[0].rate_value) : 10000;

  const unlockRow = unlockResult.rows[0];
  const totalOwnDeposits = unlockRow ? parseFloat(unlockRow.total_own_deposits) : 0;
  const isUnlocked = unlockRow ? unlockRow.is_unlocked : false;

  return {
    totalEarningsThisMonth: parseFloat(thisMonthResult.rows[0].total),
    allTimeEarnings: parseFloat(allTimeResult.rows[0].all_time),
    teamSize: parseInt(teamResult.rows[0].count, 10),
    pendingVerifications: parseInt(pendingResult.rows[0].count, 10),
    agentMonthlyDepositTotal: totalOwnDeposits,
    agentIsUnlocked: isUnlocked,
    agentUnlockStatus: {
      isUnlocked,
      totalOwnDeposits,
      threshold,
      remaining: Math.max(0, threshold - totalOwnDeposits),
      unlockedAt: unlockRow && unlockRow.unlocked_at ? unlockRow.unlocked_at.toISOString() : null,
    },
  };
}

async function getSubagentSummary(userId, dbClient) {
  const client = dbClient || db;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const thisMonthResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM commissions WHERE beneficiary_id = $1 AND created_at >= $2 AND commission_type != 'agent_locked'`,
    [userId, startOfMonth]
  );

  const allTimeResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS all_time
     FROM commissions WHERE beneficiary_id = $1 AND commission_type != 'agent_locked'`,
    [userId]
  );

  const txThisMonthResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS volume
     FROM transactions WHERE user_id = $1 AND transaction_date >= $2`,
    [userId, startOfMonth]
  );

  const subagentMonthlyDepositResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions WHERE user_id = $1 AND type = 'deposit' AND transaction_date >= $2`,
    [userId, startOfMonth]
  );

  return {
    earningsThisMonth: parseFloat(thisMonthResult.rows[0].total),
    allTimeEarnings: parseFloat(allTimeResult.rows[0].all_time),
    myTransactionsThisMonth: parseFloat(txThisMonthResult.rows[0].volume),
    subagentMonthlyDepositTotal: parseFloat(subagentMonthlyDepositResult.rows[0].total),
  };
}

async function getEarningsHistory(userId, role, period, groupBy, dbClient) {
  const client = dbClient || db;
  const now = new Date();

  let startDate;
  if (period === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === '90d') {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date('2000-01-01');
  }

  let dateTruncUnit;
  if (groupBy === 'week') {
    dateTruncUnit = 'week';
  } else if (groupBy === 'month') {
    dateTruncUnit = 'month';
  } else {
    dateTruncUnit = 'day';
  }

  const trendResult = await client.query(
    `SELECT
       DATE_TRUNC($1, created_at) AS period,
       COALESCE(SUM(amount), 0) AS total_earned
     FROM commissions
     WHERE beneficiary_id = $2
       AND created_at >= $3
       AND commission_type != 'agent_locked'
     GROUP BY DATE_TRUNC($1, created_at)
     ORDER BY DATE_TRUNC($1, created_at)`,
    [dateTruncUnit, userId, startDate.toISOString()]
  );

  const trend = trendResult.rows.map((r) => ({
    date: r.period ? new Date(r.period).toISOString() : null,
    amount: parseFloat(r.total_earned),
    month: r.period ? new Date(r.period).toLocaleDateString('en-US', { month: 'short' }) : '',
  }));

  // Recent transactions (last 5 from downline for managers/agents, own for subagents)
  let recentTx = [];
  if (role === 'admin' || role === 'manager' || role === 'agent') {
    const txResult = await client.query(
      `WITH RECURSIVE downline AS (
         SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
         UNION ALL
         SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
       )
       SELECT t.id, u.full_name AS user_name, u.role AS user_role, t.type, t.amount, t.transaction_date AS date
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.user_id IN (SELECT id FROM downline) OR t.user_id = $1
       ORDER BY t.transaction_date DESC
       LIMIT 5`,
      [userId]
    );
    recentTx = txResult.rows.map((r) => ({
      id: r.id,
      userName: r.user_name,
      userRole: r.user_role,
      type: r.type,
      amount: parseFloat(r.amount),
      date: r.date ? new Date(r.date).toISOString() : null,
    }));
  } else {
    const txResult = await client.query(
      `SELECT id, type, amount, transaction_date AS date FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC LIMIT 5`,
      [userId]
    );
    recentTx = txResult.rows.map((r) => ({
      id: r.id,
      userName: '',
      userRole: role,
      type: r.type,
      amount: parseFloat(r.amount),
      date: r.date ? new Date(r.date).toISOString() : null,
    }));
  }

  return { trend, recentTransactions: recentTx };
}

async function getSystemStats(dbClient) {
  const client = dbClient || db;

  const totalCommResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM commissions WHERE commission_type != 'agent_locked'`
  );
  const totalTxResult = await client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions`);
  const roleCountResult = await client.query(
    `SELECT role, COUNT(*) FROM users WHERE is_deleted = false AND role != 'admin' GROUP BY role`
  );
  const totalUsersByRole = {};
  for (const row of roleCountResult.rows) totalUsersByRole[row.role] = parseInt(row.count, 10);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonthUsersResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE created_at >= $1 AND is_deleted = false AND role != 'admin'`,
    [thisMonthStart.toISOString()]
  );
  const lastMonthUsersResult = await client.query(
    `SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2 AND is_deleted = false AND role != 'admin'`,
    [lastMonthStart.toISOString(), thisMonthStart.toISOString()]
  );
  const thisMonthUsers = parseInt(thisMonthUsersResult.rows[0].count, 10);
  const lastMonthUsers = parseInt(lastMonthUsersResult.rows[0].count, 10);
  const monthlyGrowthRate = lastMonthUsers > 0 ? ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;

  const top10Result = await client.query(
    `SELECT u.id, u.full_name AS name, u.role, COALESCE(SUM(c.amount), 0) AS total_earned
     FROM users u
     LEFT JOIN commissions c ON c.beneficiary_id = u.id AND c.commission_type != 'agent_locked'
     WHERE u.is_deleted = false AND u.role != 'admin'
     GROUP BY u.id, u.full_name, u.role
     ORDER BY total_earned DESC
     LIMIT 10`
  );

  const leaderboard = top10Result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    totalEarned: parseFloat(r.total_earned),
  }));

  return {
    totalCommissionsAllTime: parseFloat(totalCommResult.rows[0].total),
    totalTransactionVolume: parseFloat(totalTxResult.rows[0].total),
    totalUsersByRole,
    monthlyGrowthRate: Math.round(monthlyGrowthRate * 100) / 100,
    top10Earners: leaderboard,
    leaderboard,
  };
}

module.exports = { getAdminSummary, getManagerSummary, getAgentSummary, getSubagentSummary, getEarningsHistory, getSystemStats };
