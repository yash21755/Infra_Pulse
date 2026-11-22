const express = require('express');
const router = express.Router();
const { fetchEmailsViaMCP } = require('../services/mcpEmailService');
const { getCachedEvents, syncAndCacheEvents } = require('../services/calendarExtractor');

/**
 * GET /api/calendar/events
 * Returns cached upcoming events & maintenance notices (endDate >= today)
 */
router.get('/events', async (req, res) => {
  try {
    const data = getCachedEvents();
    res.json(data);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve calendar events.',
      error: err.message,
    });
  }
});

/**
 * POST /api/calendar/sync
 * Connects via MCP to email server, extracts upcoming events using Groq,
 * updates cache, and returns refreshed event list.
 */
router.post('/sync', async (req, res) => {
  try {
    console.log('[calendarRoutes] Manual email sync requested...');
    const emailResult = await fetchEmailsViaMCP();

    const emails = emailResult.emails || [];
    const syncResult = await syncAndCacheEvents(emails, emailResult.source);

    res.json({
      ...syncResult,
      emailSource: emailResult.source,
      message: emailResult.message || 'Calendar events synced successfully.',
    });
  } catch (err) {
    console.error('Error syncing calendar from emails:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to sync emails for calendar events.',
      error: err.message,
    });
  }
});

module.exports = router;
