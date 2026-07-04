// Password hashing and JWT helpers. Kept separate from the route handlers
// so both routes/auth.js and the WebSocket upgrade check in server.js can
// share the exact same verifyToken logic.
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set - using an insecure default. Fine for local ' +
      'dev, never for anything real (anyone who knows the default could forge ' +
      'tokens for any user).',
  )
}

// We NEVER store the plain password - bcrypt hashes it with a random "salt"
// baked into the hash itself, so even two identical passwords produce
// different hashes, and the hash can't be reversed back into the password.
function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10)
}

function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash)
}

function signToken(user) {
  // "sub" (subject) is the standard JWT claim name for "who is this token
  // about". expiresIn bakes an expiry into the token itself - the server
  // doesn't need to track sessions anywhere; it just checks the signature
  // and the expiry on every request.
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken }
