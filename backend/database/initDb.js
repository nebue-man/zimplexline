const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initDb() {
  console.log('[Database Init] Starting database initialization...');
  
  if (!connectionString) {
    console.error('[Database Init] Error: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  let client;
  let retries = 15;

  while (retries > 0) {
    try {
      client = new Client({ connectionString });
      await client.connect();
      console.log('[Database Init] Connected to database successfully.');
      break;
    } catch (err) {
      console.error(`[Database Init] Connection failed. Retries remaining: ${retries - 1}. Error:`, err.message);
      retries--;
      if (retries === 0) {
        throw new Error('Could not connect to database after maximum retries.');
      }
      await sleep(3000);
    }
  }

  try {
    console.log('[Database Init] Executing schema DDL and seeds...');
    await client.query(schemaSql);
    console.log('[Database Init] Database initialized and seeded successfully.');
  } catch (err) {
    console.error('[Database Init] Error executing schema SQL:', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database Init] Critical error during init:', err);
      process.exit(1);
    });
}

module.exports = initDb;
