const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const vendors = await Vendor.find({ userId: req.userId }).sort('name');
  res.json(vendors);
});

router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  const existing = await Vendor.findOne({ userId: req.userId, name });
  if (existing) return res.status(400).json({ message: 'Vendor already exists' });
  const vendor = new Vendor({ userId: req.userId, name });
  await vendor.save();
  res.status(201).json(vendor);
});

// Optional DELETE for later
router.delete('/:id', auth, async (req, res) => {
  await Vendor.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Vendor deleted' });
});

module.exports = router;