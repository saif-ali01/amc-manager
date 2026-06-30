const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const vendors = await Vendor.find({ userId: req.userId }).sort('name');
    res.json(vendors);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const vendor = new Vendor({ userId: req.userId, name: name.trim() });
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Vendor already exists' });
    console.error('Error creating vendor:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of IDs.' });
    }
    const result = await Vendor.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: `Deleted ${result.deletedCount} vendor(s).` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Vendor.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;