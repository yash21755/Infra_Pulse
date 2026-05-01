const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tags: [String],
  votes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // upvoters
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // downvoters
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    label: { type: String }
  },
  imageUrl: { type: String },
  buildingId: { type: String }, // From Geospatial API
  category: { type: String, default: 'General' }, // For Priority API diversity
  subCommunity: { type: String, default: 'Campus' }, // For Priority API diversity
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Issue', issueSchema);
