const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvtojson = require('csvtojson');
const XLSX = require('xlsx');
const Item = require('../models/Item');
const Type = require('../models/Type');
const Vendor = require('../models/Vendor');
const Company = require('../models/Company');
const Location = require('../models/Location');
const auth = require('../middleware/auth');
const NotificationEmail = require('../models/NotificationEmail');
const sendEmail = require('../utils/sendEmail');
const { runReminderCheck } = require('../utils/scheduler');
const { getStatus, calculateValue } = require('../utils/itemCalc');

const populateFields = [
  { path: 'type', select: 'name' },
  { path: 'provider', select: 'name' },
  { path: 'company', select: 'name' },
  { path: 'location', select: 'name' },
];

const upload = multer({ storage: multer.memoryStorage() });

// ─── ROBUST DATE PARSER ──────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  let str = dateStr.trim();
  if (!str) return null;

  // Try ISO format (YYYY-MM-DD) – we check by regex to avoid false positives
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d)) return d;
  }

  // Map month names (short or full) to month index (0‑11)
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  // 1) Try "DD Month YYYY" (e.g., "20 June 2026")
  const parts = str.split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = monthMap[parts[1].toLowerCase().substring(0, 3)];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      const d = new Date(year, month, day);
      if (!isNaN(d)) return d;
    }
  }

  // 2) Try numeric separators: -, /, .
  const separators = ['-', '/', '.'];
  for (const sep of separators) {
    const parts2 = str.split(sep);
    if (parts2.length === 3) {
      let a = parseInt(parts2[0], 10);
      let b = parseInt(parts2[1], 10);
      let c = parseInt(parts2[2], 10);
      if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
        // Normalise 2‑digit year: if < 70, assume 2000+, else 1900+
        if (c < 100) {
          c += (c < 70 ? 2000 : 1900);
        }
        // Try DD-MM-YYYY first (Indian convention)
        let d1 = new Date(c, b - 1, a);
        if (!isNaN(d1)) return d1;
        // Then try MM-DD-YYYY (US convention) as fallback
        let d2 = new Date(c, a - 1, b);
        if (!isNaN(d2)) return d2;
      }
    }
  }

  // 3) Last resort: let native Date try everything else (e.g., "June 20, 2026")
  const d = new Date(str);
  if (!isNaN(d)) return d;

  return null;
}

// ─── POST /api/items (Create) ──────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, startDate, endDate, reminders, ...rest } = req.body;
    const item = new Item({
      userId: req.userId,
      name,
      type,
      startDate,
      endDate,
      reminders: Array.isArray(reminders)
        ? reminders.map(r => ({ daysBefore: r.daysBefore, sent: false }))
        : [],
      ...rest,
    });
    await item.save();
    const populatedItem = await Item.findById(item._id).populate(populateFields);
    res.status(201).json(populatedItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/items ────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.userId })
      .populate(populateFields)
      .sort({ endDate: 1 });

    const now = new Date();
    const enriched = items.map(item => ({
      ...item._doc,
      status: getStatus(item, now),
      valueInfo: calculateValue(item, now),
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/items/bulk ───────────────────────────────────────────
router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of item IDs.' });
    }
    const result = await Item.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: `Deleted ${result.deletedCount} item(s).` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/items/:id ──────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.endDate) {
      const existing = await Item.findOne({ _id: req.params.id, userId: req.userId });
      if (existing) {
        const oldEnd = new Date(existing.endDate).toDateString();
        const newEnd = new Date(req.body.endDate).toDateString();
        if (oldEnd !== newEnd && !req.body.reminders) {
          req.body.reminders = existing.reminders.map(r => ({
            daysBefore: r.daysBefore,
            sent: false,
          }));
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

// ─── DELETE /api/items/:id ──────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/import ──────────────────────────────────────────
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

    // ── Step 1: preload existing reference docs ──
    const buildMap = (docs) => {
      const map = new Map();
      for (const d of docs) map.set(d.name.trim().toLowerCase(), d._id);
      return map;
    };

    const [existingTypes, existingVendors, existingCompanies, existingLocations] = await Promise.all([
      Type.find({ userId: req.userId }).select('name'),
      Vendor.find({ userId: req.userId }).select('name'),
      Company.find({ userId: req.userId }).select('name'),
      Location.find({ userId: req.userId }).select('name'),
    ]);

    const typeMap = buildMap(existingTypes);
    const vendorMap = buildMap(existingVendors);
    const companyMap = buildMap(existingCompanies);
    const locationMap = buildMap(existingLocations);

    const newTypeNames = new Map();
    const newVendorNames = new Map();
    const newCompanyNames = new Map();
    const newLocationNames = new Map();

    const errors = [];
    const parsedRows = [];

    // ── Step 2: parse rows ──
    rows.forEach((row, i) => {
      try {
        const name = (row['Name'] || row['Item Name'] || row['name'] || '').toString().trim();
        if (!name) {
          errors.push({ row: i + 1, message: 'Name is required' });
          return;
        }

        const typeName = (row['Type'] || row['type'] || '').toString().trim();
        const providerName = (row['Provider'] || row['Vendor'] || row['provider'] || row['vendor'] || '').toString().trim();
        const companyName = (row['Company'] || row['company'] || '').toString().trim();
        const locationName = (row['Location'] || row['location'] || '').toString().trim();
        const startDateStr = (row['Start Date'] || row['StartDate'] || row['start date'] || row['startDate'] || '').toString().trim();
        const endDateStr = (row['End Date'] || row['EndDate'] || row['end date'] || row['endDate'] || '').toString().trim();

        // Clean cost: remove non-numeric except dot and minus
        const costStr = (row['Cost'] || row['cost'] || '').toString().trim().replace(/[^0-9.\-]/g, '');
        const cost = costStr ? parseFloat(costStr) : 0;

        const notes = (row['Notes'] || row['notes'] || '').toString().trim();
        const remindersStr = (row['Reminders'] || row['reminders'] || '').toString().trim();

        const billingTypeRaw = (row['Billing Type'] || row['billingType'] || '').toString().trim().toLowerCase();
        const billingType = ['prepaid', 'postpaid'].includes(billingTypeRaw) ? billingTypeRaw : 'prepaid';

        if (!typeName) {
          errors.push({ row: i + 1, message: 'Type is required' });
          return;
        }

        // ── Parse dates with the improved helper ──
        const startDate = parseDate(startDateStr);
        const endDate = parseDate(endDateStr);
        if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
          errors.push({ row: i + 1, message: `Valid start and end dates are required (got "${startDateStr}" / "${endDateStr}")` });
          return;
        }

        let reminders = [];
        if (remindersStr) {
          reminders = remindersStr
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n))
            .map(n => ({ daysBefore: n, sent: false }));
        }

        const typeKey = typeName.toLowerCase();
        if (!typeMap.has(typeKey) && !newTypeNames.has(typeKey)) newTypeNames.set(typeKey, typeName);

        let vendorKey = null;
        if (providerName) {
          vendorKey = providerName.toLowerCase();
          if (!vendorMap.has(vendorKey) && !newVendorNames.has(vendorKey)) newVendorNames.set(vendorKey, providerName);
        }

        let companyKey = null;
        if (companyName) {
          companyKey = companyName.toLowerCase();
          if (!companyMap.has(companyKey) && !newCompanyNames.has(companyKey)) newCompanyNames.set(companyKey, companyName);
        }

        let locationKey = null;
        if (locationName) {
          locationKey = locationName.toLowerCase();
          if (!locationMap.has(locationKey) && !newLocationNames.has(locationKey)) newLocationNames.set(locationKey, locationName);
        }

        parsedRows.push({
          rowNum: i + 1,
          name,
          typeKey,
          vendorKey,
          companyKey,
          locationKey,
          startDate,
          endDate,
          cost,
          notes,
          reminders,
          billingType,
        });
      } catch (err) {
        errors.push({ row: i + 1, message: err.message });
      }
    });

    // ── Step 3: bulk-create missing references ──
    const bulkCreate = async (Model, namesMap, map) => {
      if (namesMap.size === 0) return;
      const docsToInsert = [...namesMap.values()].map(name => ({ userId: req.userId, name }));
      const inserted = await Model.insertMany(docsToInsert, { ordered: false });
      inserted.forEach(doc => map.set(doc.name.trim().toLowerCase(), doc._id));
    };

    await Promise.all([
      bulkCreate(Type, newTypeNames, typeMap),
      bulkCreate(Vendor, newVendorNames, vendorMap),
      bulkCreate(Company, newCompanyNames, companyMap),
      bulkCreate(Location, newLocationNames, locationMap),
    ]);

    // ── Step 4: bulk insert items ──
    const itemsToInsert = parsedRows.map(r => ({
      userId: req.userId,
      name: r.name,
      type: typeMap.get(r.typeKey),
      provider: r.vendorKey ? vendorMap.get(r.vendorKey) : null,
      company: r.companyKey ? companyMap.get(r.companyKey) : null,
      location: r.locationKey ? locationMap.get(r.locationKey) : null,
      startDate: r.startDate,
      endDate: r.endDate,
      cost: r.cost,
      notes: r.notes,
      reminders: r.reminders,
      billingType: r.billingType,
    }));

    let insertedCount = 0;
    if (itemsToInsert.length > 0) {
      try {
        const inserted = await Item.insertMany(itemsToInsert, { ordered: false });
        insertedCount = inserted.length;
      } catch (bulkErr) {
        if (bulkErr.insertedDocs) insertedCount = bulkErr.insertedDocs.length;
        if (Array.isArray(bulkErr.writeErrors)) {
          bulkErr.writeErrors.forEach(we => {
            const failedIndex = we.index;
            const failedRow = parsedRows[failedIndex];
            errors.push({
              row: failedRow ? failedRow.rowNum : '?',
              message: we.errmsg || we.err?.errmsg || 'Failed to insert row',
            });
          });
        } else {
          throw bulkErr;
        }
      }
    }

    res.json({
      message: `Imported ${insertedCount} of ${rows.length} items`,
      importedCount: insertedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/items/:id/test-reminder ──────────────────────────────
router.post('/:id/test-reminder', auth, async (req, res) => {
  // ... unchanged, keep as is ...
});

// ─── POST /api/items/run-reminders ──────────────────────────────────
router.post('/run-reminders', async (req, res) => {
  // ... unchanged, keep as is ...
});

// ─── POST /api/items/test-reminders ──────────────────────────────────
router.post('/test-reminders', auth, async (req, res) => {
  // ... unchanged, keep as is ...
});

module.exports = router;