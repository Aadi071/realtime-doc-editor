const express = require('express')
const crypto = require('crypto')
const { pool } = require('../db')
const { hashPassword, comparePassword, signToken } = require('../auth')
const { requireAuth } = require('../middleware/requireAuth')
const { sendVerificationEmail } = require('../email')

const router = express.Router()

const CODE_TTL_MINUTES = 15

function generateCode() {
  // A 6-digit numeric code, e.g. "042817" - zero-padded so it's always 6
  // digits. crypto.randomInt is a cryptographically-strong RNG (unlike
  // Math.random()), appropriate for anything used as a security code.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// POST /api/auth/signup - creates an UNVERIFIED account and emails a code.
// Deliberately does NOT return a token yet - you must prove you own the
// email address (via /verify-email) before you're considered logged in.
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'email and a password of 8+ characters are required' })
    }

    const existing = await pool.query('select id from users where email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'an account with that email already exists' })
    }

    const passwordHash = await hashPassword(password)
    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

    await pool.query(
      `insert into users (email, password_hash, email_verification_code, email_verification_expires_at)
       values ($1, $2, $3, $4)`,
      [email, passwordHash, code, expiresAt],
    )

    await sendVerificationEmail(email, code)

    res.status(201).json({
      message: 'Account created. Check your email for a verification code.',
      email,
    })
  } catch (err) {
    console.error('POST /api/auth/signup failed:', err)
    res.status(500).json({ error: 'failed to sign up' })
  }
})

// POST /api/auth/verify-email - the second half of signup. On success,
// this is the point where the account actually becomes usable, so this is
// where we issue the first token (i.e. this call also logs you in).
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {}
    const { rows } = await pool.query(
      `select id, email, email_verified, email_verification_code, email_verification_expires_at
       from users where email = $1`,
      [email],
    )
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'no account with that email' })
    if (user.email_verified) {
      return res.status(400).json({ error: 'this email is already verified' })
    }
    if (
      !user.email_verification_code ||
      user.email_verification_code !== code ||
      new Date(user.email_verification_expires_at) < new Date()
    ) {
      return res.status(400).json({ error: 'invalid or expired code' })
    }

    await pool.query(
      `update users
       set email_verified = true, email_verification_code = null, email_verification_expires_at = null
       where id = $1`,
      [user.id],
    )

    res.json({
      token: signToken({ id: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
    })
  } catch (err) {
    console.error('POST /api/auth/verify-email failed:', err)
    res.status(500).json({ error: 'failed to verify email' })
  }
})

// POST /api/auth/resend-code - in case the first email never arrived or
// the code expired. Always responds with the same generic message
// regardless of whether the account exists, for the same "don't help an
// attacker enumerate accounts" reason as the login error above.
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body || {}
    const { rows } = await pool.query(
      'select id, email_verified from users where email = $1',
      [email],
    )
    const user = rows[0]

    if (user && !user.email_verified) {
      const code = generateCode()
      const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
      await pool.query(
        `update users set email_verification_code = $1, email_verification_expires_at = $2
         where id = $3`,
        [code, expiresAt, user.id],
      )
      await sendVerificationEmail(email, code)
    }

    res.json({ message: 'If that email needs verifying, a new code has been sent.' })
  } catch (err) {
    console.error('POST /api/auth/resend-code failed:', err)
    res.status(500).json({ error: 'failed to resend code' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const { rows } = await pool.query(
      'select id, email, password_hash, email_verified from users where email = $1',
      [email],
    )
    const user = rows[0]

    // Deliberately vague error for both "no such user" and "wrong password" -
    // telling an attacker WHICH one was wrong makes it easier to enumerate
    // valid email addresses.
    if (!user || !(await comparePassword(password || '', user.password_hash))) {
      return res.status(401).json({ error: 'invalid email or password' })
    }

    if (!user.email_verified) {
      return res
        .status(403)
        .json({ error: 'please verify your email first', unverified: true, email: user.email })
    }

    res.json({ token: signToken(user), user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error('POST /api/auth/login failed:', err)
    res.status(500).json({ error: 'failed to log in' })
  }
})

// GET /api/auth/me - lets the frontend check "is my saved token still valid?"
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.userId, email: req.userEmail })
})

module.exports = router
