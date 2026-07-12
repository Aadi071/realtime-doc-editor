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
        // Spelled out explicitly (instead of the `service: 'gmail'`
        // shorthand) so we can pin `family: 4` below - Railway's network
        // resolves smtp.gmail.com to an IPv6 address it has no route to,
        // and that ENETUNREACH doesn't fail fast, it eats the whole
        // connectionTimeout before nodemailer gives up on it. `family: 4`
        // skips straight to an IPv4 address instead of ever trying IPv6.
        //
        // Port 465 (implicit TLS) still hung for the full connectionTimeout
        // on Railway even with family:4 forcing an IPv4 address - that
        // points at Railway blocking/dropping outbound :465 specifically,
        // not a DNS/address-family issue. Trying port 587 (STARTTLS:
        // connect in plaintext, then upgrade) since hosts that block
        // implicit-TLS SMTP often leave the submission port open.
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        family: 4,
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
      html: `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>