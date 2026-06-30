const Item = require('../models/Item');
const NotificationEmail = require('../models/NotificationEmail');
const sendEmail = require('./sendEmail');

/**
 * Run the daily reminder check.
 * - Fetches all expiring items with unsent reminders (endDate >= today).
 * - Fetches all expired items (endDate < today) unconditionally.
 * - Groups items by user and sends a single consolidated email per user.
 */
const runReminderCheck = async () => {
  console.log('📧 [Scheduler] Running daily reminder check...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log(`📅 Today: ${today.toISOString()}`);

  try {
    // ── 1. Expiring items (endDate >= today) with unsent reminders ──
    const expiringItems = await Item.find({
      'reminders.sent': false,
      endDate: { $gte: today }
    })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    // ── 2. Expired items (endDate < today) – always included ──
    const expiredItems = await Item.find({
      endDate: { $lt: today }
    })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    console.log(`📦 Expiring with unsent: ${expiringItems.length} | Expired: ${expiredItems.length}`);

    // ── 3. Group items by user ──
    const userMap = new Map(); // userId -> { owner, items }

    // Helper to add an item to the user map
    const addItemToUser = (item) => {
      const userId = item.userId._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, { owner: item.userId, items: [] });
      }
      userMap.get(userId).items.push(item);
    };

    // Process expiring items (existing threshold logic)
    for (const item of expiringItems) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      console.log(`\n🔍 "${item.name}" | ends: ${end.toDateString()} | diffDays: ${diffDays}`);
      console.log(`   Reminders: [${item.reminders.map(r => `${r.daysBefore}d(sent=${r.sent})`).join(', ')}]`);

      // Find the best unsent reminder where daysBefore >= diffDays
      const unsent = item.reminders.filter(r => !r.sent);
      const eligible = unsent
        .filter(r => r.daysBefore >= diffDays)
        .sort((a, b) => b.daysBefore - a.daysBefore); // largest match first

      if (eligible.length === 0) {
        console.log(`   ⏭️  No eligible unsent reminder (diffDays=${diffDays})`);
        continue;
      }

      const trigger = eligible[0];
      trigger.sent = true;
      console.log(`   ✅ Triggering: ${trigger.daysBefore}d (threshold reached)`);

      addItemToUser(item);
    }

    // Process expired items (include all)
    for (const item of expiredItems) {
      const end = new Date(item.endDate);
      console.log(`\n💀 Expired: "${item.name}" | ended: ${end.toDateString()}`);
      addItemToUser(item);
    }

    console.log(`\n👥 Users to notify: ${userMap.size}`);

    if (userMap.size === 0) {
      console.log('⚠️  No users to notify today.');
      return;
    }

    // ── 4. Send one email per user ──
    for (const [userId, { owner, items }] of userMap) {
      if (!owner?.email) {
        console.warn(`⚠️  User ${userId} has no email — skipping.`);
        continue;
      }

      // Sort items: expired first, then by end date ascending
      items.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

      // Collect all recipients: owner + additional notification emails
      const extraEmails = await NotificationEmail.find({ userId });
      const allRecipients = [owner.email, ...extraEmails.map(e => e.email)].filter(Boolean);
      console.log(`\n📨 User: ${owner.email} | Items: ${items.length} | Recipients: ${allRecipients.join(', ')}`);

      // Build HTML table rows
      const tableRows = items.map(item => {
        const end = new Date(item.endDate);
        const diffDays = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
        const statusColor = diffDays <= 0 ? '#e11d48' : diffDays <= 7 ? '#f59e0b' : '#10b981';
        const statusText = diffDays <= 0 ? 'Expired' : `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${item.name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.type?.name || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.provider?.name || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.company?.name || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.location?.name || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">
              ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <span style="color:${statusColor};font-weight:bold;">${statusText}</span>
            </td>
          </tr>`;
      }).join('');

      const hasExpired = items.some(i => new Date(i.endDate) < new Date());
      const subject = `⏰ AMC Manager – ${items.length} item${items.length !== 1 ? 's' : ''} require${items.length === 1 ? 's' : ''} attention`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:0.5px;">🔔 AMC Manager</h1>
              <p style="color:#c7d2fe;margin:6px 0 0;font-size:14px;">Renewal Reminder Notification</p>
            </div>
            <div style="padding:32px;">
              <p style="font-size:16px;color:#1f2937;margin-top:0;">Hi <strong>${owner.name}</strong>,</p>
              <p style="font-size:14px;color:#4b5563;line-height:1.6;">
                ${hasExpired
                  ? 'Some of your AMC/contract items have <strong style="color:#e11d48;">expired</strong> or are <strong>expiring soon</strong>.'
                  : 'The following AMC/contract items are <strong>expiring soon</strong>.'}
                Please review and renew them to avoid service interruption.
              </p>
              <div style="overflow-x:auto;margin:24px 0;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Item</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Type</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Provider</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Company</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Location</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Expires</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;">Status</th>
                    </tr>
                  </thead>
                  <tbody>${tableRows}</tbody>
                </table>
              </div>
              <div style="text-align:center;margin:28px 0 8px;">
                <a href= 'https://amc-manager-self.vercel.app/' target="_blank" rel="noopener noreferrer"
                   style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">
                  Open AMC Manager →
                </a>
              </div>
            </div>
            <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="font-size:11px;color:#9ca3af;margin:0;">
                This is an automated email from AMC Manager. Please do not reply directly.<br>
                You received this because you or your admin added this address for AMC alerts.
              </p>
            </div>
          </div>
        </body>
        </html>`;

      // Send email to all recipients
      for (const to of allRecipients) {
        try {
          await sendEmail(to, subject, html);
          console.log(`   ✅ Email sent → ${to}`);
        } catch (emailErr) {
          console.error(`   ❌ Failed → ${to}:`, emailErr.message);
        }
      }

      // Save items (only those that had their reminders updated)
      for (const item of items) {
        try {
          await item.save();
          console.log(`   💾 Saved: ${item.name}`);
        } catch (saveErr) {
          console.error(`   ❌ Save failed for ${item.name}:`, saveErr.message);
        }
      }
    }

    console.log(`\n✅ Reminder check complete — ${userMap.size} user(s) notified.`);
  } catch (err) {
    console.error('❌ Fatal error during reminder check:', err);
    throw err;
  }
};

// Keep this if you still want the built-in cron (optional, works only when server is active)
// const cron = require('node-cron');
// const startScheduler = () => {
//   cron.schedule('0 18 * * *', runReminderCheck);
// };

module.exports = { runReminderCheck };