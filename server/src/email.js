// Thin wrapper around Nodemailer + Gmail SMTP so the rest of the app doesn't
// need to know which email provider we're using. If GMAIL_USER/
// GMAIL_APP_PASSWORD aren't set, we fall back to just logging the code to
// the console - this keeps local dev working with zero external setup, and
// is also handy if a send fails for any reason - the code isn't lost, just
// not delivered.
//
// Why Gmail SMTP instead of a transactional-email API (Resend, SendGrid,
// etc.): every one of those gates sending to arbitrary recipients behind a
// verified sending domain - fine for a real product, but overkill for a
// portfolio-scale app with no domain to verify. Gmail SMTP sends as your
// own address and delivers to any real inbox immediately, no verification
// step. It won't scale past ~500 messages/day and isn't meant for
// production volume, but that's well beyond what this app needs.
const nodemailer = require('nodemailer')

const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, // a Gmail App Password, NOT your account password
        },
      })
    : null

async function sendVerificationEmail(toEmail, code) {
  if (!transporter) {
    console.log(`[email] GMAIL_USER/GMAIL_APP_PASSWORD not set - verification code for ${toEmail}: ${code}`)
    return
  }

  try {
    const info = await transporter.sendMail({
      from: `RTEDTR <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Verify your email',
      html: `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`,
    })

    console.log(`[email] sent verification code to ${toEmail} (message id: ${info.messageId})`)
  } catch (err) {
    // Don't let an email-provider hiccup break signup entirely - log it
    // and also print the code, so local testing/demoing can still proceed.
    console.error(`[email] failed to send to ${toEmail}:`, err.message)
    console.log(`[email] verification code for ${toEmail} was: ${code}`)
  }
}

module.exports = { sendVerificationEmail }
