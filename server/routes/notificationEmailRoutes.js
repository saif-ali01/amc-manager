const express = require('express');
const router = express.Router();
const NotificationEmail = require('../models/NotificationEmail');
const auth = require('../middleware/auth');

// GET all notification emails for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const emails = await NotificationEmail.find({ userId: req.userId }).sort('email');
    res.json(emails);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add a new email
router.post('/', auth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const exists = await NotificationEmail.findOne({ userId: req.userId, email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const entry = new NotificationEmail({ userId: req.userId, email });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE remove an email by its id
router.delete('/:id', auth, async (req, res) => {
  try {
    await NotificationEmail.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Email deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;