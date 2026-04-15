const AuthorityUpdate = require('../models/AuthorityUpdate');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');

/** GET /api/issues/:id/updates — anyone can read */
exports.getUpdates = async (req, res, next) => {
  try {
    const updates = await AuthorityUpdate.find({ issue: req.params.id })
      .populate('author', 'anonymousHandle role')
      .sort({ createdAt: -1 });
    res.json(updates);
  } catch (err) {
    next(err);
  }
};

/** POST /api/issues/:id/updates — authority only */
exports.postUpdate = async (req, res, next) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ message: 'Only authorities can post updates.' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const { message, tag } = req.body;
    const updateData = {
      issue: req.params.id,
      author: req.user.id,
      message,
      tag,
    };
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const update = await AuthorityUpdate.create(updateData);

    // Auto-update issue status based on tag
    if (tag === 'work_in_progress' && issue.status === 'open') {
      await Issue.findByIdAndUpdate(req.params.id, { status: 'in_progress' });
    } else if (tag === 'finished') {
      await Issue.findByIdAndUpdate(req.params.id, { status: 'resolved' });
    }

    // Notify the reporter
    await Notification.create({
      user: issue.reporter,
      message: `An authority posted an update on your issue "${issue.title}": ${tag === 'finished' ? 'Marked as Finished ✅' : 'Work In Progress 🔧'}`,
    });

    const populated = await AuthorityUpdate.findById(update._id).populate('author', 'anonymousHandle role');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};
