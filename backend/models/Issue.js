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
  publicId: { type: String, unique: true, sparse: true },
  imageUrl: { type: String },
  h3_res12: { type: String, immutable: true }, // Uber H3 Resolution 12 spatial index (immutable)
  buildingId: { type: String }, // Legacy identifier maintained for compatibility
  commentCount: { type: Number, default: 0 },
  category: { type: String, default: 'General' }, // For Priority API diversity
  subCommunity: { type: String, default: 'Campus' }, // For Priority API diversity
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Issue', issueSchema);
