const express = require('express');
const Issue = require('../models/Issue');
const router = express.Router();

/**
 * GET /api/stats
 * Returns live aggregate statistics from MongoDB for the dashboard.
 */
router.get('/', async (req, res, next) => {
  try {
    const [total, resolved, inProgress, open, categoryAgg, weeklyAgg] = await Promise.all([
      // Total issues count
      Issue.countDocuments(),
      // Resolved count
      Issue.countDocuments({ status: 'resolved' }),
      // In progress count
      Issue.countDocuments({ status: 'in_progress' }),
      // Open count
      Issue.countDocuments({ status: 'open' }),
      // Issues grouped by category
      Issue.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      // Issues reported per week (last 4 weeks)
      Issue.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%U', // year-weekNumber
                date: '$createdAt'
              }
            },
            reported: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 4 }
      ])
    ]);

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    res.json({
      total,
      resolved,
      inProgress,
      open,
      resolutionRate,
      categoryBreakdown: categoryAgg.map(c => ({
        name: c._id || 'General',
        value: c.count
      })),
      weeklyTrend: weeklyAgg.map((w, i) => ({
        week: `W${i + 1}`,
        reported: w.reported,
        resolved: w.resolved
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
