const User = require('../models/User');
const Issue = require('../models/Issue');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Compute live counts from the issues collection
    const reportCount = await Issue.countDocuments({ reporter: req.user.id });
    const resolvedCount = await Issue.countDocuments({ reporter: req.user.id, status: 'resolved' });

    res.json({
      id: user._id,
      anonymousHandle: user.anonymousHandle,
      role: user.role,
      reportCount,
      resolvedCount,
      notificationsEnabled: user.notificationsEnabled,
      joinedAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updates = req.body;
    delete updates.password;
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.getMyIssues = async (req, res, next) => {
  try {
    const issues = await Issue.find({ reporter: req.user.id }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    next(err);
  }
};

