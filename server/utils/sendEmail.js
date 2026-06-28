const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (to, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'AMC Manager <onboarding@resend.dev>', // ← Resend's verified sender
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      throw error;
    }

    console.log(`✅ Email sent to ${to}: ${data?.id}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    throw err;
  }
};