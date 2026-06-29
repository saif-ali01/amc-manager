const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvtojson = require('csvtojson');
const XLSX = require('xlsx');
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

// Configure multer – store file in memory (for import)
const upload = multer({ storage: multer.memoryStorage() });

// ─── POST /api/items (Create) ─────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, startDate, endDate, reminders, ...rest } = req.body;
    const item = new Item({
      userId: req.userId,
      name,
      type,
      startDate,
      endDate,
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

// ─── GET /api/items (List all for user) ───────────────────────────────────────
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

// ─── PUT /api/items/:id (Update) ──────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.endDate) {
      const existing = await Item.findOne({ _id: req.params.id, userId: req.userId });
      if (existing) {
        const oldEnd = new Date(existing.endDate).toDateString();
        const newEnd = new Date(req.body.endDate).toDateString();
        if (oldEnd !== newEnd) {
          req.body.reminders = existing.reminders.map(r => ({
            daysBefore: r.daysBefore,
            sent: false,
          }));
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

// ─── DELETE /api/items/:id (Single delete) ───────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/items/bulk (Bulk delete) ─────────────────────────────────────
router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body; // array of item IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of item IDs.' });
    }
    const result = await Item.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: `Deleted ${result.deletedCount} item(s).` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/import (Bulk import from CSV/Excel) ──────────────────────
router.post('/import', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const buffer = req.file.buffer;
    const filename = req.file.originalname.toLowerCase();
    let rows = [];

    if (filename.endsWith('.csv')) {
      const csvString = buffer.toString('utf-8');
      rows = await csvtojson().fromString(csvString);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please upload CSV or Excel.' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No data found in file' });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row['Name'] || row['Item Name'] || row['name'] || '';
        if (!name.trim()) {
          errors.push({ row: i + 1, message: 'Name is required' });
          continue;
        }

        const typeName = (row['Type'] || row['type'] || '').trim();
        const providerName = (row['Provider'] || row['Vendor'] || row['provider'] || row['vendor'] || '').trim();
        const companyName = (row['Company'] || row['company'] || '').trim();
        const locationName = (row['Location'] || row['location'] || '').trim();
        const startDateStr = (row['Start Date'] || row['StartDate'] || row['start date'] || row['startDate'] || '').trim();
        const endDateStr = (row['End Date'] || row['EndDate'] || row['end date'] || row['endDate'] || '').trim();
        const costStr = (row['Cost'] || row['cost'] || '').trim();
        const notes = (row['Notes'] || row['notes'] || '').trim();
        const remindersStr = (row['Reminders'] || row['reminders'] || '').trim();

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        if (!startDateStr || !endDateStr || isNaN(startDate) || isNaN(endDate)) {
          errors.push({ row: i + 1, message: 'Valid start and end dates are required' });
          continue;
        }

        // Helper to find or create related documents
        const findOrCreate = async (Model, name) => {
          if (!name) return null;
          let doc = await Model.findOne({ userId: req.userId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
          if (!doc) {
            doc = new Model({ userId: req.userId, name });
            await doc.save();
          }
          return doc._id;
        };

        const typeId = await findOrCreate(require('../models/Type'), typeName);
        const providerId = await findOrCreate(require('../models/Vendor'), providerName);
        const companyId = await findOrCreate(require('../models/Company'), companyName);
        const locationId = await findOrCreate(require('../models/Location'), locationName);

        let reminders = [];
        if (remindersStr) {
          reminders = remindersStr.split(',').map(s => {
            const num = parseInt(s.trim(), 10);
            return isNaN(num) ? null : { daysBefore: num, sent: false };
          }).filter(r => r !== null);
        } else {
          reminders = [{ daysBefore: 30, sent: false }, { daysBefore: 15, sent: false }, { daysBefore: 7, sent: false }];
        }

        const item = new Item({
          userId: req.userId,
          name,
          type: typeId,
          provider: providerId,
          company: companyId,
          location: locationId,
          startDate,
          endDate,
          cost: costStr ? parseFloat(costStr) : 0,
          notes,
          reminders,
        });

        await item.save();
        const populated = await Item.findById(item._id).populate(populateFields);
        imported.push(populated);
      } catch (err) {
        console.error(`Row ${i+1} error:`, err);
        errors.push({ row: i + 1, message: err.message });
      }
    }

    res.json({
      message: `Imported ${imported.length} of ${rows.length} items`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/:id/test-reminder (Single test) ─────────────────────────
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

// ─── POST /api/items/run-reminders (External cron trigger) ───────────────────
router.post('/run-reminders', async (req, res) => {
  if (req.body.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.json({ message: 'Reminder check started in background' });

  runReminderCheck().catch(err => {
    console.error('❌ Background reminder check failed:', err.message);
  });
});

// ─── POST /api/items/test-reminders (Bulk test for dev) ──────────────────────
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
          break;
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