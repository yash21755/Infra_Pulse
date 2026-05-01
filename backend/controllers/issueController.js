const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const fs = require('fs');

const GEOSPATIAL_API_URL = process.env.GEOSPATIAL_API_URL || 'http://127.0.0.1:8001';
const REDUNDANCY_API_URL = process.env.REDUNDANCY_API_URL || 'http://127.0.0.1:8002';
const PRIORITY_API_URL = process.env.PRIORITY_API_URL || 'http://127.0.0.1:8003';

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
        // Handle parsing error if needed
      }
    }

    let buildingId = null;
    let category = 'General';
    let subCommunity = 'Campus';

    // 1. Geospatial check
    if (issueData.location && issueData.location.lat && issueData.location.lng) {
      try {
        const geoRes = await fetch(`${GEOSPATIAL_API_URL}/resolve-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: issueData.location.lat,
            longitude: issueData.location.lng
          })
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.success && geoData.building_id) {
            buildingId = geoData.building_id;
            issueData.buildingId = buildingId;
            if (geoData.building_type) {
              category = geoData.building_type;
            }
            subCommunity = buildingId;
          }
        }
      } catch (err) {
        console.error('Geospatial API error:', err.message);
      }
    }
    
    issueData.category = category;
    issueData.subCommunity = subCommunity;

    // 2. Redundancy check (only if buildingId is known)
    if (buildingId) {
      try {
        const formData = new FormData();
        formData.append('building_id', buildingId);
        formData.append('text', issueData.description || issueData.title);
        
        if (req.file) {
          const fileBuffer = fs.readFileSync(req.file.path);
          const blob = new Blob([fileBuffer], { type: req.file.mimetype });
          formData.append('image', blob, req.file.originalname);
        }

        const redRes = await fetch(`${REDUNDANCY_API_URL}/check-redundancy`, {
          method: 'POST',
          body: formData
        });
        
        if (redRes.ok) {
          const redData = await redRes.json();
          if (redData.is_redundant) {
            // Duplicate detected!
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(409).json({
              message: 'Duplicate issue detected.',
              redundancyData: redData
            });
          }
        }
      } catch (err) {
        console.error('Redundancy API error:', err.message);
      }
    }

    // Save to Mongo
    const issue = await Issue.create(issueData);

    // 3. Register with Redundancy API
    if (buildingId) {
      try {
        const regFormData = new FormData();
        regFormData.append('issue_id', issue._id.toString());
        regFormData.append('building_id', buildingId);
        regFormData.append('text', issue.description || issue.title);
        if (req.file) {
          const fileBuffer = fs.readFileSync(req.file.path);
          const blob = new Blob([fileBuffer], { type: req.file.mimetype });
          regFormData.append('image', blob, req.file.originalname);
        }
        await fetch(`${REDUNDANCY_API_URL}/register-issue`, {
          method: 'POST',
          body: regFormData
        });
      } catch (err) {
        console.error('Redundancy Registration error:', err.message);
      }
    }

    // 4. Register with Priority API
    try {
      await fetch(`${PRIORITY_API_URL}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: issue._id.toString(),
          category: issue.category || 'General',
          sub_community: issue.subCommunity || 'Campus',
          building_id: buildingId || null
        })
      });
    } catch (err) {
      console.error('Priority API Registration error:', err.message);
    }

    await Notification.create({ user: req.user.id, message: `Your issue '${issue.title}' was created successfully.` });
    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
};

exports.getIssues = async (req, res, next) => {
  try {
    let sortedIssueIds = null;
    try {
      // 1. Fetch ranked front page from Priority API
      const limit = parseInt(req.query.limit) || 20;
      const buildingId = req.query.buildingId || '';
      let url = `${PRIORITY_API_URL}/front-page?limit=${limit}`;
      if (buildingId) url += `&building_id=${buildingId}`;
      
      const pRes = await fetch(url);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.issues && pData.issues.length > 0) {
          sortedIssueIds = pData.issues.map(i => i.issue_id);
        }
      }
    } catch (err) {
      console.error('Priority API Fetch error:', err.message);
    }

    // 2. Fetch from Mongo
    let issues;
    if (sortedIssueIds && sortedIssueIds.length > 0) {
      issues = await Issue.find({ _id: { $in: sortedIssueIds } })
        .populate('reporter', 'anonymousHandle role')
        .populate('assignee', 'anonymousHandle role');
      
      // Sort issues array according to sortedIssueIds order
      const issueMap = new Map(issues.map(i => [i._id.toString(), i]));
      issues = sortedIssueIds.map(id => issueMap.get(id)).filter(i => i);
    } else {
      issues = await Issue.find()
        .populate('reporter', 'anonymousHandle role')
        .populate('assignee', 'anonymousHandle role')
        .sort({ createdAt: -1 });
    }

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
      
      // If resolved, mark resolved in priority API
      if (req.body.status === 'resolved' || req.body.status === 'closed') {
        try {
          await fetch(`${PRIORITY_API_URL}/issues/${issue._id}/resolve`, { method: 'PATCH' });
          await fetch(`${REDUNDANCY_API_URL}/issues/${issue._id}`, { method: 'DELETE' });
        } catch (e) {
          console.error('Failed to notify APIs about resolution:', e.message);
        }
      }
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
    
    // Notify APIs
    try {
      await fetch(`${PRIORITY_API_URL}/issues/${req.params.id}`, { method: 'DELETE' });
      await fetch(`${REDUNDANCY_API_URL}/issues/${req.params.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to notify APIs about deletion:', e.message);
    }

    res.json({ message: 'Issue deleted' });
  } catch (err) {
    next(err);
  }
};

const sendVoteToPriorityApi = async (issueId, voteType) => {
  try {
    await fetch(`${PRIORITY_API_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issue_id: issueId.toString(),
        vote_type: voteType,
        dwell_seconds: 5.0 // Default assuming > 3.0s minimum
      })
    });
  } catch (err) {
    console.error('Priority API Vote error:', err.message);
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
        await sendVoteToPriorityApi(issue._id, 'undo_upvote');
      } else {
        // New upvote — remove from downvotes first if present
        if (inDownvotes) {
          issue.downvotes.pull(userId);
          await sendVoteToPriorityApi(issue._id, 'undo_downvote');
        }
        issue.votes.push(userId);
        await sendVoteToPriorityApi(issue._id, 'upvote');
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
        await sendVoteToPriorityApi(issue._id, 'undo_downvote');
      } else {
        // New downvote — remove from upvotes first if present
        if (inUpvotes) {
          issue.votes.pull(userId);
          await sendVoteToPriorityApi(issue._id, 'undo_upvote');
        }
        issue.downvotes.push(userId);
        await sendVoteToPriorityApi(issue._id, 'downvote');
      }
    }

    await issue.save();

    res.json({
      upvotes:   issue.votes.length,
      downvotes: issue.downvotes.length,
      upvoterIds:   issue.votes.map(id => id.toString()),
      downvoterIds: issue.downvotes.map(id => id.toString()),
    });
  } catch (err) {
    next(err);
  }
};
