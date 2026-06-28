const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true }
});

locationSchema.index({ userId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Location', locationSchema);