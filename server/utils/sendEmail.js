const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,  // e.g. ali786saif0@gmail.com
    pass: process.env.GMAIL_PASS,  // 16-char App Password (no spaces)
  },
});

// Verify connection on startup
transporter.verify((err, success) => {
  if (err) {
    console.error('❌ Gmail transporter error:', err.message);
  } else {
    console.log('✅ Gmail transporter ready');
  }
});

/**
 * Send an email
 * @param {string|string[]} to - recipient(s)
 * @param {string} subject
 * @param {string} html
 */
module.exports = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"AMC Manager" <${process.env.GMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to} | ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    throw err;
  }
};