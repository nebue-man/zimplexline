const db = require('../database');
const { isInDownline } = require('./hierarchyUtils');

async function validateTransactionTarget(recorderId, targetUserId, recorderRole, dbClient) {
  const client = dbClient || db;

  if (recorderRole === 'admin') return { valid: true };

  if (targetUserId === recorderId && process.env.ALLOW_SELF_RECORD === 'true') {
    return { valid: true };
  }

  const inDownline = await isInDownline(recorderId, targetUserId, client);
  if (!inDownline) {
    return { valid: false, reason: 'Target user is not in your downline.' };
  }

  return { valid: true };
}

function buildTransactionFilters(query, baseWhere, params) {
  const { type, date_from, date_to, search, min_amount, max_amount } = query;
  let whereClause = baseWhere || '';
  let paramIndex = params.length + 1;

  if (type) {
    whereClause += ` AND t.type = $${paramIndex++}`;
    params.push(type);
  }
  if (date_from) {
    whereClause += ` AND t.transaction_date >= $${paramIndex++}`;
    params.push(date_from);
  }
  if (date_to) {
    whereClause += ` AND t.transaction_date <= $${paramIndex++}`;
    params.push(date_to + 'T23:59:59.999Z');
  }
  if (search) {
    whereClause += ` AND (u.full_name ILIKE $${paramIndex} OR t.id::text ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (min_amount) {
    whereClause += ` AND t.amount >= $${paramIndex++}`;
    params.push(parseFloat(min_amount));
  }
  if (max_amount) {
    whereClause += ` AND t.amount <= $${paramIndex++}`;
    params.push(parseFloat(max_amount));
  }

  return { whereClause, params };
}

module.exports = { validateTransactionTarget, buildTransactionFilters };
