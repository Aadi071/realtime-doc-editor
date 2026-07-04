const { verifyToken } = require('../auth')

// Reads "Authorization: Bearer <token>", verifies it, and attaches the
// user's id/email onto req - so any route behind this middleware can trust
// req.userId without re-checking anything.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  const payload = token && verifyToken(token)

  if (!payload) {
    return res.status(401).json({ error: 'missing or invalid auth token' })
  }

  req.userId = payload.sub
  req.userEmail = payload.email
  next()
}

module.exports = { requireAuth }
