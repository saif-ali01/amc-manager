const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const companies = await Company.find({ userId: req.userId }).sort('name');
    res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const company = new Company({ userId: req.userId, name: name.trim() });
    await company.save();
    res.status(201).json(company);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Company already exists' });
    console.error('Error creating company:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of IDs.' });
    }
    const result = await Company.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: `Deleted ${result.deletedCount} company(s).` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Company.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    console.error('Error deleting company:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;