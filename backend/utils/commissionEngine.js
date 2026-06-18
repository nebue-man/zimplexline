const db = require('../database');
const { getAncestors } = require('./hierarchyUtils');

async function getRates(client) {
  const result = await client.query('SELECT rate_key, rate_value FROM commission_rates');
  const rates = {};
  for (const row of result.rows) {
    rates[row.rate_key] = parseFloat(row.rate_value);
  }
  return rates;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function getOrCreateAgentUnlock(agentId, year, month, client) {
  const result = await client.query(
    `INSERT INTO monthly_agent_unlock (agent_id, year, month, total_own_deposits, is_unlocked)
     VALUES ($1, $2, $3, 0, false)
     ON CONFLICT (agent_id, year, month) DO UPDATE SET agent_id = EXCLUDED.agent_id
     RETURNING *`,
    [agentId, year, month]
  );
  return result.rows[0];
}

async function getOrCreateDepositTotal(userId, agentId, year, month, client) {
  const result = await client.query(
    `INSERT INTO monthly_deposit_totals (user_id, agent_id, year, month, total_deposits, rate_upgraded)
     VALUES ($1, $2, $3, $4, 0, false)
     ON CONFLICT (user_id, agent_id, year, month) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, agentId, year, month]
  );
  return result.rows[0];
}

async function calculate(transactionId, dbClient) {
  const client = dbClient || db;
  const commissions = [];

  const txResult = await client.query(
    'SELECT t.*, u.role, u.parent_id FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
    [transactionId]
  );
  if (txResult.rows.length === 0) return commissions;

  const tx = txResult.rows[0];
  const actor = { id: tx.user_id, role: tx.role, parent_id: tx.parent_id };
  const amount = parseFloat(tx.amount);
  const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date();
  const year = txDate.getFullYear();
  const month = txDate.getMonth() + 1;
  const isDeposit = tx.type === 'deposit';

  const rates = await getRates(client);
  const ancestors = await getAncestors(actor.id, client);
  // ancestors[0] is the actor itself; we want ancestors starting from parent
  const ancestorChain = ancestors.slice(1);

  const insertCommission = async (beneficiaryId, percentage, commAmount, commType) => {
    if (commAmount === 0 && commType !== 'agent_locked') return;
    const rounded = round2(commAmount);
    const result = await client.query(
      `INSERT INTO commissions (transaction_id, beneficiary_id, source_user_id, percentage, amount, commission_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [transactionId, beneficiaryId, actor.id, percentage, rounded, commType]
    );
    commissions.push(result.rows[0]);
  };

  if (actor.role === 'manager') {
    // Manager's own transaction
    const rate = isDeposit ? rates['manager_own_deposit'] : rates['manager_own_withdrawal'];
    const commType = isDeposit ? 'own_deposit' : 'own_withdrawal';
    await insertCommission(actor.id, rate, round2(amount * rate), commType);
    return commissions;
  }

  if (actor.role === 'agent') {
    // Agent's own transaction — manager above gets direct_agent commission
    const managerAncestor = ancestorChain.find((a) => a.role === 'manager');
    if (managerAncestor) {
      const rate = isDeposit ? rates['manager_direct_agent_deposit'] : rates['manager_direct_agent_withdrawal'];
      const commType = isDeposit ? 'direct_agent_deposit' : 'direct_agent_withdrawal';
      await insertCommission(managerAncestor.id, rate, round2(amount * rate), commType);
    }

    // Also update agent unlock for this agent
    if (isDeposit) {
      const unlockRecord = await client.query(
        'SELECT * FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
        [actor.id, year, month]
      );

      const currentTotal = unlockRecord.rows.length > 0 ? parseFloat(unlockRecord.rows[0].total_own_deposits) : 0;
      const newTotal = currentTotal + amount;
      const threshold = rates['agent_unlock_threshold'];
      const wasUnlocked = unlockRecord.rows.length > 0 && unlockRecord.rows[0].is_unlocked;
      const nowUnlocked = newTotal >= threshold;

      await client.query(
        `INSERT INTO monthly_agent_unlock (agent_id, year, month, total_own_deposits, is_unlocked, unlocked_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (agent_id, year, month) DO UPDATE
         SET total_own_deposits = $4,
             is_unlocked = $5,
             unlocked_at = CASE WHEN monthly_agent_unlock.is_unlocked = false AND $5 = true THEN NOW()
                                ELSE monthly_agent_unlock.unlocked_at END`,
        [actor.id, year, month, newTotal, nowUnlocked, nowUnlocked && !wasUnlocked ? new Date() : null]
      );
    }
    return commissions;
  }

  // actor is subagent or deeper
  // Find first agent ancestor
  const agentAncestor = ancestorChain.find((a) => a.role === 'agent');

  if (agentAncestor) {
    const unlockResult = await client.query(
      'SELECT * FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
      [agentAncestor.id, year, month]
    );

    const isAgentUnlocked = unlockResult.rows.length > 0 && unlockResult.rows[0].is_unlocked;

    if (!isAgentUnlocked) {
      // Agent locked — log agent_locked commission with amount 0
      await client.query(
        `INSERT INTO commissions (transaction_id, beneficiary_id, source_user_id, percentage, amount, commission_type)
         VALUES ($1, $2, $3, $4, $5, 'agent_locked')`,
        [transactionId, agentAncestor.id, actor.id, 0, 0]
      );
    } else {
      // Determine if actor is direct child of agent or deeper
      const isDirectChild = actor.parent_id === agentAncestor.id;

      if (isDeposit) {
        if (isDirectChild) {
          // Check monthly deposit total for this subagent under this agent
          const depositTotalResult = await client.query(
            'SELECT * FROM monthly_deposit_totals WHERE user_id = $1 AND agent_id = $2 AND year = $3 AND month = $4',
            [actor.id, agentAncestor.id, year, month]
          );
          const totalBefore = depositTotalResult.rows.length > 0
            ? parseFloat(depositTotalResult.rows[0].total_deposits)
            : 0;
          const rateUpgradedBefore = depositTotalResult.rows.length > 0 && depositTotalResult.rows[0].rate_upgraded;
          const threshold = rates['subagent_monthly_threshold'];
          const totalAfter = totalBefore + amount;

          let commAmount;
          if (rateUpgradedBefore) {
            commAmount = amount * rates['agent_direct_subagent_deposit_high'];
          } else if (totalBefore < threshold && totalAfter >= threshold) {
            // Split at boundary
            const belowPortion = threshold - totalBefore;
            const abovePortion = totalAfter - threshold;
            commAmount = belowPortion * rates['agent_direct_subagent_deposit_low']
              + abovePortion * rates['agent_direct_subagent_deposit_high'];
          } else {
            commAmount = amount * rates['agent_direct_subagent_deposit_low'];
          }

          // Update monthly deposit totals
          const nowUpgraded = rateUpgradedBefore || totalAfter >= threshold;
          await client.query(
            `INSERT INTO monthly_deposit_totals (user_id, agent_id, year, month, total_deposits, rate_upgraded)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, agent_id, year, month) DO UPDATE
             SET total_deposits = $5, rate_upgraded = $6`,
            [actor.id, agentAncestor.id, year, month, totalAfter, nowUpgraded]
          );

          const rateUsed = rateUpgradedBefore
            ? rates['agent_direct_subagent_deposit_high']
            : (totalBefore < threshold && totalAfter >= threshold)
              ? rates['agent_direct_subagent_deposit_low']
              : rates['agent_direct_subagent_deposit_low'];

          await insertCommission(agentAncestor.id, rateUsed, commAmount, 'direct_agent_deposit');
        }
        // Deeper sub-agent deposit: agent earns nothing — only direct sub-agents trigger agent commissions
      } else {
        // Withdrawal — agent only earns from direct sub-agents
        if (isDirectChild) {
          const rate = rates['agent_direct_subagent_withdrawal'];
          await insertCommission(agentAncestor.id, rate, round2(amount * rate), 'direct_agent_withdrawal');
        }
        // Deeper sub-agent withdrawal: agent earns nothing
      }
    }
  }

  // Find manager ancestor and apply manager rates
  const managerAncestor = ancestorChain.find((a) => a.role === 'manager');

  if (managerAncestor && agentAncestor) {
    // Determine relationship of actor to manager
    const isActorDirectAgentOfManager = actor.role === 'agent' && actor.parent_id === managerAncestor.id;
    // For subagents, the actor is always deeper than the manager
    const rate = isDeposit ? rates['manager_deep_team_deposit'] : rates['manager_deep_team_withdrawal'];
    const commType = isDeposit ? 'deep_team_deposit' : 'deep_team_withdrawal';
    await insertCommission(managerAncestor.id, rate, round2(amount * rate), commType);
  } else if (managerAncestor && !agentAncestor) {
    // Subagent directly under manager (edge case)
    const rate = isDeposit ? rates['manager_deep_team_deposit'] : rates['manager_deep_team_withdrawal'];
    const commType = isDeposit ? 'deep_team_deposit' : 'deep_team_withdrawal';
    await insertCommission(managerAncestor.id, rate, round2(amount * rate), commType);
  }

  return commissions;
}

module.exports = { calculate };
