// Makes sure the database schema exists before the server starts serving
// requests. Locally, the official Postgres Docker image auto-runs every
// file in db/init/ the first time its data volume is created - that's how
// the schema gets applied in local dev. Railway's managed Postgres plugin
// is just a raw Postgres instance with no such init-script mechanism, so
// without this, the tables would only ever exist locally and every real
// query (login, signup, ...) would fail with "relation ... does not
// exist" against any freshly-provisioned Postgres, including production.
//
// This is intentionally cheap and safe to run on every boot: it checks
// whether the `users` table is already there and only executes the schema
// file the first time it isn't.
const fs = require('fs')
const path = require('path')
const { pool } = require('./db')

async function ensureSchema() {
  const { rows } = await pool.query("select to_regclass('public.users') as exists")
  if (rows[0].exists) {
    console.log('[db] schema already present')
    return
  }

  console.log('[db] no schema found - applying db/init/001_schema.sql')
  const schemaPath = path.join(__dirname, '..', 'db', 'init', '001_schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  await pool.query(sql)
  console.log('[db] schema created')
}

module.exports = { ensureSchema }
