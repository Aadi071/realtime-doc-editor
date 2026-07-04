// REST API for document METADATA + access control. Every route here
// requires a valid auth token (see router.use(requireAuth) below).
const express = require('express')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/requireAuth')
const { getDocumentRole } = require('../access')
const { disconnectUserFromDoc } = require('../liveAccess')

const router = express.Router()
router.use(requireAuth)

// GET /api/documents - list documents THIS user owns or has been shared,
// most recently updated first, including their role on each one.
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select d.id, d.title, d.created_at, d.updated_at,
              case when d.owner_id = $1 then 'owner' else ds.role::text end as role
       from documents d
       left join document_shares ds on ds.document_id = d.id and ds.user_id = $1
       where d.owner_id = $1 or ds.user_id = $1
       order by d.updated_at desc`,
      [req.userId],
    )
    res.json(rows)
  } catch (err) {
    console.error('GET /api/documents failed:', err)
    res.status(500).json({ error: 'failed to list documents' })
  }
})

// POST /api/documents - create a new document owned by this user
router.post('/', async (req, res) => {
  try {
    const title = (req.body && req.body.title) || 'Untitled document'
    const { rows } = await pool.query(
      'insert into documents (title, owner_id) values ($1, $2) returning id, title, created_at, updated_at',
      [title, req.userId],
    )
    res.status(201).json({ ...rows[0], role: 'owner' })
  } catch (err) {
    console.error('POST /api/documents failed:', err)
    res.status(500).json({ error: 'failed to create document' })
  }
})

// GET /api/documents/:id - fetch metadata, but only if this user has access
router.get('/:id', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (!role) return res.status(404).json({ error: 'document not found' })

    const { rows } = await pool.query(
      'select id, title, created_at, updated_at from documents where id = $1',
      [req.params.id],
    )
    res.json({ ...rows[0], role })
  } catch (err) {
    console.error('GET /api/documents/:id failed:', err)
    res.status(500).json({ error: 'failed to fetch document' })
  }
})

// POST /api/documents/:id/share - OWNER ONLY: grant another (existing) user
// access to this document by email.
router.post('/:id/share', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (role !== 'owner') {
      return res.status(403).json({ error: 'only the owner can share this document' })
    }

    const { email, role: grantedRole } = req.body || {}
    if (!email || !['viewer', 'editor'].includes(grantedRole)) {
      return res
        .status(400)
        .json({ error: 'email and role ("viewer" or "editor") are required' })
    }

    const userResult = await pool.query('select id from users where email = $1', [email])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: `no account exists for ${email}` })
    }
    const targetUserId = userResult.rows[0].id

    // "upsert": insert a new share, or if one already exists for this
    // (document, user) pair, update its role instead of erroring.
    await pool.query(
      `insert into document_shares (document_id, user_id, role)
       values ($1, $2, $3)
       on conflict (document_id, user_id) do update set role = excluded.role`,
      [req.params.id, targetUserId, grantedRole],
    )
    res.status(201).json({ email, role: grantedRole })
  } catch (err) {
    console.error('POST /api/documents/:id/share failed:', err)
    res.status(500).json({ error: 'failed to share document' })
  }
})

// GET /api/documents/:id/shares - OWNER ONLY: who currently has access
router.get('/:id/shares', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (role !== 'owner') {
      return res.status(403).json({ error: 'only the owner can view sharing settings' })
    }

    const { rows } = await pool.query(
      `select u.email, ds.role
       from document_shares ds
       join users u on u.id = ds.user_id
       where ds.document_id = $1`,
      [req.params.id],
    )
    res.json(rows)
  } catch (err) {
    console.error('GET /api/documents/:id/shares failed:', err)
    res.status(500).json({ error: 'failed to list shares' })
  }
})

// DELETE /api/documents/:id/shares/:email - OWNER ONLY: revoke someone's
// access entirely. Unlike a role CHANGE (handled by POST /share above,
// which lets an already-connected client just pick up the new role on its
// next poll), a revoke gets an immediate, hard cutoff: we forcibly close
// their live WebSocket connection to this document right now, rather than
// waiting for them to notice.
router.delete('/:id/shares/:email', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (role !== 'owner') {
      return res.status(403).json({ error: 'only the owner can change sharing settings' })
    }

    const userResult = await pool.query('select id from users where email = $1', [
      req.params.email,
    ])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'no such user' })
    }
    const targetUserId = userResult.rows[0].id

    await pool.query(
      'delete from document_shares where document_id = $1 and user_id = $2',
      [req.params.id, targetUserId],
    )

    disconnectUserFromDoc(req.params.id, targetUserId)

    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/documents/:id/shares/:email failed:', err)
    res.status(500).json({ error: 'failed to revoke access' })
  }
})

// POST /api/documents/:id/versions - save a manual snapshot. The CLIENT
// sends its own current Y.encodeStateAsUpdate() bytes (base64-encoded) -
// the server doesn't need to understand Yjs internals here, it just needs
// somewhere durable to put bytes the client says represents "right now".
// Requires editor or owner (view-only users shouldn't be able to snapshot
// a state they can't even edit).
router.post('/:id/versions', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ error: 'you do not have edit access to this document' })
    }

    const { content } = req.body || {}
    if (!content) return res.status(400).json({ error: 'content (base64) is required' })

    const { rows } = await pool.query(
      `insert into document_versions (document_id, content, created_by)
       values ($1, $2, $3)
       returning id, created_at`,
      [req.params.id, Buffer.from(content, 'base64'), req.userId],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('POST /api/documents/:id/versions failed:', err)
    res.status(500).json({ error: 'failed to save version' })
  }
})

// GET /api/documents/:id/versions - list saved versions (no content, just
// metadata) for anyone with access, newest first.
router.get('/:id/versions', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (!role) return res.status(404).json({ error: 'document not found' })

    const { rows } = await pool.query(
      `select v.id, v.created_at, u.email as created_by
       from document_versions v
       left join users u on u.id = v.created_by
       where v.document_id = $1
       order by v.created_at desc`,
      [req.params.id],
    )
    res.json(rows)
  } catch (err) {
    console.error('GET /api/documents/:id/versions failed:', err)
    res.status(500).json({ error: 'failed to list versions' })
  }
})

// GET /api/documents/:id/versions/:versionId - fetch one version's raw
// content (base64) so the client can decode it and restore it.
router.get('/:id/versions/:versionId', async (req, res) => {
  try {
    const role = await getDocumentRole(req.params.id, req.userId)
    if (!role) return res.status(404).json({ error: 'document not found' })

    const { rows } = await pool.query(
      'select content from document_versions where id = $1 and document_id = $2',
      [req.params.versionId, req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'version not found' })

    res.json({ content: rows[0].content.toString('base64') })
  } catch (err) {
    console.error('GET /api/documents/:id/versions/:versionId failed:', err)
    res.status(500).json({ error: 'failed to fetch version' })
  }
})

module.exports = router
