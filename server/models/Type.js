const mongoose = require('mongoose');

const typeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true }
});

typeSchema.index({ userId: 1, name: 1 }, { unique: true }); // Prevent duplicates per user
module.exports = mongoose.model('Type', typeSchema);