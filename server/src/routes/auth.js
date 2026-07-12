const express = require('express')
const { pool } = require('../db')
const { hashPassword, comparePassword, signToken } = require('../auth')
const { requireAuth } = require('../middleware/requireAuth')

const router = express.Router()

// POST /api/auth/signup - creates the account and logs you in immediately.
//
// Email verification is disabled for now: Railway blocks outbound SMTP
// entirely (confirmed - both port 465 and 587 fail), and wiring up an
// HTTP-based provider (SendGrid/Resend/etc.) is a deliberate follow-up,
// not something that should block the app from being usable today. New
// accounts are marked email_verified so nothing downstream has to
// special-case "unverified" users. The email_verification_code/
// email_verification_expires_at columns and the sendVerificationEmail
// helper are left in place (unused) so this is easy to turn back on.
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

    const { rows } = await pool.query(
      `insert into users (email, password_hash, email_verified)
       values ($1, $2, true)
       returning id, email`,
      [email, passwordHash],
    )
    const user = rows[0]

    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error('POST /api/auth/signup failed:', err)
    res.status(500).json({ error: 'failed to sign up' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const { rows } = await pool.query(
      'select id, email, password_hash from users where email = $1',
      [email],
    )
    const user = rows[0]

    // Deliberately vague error for both "no such user" and "wrong password" -
    // telling an attacker WHICH one was wrong makes it easier to enumerate
    // valid email addresses.
    if (!user || !(await comparePassword(password || '', user.password_hash))) {
      return res.status(401).json({ error: 'invalid email or password' })
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
