const Item = require('../models/Item');
const NotificationEmail = require('../models/NotificationEmail');
const sendEmail = require('./sendEmail');

const runReminderCheck = async () => {
  console.log('📧 [Scheduler] Running daily reminder check...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log(`📅 Today: ${today.toISOString()}`);

  try {
    // ─── 1. Fetch ALL items (active + expired) with at least one unsent reminder ───
    const allItems = await Item.find({ 'reminders.sent': false })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    console.log(`📦 Items with unsent reminders: ${allItems.length}`);

    if (allItems.length === 0) {
      console.log('⚠️  No unsent reminders found. All reminder flags may already be sent=true.');
      console.log('💡 Tip: Reset flags in MongoDB Atlas with:');
      console.log('   db.items.updateMany({}, { $set: { "reminders.$[].sent": false } })');
      return;
    }

    // ─── 2. Group items by user, decide which ones to notify today ───
    const userMap = new Map(); // userId → { owner, items[] }

    for (const item of allItems) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      console.log(`\n🔍 "${item.name}" | ends: ${end.toDateString()} | diffDays: ${diffDays}`);
      console.log(`   Reminders: [${item.reminders.map(r => `${r.daysBefore}d(sent=${r.sent})`).join(', ')}]`);

      let shouldNotify = false;

      if (diffDays <= 0) {
        // ── Expired: notify if ANY reminder is still unsent ──
        shouldNotify = item.reminders.some(r => !r.sent);
        if (shouldNotify) {
          // Mark ALL unsent reminders as sent
          item.reminders.forEach(r => { if (!r.sent) r.sent = true; });
          console.log(`   ✅ Expired item — marking all reminders sent`);
        }
      } else {
        // ── Not expired: notify if diffDays <= the highest unsent daysBefore ──
        // This catches missed days too (e.g. cron was down on day 30, fires on day 28)
        const unsentReminders = item.reminders.filter(r => !r.sent);
        const triggerReminder = unsentReminders.find(r => diffDays <= r.daysBefore);

        if (triggerReminder) {
          shouldNotify = true;
          triggerReminder.sent = true;
          console.log(`   ✅ Triggering reminder: ${triggerReminder.daysBefore}d (diffDays=${diffDays})`);
        } else {
          console.log(`   ⏭️  No reminder due today (diffDays=${diffDays} not within any threshold)`);
        }
      }

      if (!shouldNotify) continue;

      const userId = item.userId._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, { owner: item.userId, items: [] });
      }
      userMap.get(userId).items.push(item);
    }

    console.log(`\n👥 Users to notify: ${userMap.size}`);

    if (userMap.size === 0) {
      console.log('⚠️  No users qualify for notification today.');
      return;
    }

    // ─── 3. Send one digest email per user ───
    for (const [userId, { owner, items }] of userMap) {
      if (!owner?.email) {
        console.warn(`⚠️  User ${userId} has no email — skipping.`);
        continue;
      }

      // Sort by soonest expiry first
      items.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

      // Get extra notification emails
      const extraEmails = await NotificationEmail.find({ userId });
      const allRecipients = [owner.email, ...extraEmails.map(e => e.email)].filter(Boolean);
      console.log(`\n📨 User: ${owner.email} | Items: ${items.length} | Recipients: ${allRecipients.join(', ')}`);

      // ─── Build email HTML ───
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

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:0.5px;">🔔 AMC Manager</h1>
              <p style="color:#c7d2fe;margin:6px 0 0;font-size:14px;">Renewal Reminder Notification</p>
            </div>

            <!-- Body -->
            <div style="padding:32px;">
              <p style="font-size:16px;color:#1f2937;margin-top:0;">
                Hi <strong>${owner.name}</strong>,
              </p>
              <p style="font-size:14px;color:#4b5563;line-height:1.6;">
                ${hasExpired
                  ? 'Some of your AMC/contract items have <strong style="color:#e11d48;">expired</strong> or are <strong>expiring soon</strong>.'
                  : 'The following AMC/contract items are <strong>expiring soon</strong>.'}
                Please review and renew them to avoid service interruption.
              </p>

              <!-- Table -->
              <div style="overflow-x:auto;margin:24px 0;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Item</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Type</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Provider</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Company</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Location</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Expires</th>
                      <th style="text-align:left;padding:10px 12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">Status</th>
                    </tr>
                  </thead>
                  <tbody>${tableRows}</tbody>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${process.env.FRONTEND_URL || 'https://amc-manager.onrender.com'}"
                   style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">
                  Open AMC Manager →
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="font-size:11px;color:#9ca3af;margin:0;">
                This is an automated email from AMC Manager. Please do not reply directly.<br>
                You received this because you or your admin added this address for AMC alerts.
              </p>
            </div>
          </div>
        </body>
        </html>`;

      // ─── Send to all recipients ───
      for (const to of allRecipients) {
        try {
          await sendEmail(to, subject, html);
          console.log(`   ✅ Email sent → ${to}`);
        } catch (emailErr) {
          console.error(`   ❌ Failed → ${to}:`, emailErr.message);
        }
      }

      // ─── Save updated reminder flags ───
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

module.exports = { runReminderCheck };