const express = require('express');
const router = express.Router();
const Type = require('../models/Type');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const types = await Type.find({ userId: req.userId }).sort('name');
    res.json(types);
  } catch (err) {
    console.error('Error fetching types:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const type = new Type({ userId: req.userId, name: name.trim() });
    await type.save();
    res.status(201).json(type);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Type already exists' });
    console.error('Error creating type:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── BULK DELETE must come BEFORE /:id ───
router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of IDs.' });
    }
    const result = await Type.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: `Deleted ${result.deletedCount} type(s).` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Type.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Type deleted' });
  } catch (err) {
    console.error('Error deleting type:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;