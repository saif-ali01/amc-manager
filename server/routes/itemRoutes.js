const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const auth = require('../middleware/auth');
const NotificationEmail = require('../models/NotificationEmail');
const sendEmail = require('../utils/sendEmail');
const { runReminderCheck } = require('../utils/scheduler');

const populateFields = [
  { path: 'type', select: 'name' },
  { path: 'provider', select: 'name' },
  { path: 'company', select: 'name' },
  { path: 'location', select: 'name' },
];

// ─── POST /api/items ───────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, startDate, endDate, reminders, ...rest } = req.body;
    const item = new Item({
      userId: req.userId,
      name,
      type,
      startDate,
      endDate,
      // Default reminders: 30, 15, 7 days before — all unsent
      reminders: reminders?.length
        ? reminders.map(r => ({ daysBefore: r.daysBefore, sent: false }))
        : [{ daysBefore: 30, sent: false }, { daysBefore: 15, sent: false }, { daysBefore: 7, sent: false }],
      ...rest,
    });
    await item.save();
    const populatedItem = await Item.findById(item._id).populate(populateFields);
    res.status(201).json(populatedItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/items ────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.userId })
      .populate(populateFields)
      .sort({ endDate: 1 });

    const now = new Date();
    const enriched = items.map(item => {
      const diffDays = Math.ceil((new Date(item.endDate) - now) / (1000 * 60 * 60 * 24));
      let status = 'Active';
      if (diffDays < 0) status = 'Expired';
      else if (diffDays <= 30) status = 'Expiring';
      return { ...item._doc, status };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/items/:id ────────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    // ✅ If endDate changes, reset all reminder flags so new alerts fire
    if (req.body.endDate) {
      const existing = await Item.findOne({ _id: req.params.id, userId: req.userId });
      if (existing) {
        const oldEnd = new Date(existing.endDate).toDateString();
        const newEnd = new Date(req.body.endDate).toDateString();
        if (oldEnd !== newEnd) {
          // Reset reminders — keep daysBefore values, clear sent flags
          req.body.reminders = existing.reminders.map(r => ({
            daysBefore: r.daysBefore,
            sent: false,
          }));
          // If custom reminders sent in body, use those instead
          if (req.body.reminders?.length === 0) {
            req.body.reminders = [
              { daysBefore: 30, sent: false },
              { daysBefore: 15, sent: false },
              { daysBefore: 7, sent: false },
            ];
          }
        }
      }
    }

    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    ).populate(populateFields);

    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/items/:id ─────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/:id/test-reminder ────────────────────────────────────────
// Manually send a test reminder for a single item
router.post('/:id/test-reminder', auth, async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId })
      .populate('userId', 'email name')
      .populate('type', 'name')
      .populate('provider', 'name')
      .populate('company', 'name')
      .populate('location', 'name');

    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (!item.userId?.email) return res.status(400).json({ message: 'Item owner email not found' });

    const end = new Date(item.endDate);
    const diffDays = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
    const statusColor = diffDays <= 0 ? '#e11d48' : diffDays <= 7 ? '#f59e0b' : '#10b981';
    const statusText = diffDays <= 0 ? 'Expired' : `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;

    const extraEmails = await NotificationEmail.find({ userId: req.userId });
    const allRecipients = [item.userId.email, ...extraEmails.map(e => e.email)].filter(Boolean);

    const subject = `🔔 Test Reminder – ${item.name}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">🔔 AMC Manager</h1>
            <p style="color:#c7d2fe;margin:6px 0 0;font-size:13px;">Test Reminder</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:15px;color:#1f2937;">Hi <strong>${item.userId.name}</strong>,</p>
            <p style="font-size:14px;color:#4b5563;">This is a <strong>manual test</strong> of your AMC Manager alert system.</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Item</td><td style="padding:6px 0;color:#111827;font-weight:bold;">${item.name}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Type</td><td style="padding:6px 0;color:#374151;">${item.type?.name || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Provider</td><td style="padding:6px 0;color:#374151;">${item.provider?.name || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Company</td><td style="padding:6px 0;color:#374151;">${item.company?.name || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;color:#374151;">${item.location?.name || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Expires</td><td style="padding:6px 0;color:#374151;">${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:bold;color:${statusColor};">${statusText}</td></tr>
              </table>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${process.env.FRONTEND_URL || 'https://amc-manager.onrender.com'}"
                 style="background:#4f46e5;color:#fff;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">
                Open AMC Manager →
              </a>
            </div>
          </div>
          <div style="background:#f9fafb;padding:14px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="font-size:11px;color:#9ca3af;margin:0;">Automated test email from AMC Manager. Do not reply.</p>
          </div>
        </div>
      </body>
      </html>`;

    for (const to of allRecipients) {
      await sendEmail(to, subject, html);
    }

    res.json({
      message: `Test reminder sent to ${allRecipients.length} recipient(s)`,
      recipients: allRecipients,
    });
  } catch (err) {
    console.error('Test reminder error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/run-reminders ────────────────────────────────────────────
// Called by external cron job (cron-job.org)
// ✅ Responds immediately, processes in background to avoid timeout
router.post('/run-reminders', async (req, res) => {
  if (req.body.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Respond immediately so cron job doesn't timeout
  res.json({ message: 'Reminder check started in background' });

  // Run in background
  runReminderCheck().catch(err => {
    console.error('❌ Background reminder check failed:', err.message);
  });
});

// ─── POST /api/items/test-reminders (bulk test for dev) ───────────────────────
router.post('/test-reminders', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = await Item.find({ userId: req.userId, 'reminders.sent': false })
      .populate('userId', 'email name');

    let sent = 0;
    for (const item of items) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

      for (const reminder of item.reminders) {
        if (!reminder.sent && diffDays <= reminder.daysBefore) {
          await sendEmail(
            item.userId.email,
            `Reminder: ${item.name}`,
            `<p><strong>${item.name}</strong> expires in <strong>${diffDays}</strong> days.</p>`
          );
          reminder.sent = true;
          sent++;
          break; // one reminder per item per run
        }
      }
      await item.save();
    }

    res.json({ message: `Sent ${sent} reminder(s)` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;