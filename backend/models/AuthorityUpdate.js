const mongoose = require('mongoose');

const authorityUpdateSchema = new mongoose.Schema({
  issue:     { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
  author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:   { type: String, required: true },
  tag:       { type: String, enum: ['work_in_progress', 'finished'], required: true },
  imageUrl:  { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AuthorityUpdate', authorityUpdateSchema);
