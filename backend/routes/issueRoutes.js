const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
  voteIssue
} = require('../controllers/issueController');
const { getUpdates, postUpdate } = require('../controllers/updateController');
const { getComments, postComment, getCommentsOverview } = require('../controllers/commentController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Collection routes
router.get('/', getIssues);
router.post('/', auth, upload.single('image'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
], validate, createIssue);

// Sub-resource routes FIRST (before generic /:id)
router.get('/:id/updates', getUpdates);
router.post('/:id/updates', auth, upload.single('image'), [
  body('message').notEmpty().withMessage('Message is required'),
  body('tag').isIn(['work_in_progress', 'finished']).withMessage('Tag must be work_in_progress or finished'),
], validate, postUpdate);
router.get('/:id/comments', getComments);
router.post('/:id/comments', auth, [
  body('content').trim().notEmpty().withMessage('Content is required'),
], validate, postComment);
router.post('/:id/comments/overview', getCommentsOverview);
router.post('/:id/vote', auth, voteIssue);

// Generic /:id routes LAST
router.get('/:id', getIssue);
router.put('/:id', auth, updateIssue);
router.delete('/:id', auth, deleteIssue);
// POST /api/issues/:id/comments/overview
router.post('/:id/comments/overview', async (req, res) => {
  try {
    const { issueTitle, comments } = req.body;
    if (!Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ message: 'No comments to summarize.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Summarize campus issue comments concisely like an Amazon review overview. ' +
              'Return strict JSON with keys: "summary" (2-3 plain sentences, no emojis), ' +
              '"highlights" (array of 2-4 short phrases, max 5 words each), ' +
              'and "sentiment" (one short label like "Urgent", "Concerned", "Mixed", or "Resolved").',
          },
          {
            role: 'user',
            content: `Issue: ${issueTitle}\n\nComments:\n${comments.slice(0, 60).join('\n')}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate discussion overview.' });
  }
});
module.exports = router;
