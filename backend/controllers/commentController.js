const path = require('path');
const dotenv = require('dotenv');
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

/**
 * Helper to call Groq Chat API with automatic model fallback
 */
async function callGroqWithFallback(messages, apiKey) {
  const preferredModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const models = [
    preferredModel,
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
  ];
  const uniqueModels = [...new Set(models.filter(Boolean))];

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return JSON.parse(content);
      }

      const errorText = await response.text();
      console.warn(`Groq API warning for model [${model}]:`, errorText);
      lastError = { status: response.status, message: errorText };

      // If model not found (404), fall back to the next candidate model
      if (response.status !== 404) {
        break;
      }
    } catch (err) {
      console.warn(`Groq request failed for model [${model}]:`, err.message);
      lastError = { status: 500, message: err.message };
    }
  }

  throw lastError || new Error('Failed to generate summary from Groq.');
}

/**
 * POST /api/issues/:id/comments/overview
 * Summarize discussion comments using Groq LLM
 */
exports.getCommentsOverview = async (req, res) => {
  try {
    const { issueTitle, comments } = req.body;
    if (!Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ message: 'No comments to summarize.' });
    }

    if (!process.env.GROQ_API_KEY) {
      dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        message: 'GROQ_API_KEY is not configured in backend environment variables. Please add GROQ_API_KEY to your .env file and restart the backend server.',
      });
    }

    const commentTexts = comments.map(c => (typeof c === 'string' ? c : (c.content || '')));
    const title = issueTitle || 'Campus Infrastructure Issue';

    const messages = [
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
        content: `Issue: ${title}\n\nComments:\n${commentTexts.slice(0, 60).join('\n')}`,
      },
    ];

    const parsed = await callGroqWithFallback(messages, process.env.GROQ_API_KEY);
    res.json(parsed);
  } catch (err) {
    console.error('Error generating comments overview:', err);
    res.status(err.status || 500).json({
      message: 'Failed to generate discussion overview from Groq.',
      error: err.message,
    });
  }
};

