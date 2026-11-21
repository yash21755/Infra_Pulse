const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  issueId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
  author:   { type: String, required: true }, // User anonymousHandle (e.g. IronLynx#7282)
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content:  { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

commentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.issueId = ret.issueId ? ret.issueId.toString() : '';
    ret.parentId = ret.parentId ? ret.parentId.toString() : null;
    return ret;
  }
});

module.exports = mongoose.model('Comment', commentSchema);
