require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./models/Item');
const User = require('./models/User');
const sendEmail = require('./utils/sendEmail');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = await Item.find({ 'reminders.sent': false }).populate('userId', 'email name');

    for (let item of items) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      for (let reminder of item.reminders) {
        if (!reminder.sent && reminder.daysBefore === diffDays) {
          const userEmail = item.userId.email;
          const subject = `⏰ Reminder: ${item.name} expires in ${diffDays} days`;
          const html = `<p>Hi ${item.userId.name},</p>
            <p>Your <strong>${item.name}</strong> (${item.type}) will expire on <strong>${item.endDate.toDateString()}</strong>.</p>
            <p>Please renew it in time.</p>`;

          await sendEmail(userEmail, subject, html);
          reminder.sent = true;
        }
      }
      await item.save();
    }

    console.log('Notification test complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });