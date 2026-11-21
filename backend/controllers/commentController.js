const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const User = require('../models/User');

/**
 * GET /api/issues/:id/comments or /api/issues/:issueId/comments
 * Fetch all comments for the given issue ordered by createdAt (oldest first).
 */
exports.getComments = async (req, res, next) => {
  try {
    const issueId = req.params.issueId || req.params.id;
    const comments = await Comment.find({ issueId }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/issues/:id/comments or /api/issues/:issueId/comments
 * Body: { content, parentId }
 * Validate content is non-empty and authenticated user exists.
 */
exports.postComment = async (req, res, next) => {
  try {
    const issueId = req.params.issueId || req.params.id;
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required.' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' });
    }

    let parentCommentId = null;
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found.' });
      }
      parentCommentId = parentComment._id;
    }

    // Resolve author handle from authenticated user
    const user = await User.findById(req.user.id);
    const authorHandle = user?.anonymousHandle || 'Anonymous#0000';

    const comment = await Comment.create({
      issueId: issue._id,
      parentId: parentCommentId,
      author: authorHandle,
      authorId: req.user.id,
      content: content.trim(),
    });

    // Increment comment count on the Issue model
    await Issue.findByIdAndUpdate(issue._id, { $inc: { commentCount: 1 } });

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
};
