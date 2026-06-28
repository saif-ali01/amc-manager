const mongoose = require('mongoose');

const notificationEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, trim: true, lowercase: true }
});

notificationEmailSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('NotificationEmail', notificationEmailSchema);