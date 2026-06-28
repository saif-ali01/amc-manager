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

// POST /api/items
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, startDate, endDate, reminders, ...rest } = req.body;
    const item = new Item({
      userId: req.userId,
      name,
      type,
      startDate,
      endDate,
      reminders: reminders || [
        { daysBefore: 30 },
        { daysBefore: 15 },
        { daysBefore: 7 }
      ],
      ...rest
    });
    await item.save();
    const populatedItem = await Item.findById(item._id).populate(populateFields);
    res.status(201).json(populatedItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/items
router.get('/', auth, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.userId })
      .populate(populateFields)
      .sort({ endDate: 1 });
    const now = new Date();
    const enriched = items.map(item => {
      let status = 'Active';
      if (item.endDate < now) status = 'Expired';
      else if ((item.endDate - now) / (1000 * 60 * 60 * 24) <= 30) status = 'Expiring';
      return { ...item._doc, status };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/items/:id
router.put('/:id', auth, async (req, res) => {
  try {
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

// DELETE /api/items/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/items/test-reminders
router.post('/test-reminders', auth, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = await Item.find({ userId: req.userId, 'reminders.sent': false })
    .populate('userId', 'email name');
  let sent = 0;
  for (let item of items) {
    const end = new Date(item.endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    for (let reminder of item.reminders) {
      if (!reminder.sent && reminder.daysBefore === diffDays) {
        await sendEmail(item.userId.email, `Reminder: ${item.name}`, `Expires in ${diffDays} days`);
        reminder.sent = true;
        sent++;
      }
    }
    await item.save();
  }
  res.json({ message: `Sent ${sent} reminder(s)` });
});

// POST /api/items/:id/test-reminder
router.post('/:id/test-reminder', auth, async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId })
      .populate('userId', 'email name')
      .populate('type', 'name');
    if (!item.userId || !item.userId.email) {
      return res.status(400).json({ message: 'Item owner email not found' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(item.endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    const ownerEmail = item.userId.email;
    const extraEmails = await NotificationEmail.find({ userId: req.userId });
    const allRecipients = [ownerEmail, ...extraEmails.map((e) => e.email)].filter(Boolean);
    const subject = `🔔 Test Reminder – ${item.name} expires in ${diffDays} days`;
    const html = `
      <h2>Test Reminder</h2>
      <p>This is a manual test of your alert system.</p>
      <p><strong>${item.name}</strong> (${item.type?.name || 'N/A'}) will expire on <strong>${item.endDate.toDateString()}</strong>.</p>
      <p>Remaining days: <strong>${diffDays}</strong></p>
      <hr>
      <p><small>Sent by AMC Manager</small></p>
    `;
    for (const to of allRecipients) {
      await sendEmail(to, subject, html);
    }
    res.json({ message: `Test reminder sent to ${allRecipients.length} recipient(s)`, recipients: allRecipients });
  } catch (err) {
    console.error('Test reminder error:', err);
    res.status(500).json({ message: err.message });
  }
});
// POST /api/items/run-reminders  (called by external cron)
router.post('/run-reminders', async (req, res) => {
  try {
    if (req.body.secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // ✅ Respond immediately so cron-job.org doesn't timeout
    res.json({ message: 'Reminder check started' });

    // ✅ Process in background after response is sent
    runReminderCheck().catch(err => {
      console.error('Background reminder error:', err);
    });

  } catch (err) {
    console.error('Manual reminder error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;