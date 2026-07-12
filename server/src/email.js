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
const dns = require('dns')

// Nodemailer's `family: 4` option (tried on both port 465 and port 587)
// did NOT reliably force an IPv4 connection on Railway - the logs still
// showed `connect ENETUNREACH` against an IPv6 address for
// smtp.gmail.com, meaning `family` wasn't actually reaching the layer
// that opens the socket. Resolving the IPv4 address ourselves and
// connecting to that literal IP sidesteps whatever wasn't honoring
// `family`, and guarantees an IPv4 socket regardless. `tls.servername`
// is set explicitly so TLS certificate hostname verification still
// checks against "smtp.gmail.com" instead of the raw IP.
let transporterPromise = null

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return Promise.resolve(null)
  }
  if (transporterPromise) return transporterPromise

  transporterPromise = dns.promises
    .lookup('smtp.gmail.com', { family: 4 })
    .then(({ address }) => address)
    .catch((err) => {
      console.error('[email] failed to resolve smtp.gmail.com to an IPv4 address, falling back to hostname:', err.message)
      return 'smtp.gmail.com'
    })
    .then((host) =>
      nodemailer.createTransport({
        host,
        port: 587,
        secure: false,
        requireTLS: true,
        family: 4,
        tls: { servername: 'smtp.gmail.com' },
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, // a Gmail App Password, NOT your account password
        },
        // Belt-and-suspenders: if a connection attempt is ever going to
        // fail for some other reason (bad network, Gmail hiccup, etc.) it
        // should fail within a few seconds, not hang and turn signup into
        // a multi-minute wait.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      })
    )

  return transporterPromise
}

async function sendVerificationEmail(toEmail, code) {
  const transporter = await getTransporter()
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
