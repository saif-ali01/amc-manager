const Item = require('../models/Item');
const NotificationEmail = require('../models/NotificationEmail');
const sendEmail = require('./sendEmail');

const runReminderCheck = async () => {
  console.log('📧 [External Trigger] Running daily reminder check...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // 1. Items with unsent reminders
    const itemsWithUnsentReminders = await Item.find({ 'reminders.sent': false })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    const userMap = new Map();
    const includedItemIds = new Set();

    for (const item of itemsWithUnsentReminders) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      let matchingReminder = null;
      if (diffDays > 0) {
        matchingReminder = item.reminders.find(r => !r.sent && r.daysBefore === diffDays);
      } else {
        matchingReminder = item.reminders.find(r => !r.sent);
      }

      if (!matchingReminder) continue;

      if (diffDays <= 0) {
        item.reminders.forEach(r => { if (!r.sent) r.sent = true; });
      } else {
        matchingReminder.sent = true;
      }

      const userId = item.userId._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          owner: item.userId,
          items: [],
          includedIds: new Set(),
        });
      }
      userMap.get(userId).items.push(item);
      userMap.get(userId).includedIds.add(item._id.toString());
      includedItemIds.add(item._id.toString());
    }

    // 2. Add all expired items that were not already caught
    const expiredItems = await Item.find({
      endDate: { $lt: today },
      _id: { $nin: Array.from(includedItemIds) }
    })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    for (const item of expiredItems) {
      const userId = item.userId._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          owner: item.userId,
          items: [],
          includedIds: new Set(),
        });
      }
      if (!userMap.get(userId).includedIds.has(item._id.toString())) {
        userMap.get(userId).items.push(item);
        userMap.get(userId).includedIds.add(item._id.toString());
      }
    }

    // 3. Send one email per user
    for (const [userId, data] of userMap) {
      const { owner, items } = data;
      if (!owner.email) {
        console.warn(`⚠️ User ${userId} has no email – skipping.`);
        continue;
      }
      const ownerEmail = owner.email;
      const extraEmails = await NotificationEmail.find({ userId });
      const allRecipients = [ownerEmail, ...extraEmails.map(e => e.email)].filter(Boolean);

      items.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

      const tableRows = items.map(item => {
        const end = new Date(item.endDate);
        const now = new Date();
        const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        const status =
          diffDays <= 0
            ? `<span style="color:#e11d48;font-weight:bold;">Expired</span>`
            : diffDays <= 7
            ? `<span style="color:#f59e0b;font-weight:bold;">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`
            : `<span style="color:#10b981;font-weight:bold;">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`;
        return `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.type?.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.provider?.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.company?.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.location?.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${status}</td>
          </tr>
        `;
      }).join('');

      const hasExpired = items.some(item => new Date(item.endDate) < new Date());
      const subject = `⏰ AMC Manager – ${items.length} item${items.length !== 1 ? 's' : ''} require attention`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <div style="background:#4f46e5;padding:20px 30px;text-align:center;">
            <h2 style="color:#ffffff;margin:0;font-size:20px;">AMC Manager</h2>
            <p style="color:#c7d2fe;margin:5px 0 0;font-size:14px;">Renewal Reminder</p>
          </div>
          <div style="padding:30px;">
            <p style="font-size:16px;color:#1f2937;">Hi <strong>${owner.name}</strong>,</p>
            <p style="font-size:14px;color:#4b5563;">
              The following ${hasExpired ? 'items have expired or are' : 'items are'} about to expire. Please review and take action to avoid service interruption.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="text-align:left;padding:8px 10px;">Item</th>
                  <th style="text-align:left;padding:8px 10px;">Type</th>
                  <th style="text-align:left;padding:8px 10px;">Provider</th>
                  <th style="text-align:left;padding:8px 10px;">Company</th>
                  <th style="text-align:left;padding:8px 10px;">Location</th>
                  <th style="text-align:left;padding:8px 10px;">Expires</th>
                  <th style="text-align:left;padding:8px 10px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <p style="font-size:13px;color:#6b7280;margin-top:20px;">
              Log in to <a href="https://amc-manager-self.vercel.app/" style="color:#4f46e5;text-decoration:none;">AMC Manager</a> to renew or update these items.
            </p>
          </div>
          <div style="background:#f9fafb;padding:15px 30px;text-align:center;font-size:11px;color:#9ca3af;">
            This is an automated email from AMC Manager. Please do not reply directly.
          </div>
        </div>
      `;

      for (const to of allRecipients) {
        await sendEmail(to, subject, html);
      }

      // Save reminder sent flags
      for (const item of items) {
        if (item.reminders && item.reminders.some(r => r.sent === true)) {
          await item.save();
        }
      }
    }

    console.log(`✅ Reminder check complete – ${userMap.size} user(s) notified.`);
  } catch (err) {
    console.error('❌ Error during reminder check:', err);
    throw err;  // rethrow so the calling route can respond with 500
  }
};

module.exports = { runReminderCheck };