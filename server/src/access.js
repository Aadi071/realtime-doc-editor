const { pool } = require('./db')

// Returns this user's role on this document: 'owner' | 'editor' | 'viewer',
// or null if they have no access to it at all (including if it doesn't
// exist - we deliberately don't distinguish "not found" from "not allowed"
// to callers, so we don't leak which document IDs exist to people who
// don't have access to them).
async function getDocumentRole(docId, userId) {
  const { rows } = await pool.query(
    `select
       case when d.owner_id = $2 then 'owner' else ds.role::text end as role
     from documents d
     left join document_shares ds on ds.document_id = d.id and ds.user_id = $2
     where d.id = $1`,
    [docId, userId],
  )
  if (rows.length === 0) return null
  return rows[0].role || null
}

module.exports = { getDocumentRole }
