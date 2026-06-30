const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Type',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  billingType: {
    type: String,
    enum: ['prepaid', 'postpaid'],
    default: 'prepaid'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  cost: {
    type: Number,
    default: 0
  },
  notes: String,
  reminders: [{
    daysBefore: {
      type: Number,
      required: true
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['Active', 'Expiring', 'Expired'],
    default: 'Active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);