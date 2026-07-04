// Thin wrapper around Resend so the rest of the app doesn't need to know
// which email provider we're using. If RESEND_API_KEY isn't set, we fall
// back to just logging the code to the console - this keeps local dev
// working with zero external setup, and is also handy if Resend rejects a
// send (e.g. you email an address other than your own before verifying a
// sending domain) - the code isn't lost, just not delivered.
const { Resend } = require('resend')

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Resend's sandbox sender - works without verifying your own domain, but
// (per Resend's anti-abuse rules) can only deliver to the email address
// you signed up to Resend with, until you verify a domain of your own.
const FROM_ADDRESS = process.env.RESEND_FROM || 'onboarding@resend.dev'

async function sendVerificationEmail(toEmail, code) {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set - verification code for ${toEmail}: ${code}`)
    return
  }

  try {
    // IMPORTANT: the Resend SDK does NOT throw for API-level rejections
    // (e.g. the sandbox-sender restriction) - it resolves normally with an
    // `error` field set instead. A bare `await` with no check here would
    // silently swallow that - the request "succeeds" from our point of
    // view but no email ever goes out. Only network-level failures (DNS,
    // timeout, etc.) actually throw and hit the catch block below.
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Verify your email',
      html: `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`,
    })

    if (error) {
      console.error(`[email] Resend rejected the send to ${toEmail}:`, error)
      console.log(`[email] verification code for ${toEmail} was: ${code}`)
      return
    }

    console.log(`[email] sent verification code to ${toEmail} (Resend id: ${data?.id})`)
  } catch (err) {
    // Don't let an email-provider hiccup break signup entirely - log it
    // and also print the code, so local testing/demoing can still proceed.
    console.error(`[email] failed to send to ${toEmail}:`, err.message)
    console.log(`[email] verification code for ${toEmail} was: ${code}`)
  }
}

module.exports = { sendVerificationEmail }
