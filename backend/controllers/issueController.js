const Issue = require('../models/Issue');
const Notification = require('../models/Notification');

exports.createIssue = async (req, res, next) => {
  try {
    const issueData = { ...req.body, reporter: req.user.id };
    if (req.file) {
      issueData.imageUrl = `/uploads/${req.file.filename}`;
    }
    if (typeof issueData.location === 'string') {
      try {
        issueData.location = JSON.parse(issueData.location);
      } catch (e) {
        // Handle parsing error if needed, or leave it and it defaults to whatever schema does
      }
    }
    const issue = await Issue.create(issueData);
    await Notification.create({ user: req.user.id, message: `Your issue '${issue.title}' was created successfully.` });
    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
};

exports.getIssues = async (req, res, next) => {
  try {
    const issues = await Issue.find()
      .populate('reporter', 'anonymousHandle role')
      .populate('assignee', 'anonymousHandle role')
      .sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    next(err);
  }
};

exports.getIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reporter', 'anonymousHandle role')
      .populate('assignee', 'anonymousHandle role');
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json(issue);
  } catch (err) {
    next(err);
  }
};

exports.updateIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (req.body.status) {
      await Notification.create({ user: issue.reporter, message: `Your reported issue '${issue.title}' is now ${req.body.status}.` });
    }
    res.json(issue);
  } catch (err) {
    next(err);
  }
};

exports.deleteIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json({ message: 'Issue deleted' });
  } catch (err) {
    next(err);
  }
};

exports.voteIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const userId  = req.user.id;
    const type    = req.body.type; // 'up' | 'down'

    const inUpvotes   = issue.votes.some(id => id.toString() === userId.toString());
    const inDownvotes = issue.downvotes.some(id => id.toString() === userId.toString());

    if (type === 'up') {
      if (inUpvotes) {
        // Same direction → remove vote
        issue.votes.pull(userId);
      } else {
        // New upvote — remove from downvotes first if present
        if (inDownvotes) issue.downvotes.pull(userId);
        issue.votes.push(userId);
        if (issue.reporter.toString() !== userId.toString()) {
          await Notification.create({
            user: issue.reporter,
            message: `Someone upvoted your issue "${issue.title}".`,
          });
        }
      }
    } else if (type === 'down') {
      if (inDownvotes) {
        // Same direction → remove vote
        issue.downvotes.pull(userId);
      } else {
        // New downvote — remove from upvotes first if present
        if (inUpvotes) issue.votes.pull(userId);
        issue.downvotes.push(userId);
      }
    }

    await issue.save();

    // Return vote counts + identity arrays so client can derive userVote
    res.json({
      upvotes:   issue.votes.length,
      downvotes: issue.downvotes.length,
      // include the arrays so client knows its own vote state
      upvoterIds:   issue.votes.map(id => id.toString()),
      downvoterIds: issue.downvotes.map(id => id.toString()),
    });
  } catch (err) {
    next(err);
  }
};
