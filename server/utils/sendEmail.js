const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // ali786saif0@gmail.com
    pass: process.env.GMAIL_PASS,   // 16-char App Password
  },
});

module.exports = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"AMC Manager" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    throw err;
  }
};