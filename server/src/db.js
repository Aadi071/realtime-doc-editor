// A connection pool to Postgres. A "pool" keeps a handful of open
// connections ready to reuse, instead of opening/closing a new TCP
// connection to the database on every query (which is slow).
const { Pool } = require('pg')

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://docedit:docedit_dev_password@localhost:5432/docedit',
})

// node-postgres Pool emits 'error' on any IDLE client that dies unexpectedly
// (e.g. Postgres restarting, or `docker compose down` killing connections).
// If nothing is listening for that event, Node treats it as an unhandled
// error and crashes the ENTIRE process - not just that one query. This
// listener is what keeps a Postgres restart from taking the whole server
// down; we just log it and let the pool reconnect on the next query.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client:', err.message)
})

module.exports = { pool }
