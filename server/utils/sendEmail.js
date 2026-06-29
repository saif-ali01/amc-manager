const Brevo = require('@getbrevo/brevo');

const client = Brevo.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const transactionalApi = new Brevo.TransactionalEmailsApi();

/**
 * Send an email via Brevo HTTP API
 * Works on Render free tier (uses HTTPS not SMTP)
 * @param {string|string[]} to - recipient email(s)
 * @param {string} subject
 * @param {string} html
 */
module.exports = async (to, subject, html) => {
  try {
    const recipients = Array.isArray(to) ? to : [to];

    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: 'AMC Manager',
      email: 'noreply@nutraj.com', // ✅ must be verified in Brevo
    };

    sendSmtpEmail.to = recipients.map(email => ({ email }));
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;

    const result = await transactionalApi.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email sent to ${recipients.join(', ')} | MessageID: ${result?.messageId}`);
  } catch (err) {
    console.error(`❌ Brevo failed to send to ${to}:`, err?.response?.body || err.message);
    throw err;
  }
};