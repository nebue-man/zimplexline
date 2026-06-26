const db = require('../database');

const CAPACITY_LIMITS = { admin: 10, manager: 5, agent: 10, subagent: 10, direct_agent: 10 };

async function checkCapacity(parentId, dbClient) {
  const client = dbClient || db;

  const parentResult = await client.query(
    'SELECT id, role FROM users WHERE id = $1 AND is_deleted = false',
    [parentId]
  );
  if (parentResult.rows.length === 0) {
    return { allowed: false, reason: 'Parent user not found.' };
  }

  const parent = parentResult.rows[0];
  const maxChildren = CAPACITY_LIMITS[parent.role];

  if (maxChildren === undefined) {
    return { allowed: false, reason: 'This role cannot recruit members.' };
  }

  const countResult = await client.query(
    'SELECT COUNT(*) FROM users WHERE parent_id = $1 AND is_deleted = false',
    [parentId]
  );
  const currentCount = parseInt(countResult.rows[0].count, 10);

  if (currentCount >= maxChildren) {
    return { allowed: false, reason: `Maximum capacity of ${maxChildren} members reached for this ${parent.role}.` };
  }

  return { allowed: true };
}

module.exports = { checkCapacity };
