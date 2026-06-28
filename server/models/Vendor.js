const mongoose = require('mongoose');
const vendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true }
});
vendorSchema.index({ userId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Vendor', vendorSchema);