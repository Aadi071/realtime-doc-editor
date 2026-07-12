// Thin wrapper around SendGrid's HTTP API so the rest of the app doesn't
// need to know which email provider we're using. If SENDGRID_API_KEY/
// SENDGRID_FROM_EMAIL aren't set, we fall back to just logging the code to
// the console - this keeps local dev working with zero external setup, and
// is also handy if a send fails for any reason - the code isn't lost, just
// not delivered.
//
// Why SendGrid's HTTP API instead of Gmail SMTP: Railway blocks outbound
// SMTP entirely - port 465 (implicit TLS) and port 587 (STARTTLS) both
// either got ENETUNREACH or hung to a bare connection timeout, even after
// fixing every DNS/address-family wrinkle on the client side. That's a
// network-level block, not something app code can work around. SendGrid's
// Mail Send API is plain HTTPS (port 443), which Railway allows outbound
// without restriction. Single Sender Verification (verifying one email
// address, not owning a whole domain) is enough to send to any real
// recipient - no domain purchase/DNS setup required for a portfolio app.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL

async function sendVerificationEmail(toEmail, code) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.log(`[email] SENDGRID_API_KEY/SENDGRID_FROM_EMAIL not set - verification code for ${toEmail}: ${code}`)
    return
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: SENDGRID_FROM_EMAIL, name: 'RTEDTR' },
        subject: 'Verify your email',
        content: [
          {
            type: 'text/html',
            value: `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`,
          },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`SendGrid responded ${res.status}: ${body}`)
    }

    console.log(`[email] sent verification code to ${toEmail} via SendGrid`)
  } catch (err) {
    // Don't let an email-provider hiccup break signup entirely - log it
    // and also print the code, so local testing/demoing can still proceed.
    console.error(`[email] failed to send to ${toEmail}:`, err.message)
    console.log(`[email] verification code for ${toEmail} was: ${code}`)
  }
}

module.exports = { sendVerificationEmail }
