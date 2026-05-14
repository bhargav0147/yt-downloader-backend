const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  formatId: {
    type: String,
  },
  quality: {
    type: String,
  },
  type: {
    type: String,
    enum: ['video', 'audio'],
  },
  downloadedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['started', 'completed', 'failed'],
    default: 'started',
  }
});

module.exports = mongoose.model('History', historySchema);
