const https = require('https');

/**
 * Send email via Brevo HTTP API
 * - No SMTP (works on Render free tier)
 * - No domain verification needed (sender email verified instead)
 * - No extra npm packages needed
 * @param {string|string[]} to
 * @param {string} subject
 * @param {string} html
 */
module.exports = async (to, subject, html) => {
  const recipients = Array.isArray(to) ? to : [to];

  if (!process.env.BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY is not set in environment variables!');
    throw new Error('BREVO_API_KEY missing');
  }

  const payload = JSON.stringify({
    sender: {
      name: 'AMC Manager',
      email: 'saifali01x@gmail.com', // ✅ verified sender in Brevo (no domain needed)
    },
    to: recipients.map(email => ({ email })),
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Email sent to ${recipients.join(', ')} | MessageID: ${parsed.messageId}`);
            resolve(parsed);
          } else {
            console.error(`❌ Brevo API error [${res.statusCode}]:`, JSON.stringify(parsed));
            reject(new Error(`Brevo error ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (parseErr) {
          console.error('❌ Failed to parse Brevo response:', data);
          reject(parseErr);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Brevo HTTPS request failed:`, err.message);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
};