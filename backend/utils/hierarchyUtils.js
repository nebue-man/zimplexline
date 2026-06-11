const db = require('../database');

async function getAncestors(userId, dbClient) {
  const client = dbClient || db;
  const ancestors = [];
  let currentId = userId;

  while (currentId) {
    const result = await client.query(
      'SELECT id, full_name, role, parent_id FROM users WHERE id = $1 AND is_deleted = false',
      [currentId]
    );
    if (result.rows.length === 0) break;
    const user = result.rows[0];
    if (ancestors.some((a) => a.id === user.id)) break;
    ancestors.push(user);
    currentId = user.parent_id;
  }

  return ancestors;
}

async function getDownline(userId, dbClient) {
  const client = dbClient || db;
  const result = await client.query(
    `WITH RECURSIVE downline AS (
       SELECT id, full_name, role, parent_id, verification_status, created_at, 0 AS depth
       FROM users
       WHERE parent_id = $1 AND is_deleted = false
       UNION ALL
       SELECT u.id, u.full_name, u.role, u.parent_id, u.verification_status, u.created_at, d.depth + 1
       FROM users u
       INNER JOIN downline d ON u.parent_id = d.id
       WHERE u.is_deleted = false
     )
     SELECT * FROM downline ORDER BY depth, full_name`,
    [userId]
  );
  return result.rows;
}

async function getDirectChildren(userId, dbClient) {
  const client = dbClient || db;
  const result = await client.query(
    'SELECT id, full_name, role, parent_id, verification_status, created_at FROM users WHERE parent_id = $1 AND is_deleted = false ORDER BY created_at',
    [userId]
  );
  return result.rows;
}

function getPositionalRole(user, ancestors) {
  if (user.role === 'admin') return 'admin';
  if (user.role === 'manager') return 'manager';
  if (user.role === 'agent') return 'agent';
  return 'subagent';
}

function findFirstAncestorByRole(ancestors, role) {
  for (const ancestor of ancestors) {
    if (ancestor.role === role) return ancestor;
  }
  return null;
}

async function isInDownline(parentId, targetUserId, dbClient) {
  const client = dbClient || db;
  const result = await client.query(
    `WITH RECURSIVE downline AS (
       SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
       UNION ALL
       SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
     )
     SELECT id FROM downline WHERE id = $2`,
    [parentId, targetUserId]
  );
  return result.rows.length > 0;
}

async function getCapacityInfo(userId, dbClient) {
  const client = dbClient || db;
  const userResult = await client.query('SELECT role, parent_id FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) return null;

  const { role } = userResult.rows[0];

  const CAPACITY_MAP = { manager: 5, agent: 10, subagent: 10 };
  const maxChildren = CAPACITY_MAP[role] || 0;

  const countResult = await client.query(
    'SELECT COUNT(*) FROM users WHERE parent_id = $1 AND is_deleted = false',
    [userId]
  );
  const currentChildren = parseInt(countResult.rows[0].count, 10);

  return { role, current_children: currentChildren, max_children: maxChildren, can_add_more: currentChildren < maxChildren };
}

module.exports = { getAncestors, getDownline, getDirectChildren, getPositionalRole, findFirstAncestorByRole, isInDownline, getCapacityInfo };
