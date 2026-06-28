const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const locations = await Location.find({ userId: req.userId }).sort('name');
    res.json(locations);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const location = new Location({ userId: req.userId, name: name.trim() });
    await location.save();
    res.status(201).json(location);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Location already exists' });
    console.error('Error creating location:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Location.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Location deleted' });
  } catch (err) {
    console.error('Error deleting location:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;