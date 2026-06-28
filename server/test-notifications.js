require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./models/Item');
const User = require('./models/User');
const NotificationEmail = require('./models/NotificationEmail');
const sendEmail = require('./utils/sendEmail');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('🔍 Checking reminders...');
    const today = new Date();
    today.setHours(0,0,0,0);

    // Find items with unsent reminders where daysBefore matches
    const items = await Item.find({ 'reminders.sent': false })
      .populate('userId', 'email name');

    let sent = 0;
    for (const item of items) {
      const end = new Date(item.endDate);
      end.setHours(0,0,0,0);
      const diffDays = Math.ceil((end - today) / (1000*60*60*24));

      for (const reminder of item.reminders) {
        if (!reminder.sent && reminder.daysBefore === diffDays) {
          // Collect recipients: owner + additional notification emails
          const ownerEmail = item.userId.email;
          const extraEmails = await NotificationEmail.find({ userId: item.userId._id });
          const allRecipients = [ownerEmail, ...extraEmails.map(e => e.email)].filter(Boolean);

          const subject = `⏰ Reminder: ${item.name} expires in ${diffDays} days`;
          const html = `<p>Hi,</p><p><strong>${item.name}</strong> expires on <strong>${item.endDate.toDateString()}</strong>. Please renew it soon.</p>`;

          for (const to of allRecipients) {
            await sendEmail(to, subject, html);
            console.log(`   📧 Sent to ${to}`);
          }
          reminder.sent = true;
          sent++;
        }
      }
      await item.save();
    }

    console.log(`✅ Done – sent ${sent} reminder(s).`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });