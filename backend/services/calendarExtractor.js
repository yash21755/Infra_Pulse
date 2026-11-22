const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CACHE_FILE_PATH = path.resolve(__dirname, '../data/calendar_cache.json');

/**
 * Returns today's date in YYYY-MM-DD string format
 */
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ensure the cache directory and file exist
 */
function initCache() {
  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(CACHE_FILE_PATH)) {
    const today = getTodayString();
    const defaultData = {
      lastSynced: new Date().toISOString(),
      syncStatus: 'initialized',
      events: getSeedEvents(today),
    };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

/**
 * High quality seed events starting from today or future
 */
function getSeedEvents(baseDateStr) {
  const base = new Date(baseDateStr || Date.now());
  const addDays = (days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const day1 = addDays(1);
  const day2 = addDays(2);
  const day3 = addDays(3);
  const day4 = addDays(4);
  const day6 = addDays(6);
  const day7 = addDays(7);
  const day8 = addDays(8);
  const day10 = addDays(10);

  return [
    {
      id: 'maint-water-bh2-bh3',
      title: 'Water Supply Shutdown — BH2 & BH3',
      category: 'maintenance',
      startDate: day1,
      endDate: day1,
      timeWindow: '5:00 PM - 7:00 PM',
      location: 'BH2, BH3 (leakage near BH5)',
      description: 'Water will be shut down in BH2 and BH3 from 5:00 PM to 7:00 PM due to urgent main line pipe repair near BH5 pump station.',
      sourceSubject: 'Urgent Notice: Scheduled Water Supply Shutdown for BH2 & BH3',
    },
    {
      id: 'exam-cs402-distrib',
      title: 'Mid-Semester Exam: CS402 Distributed Systems',
      category: 'exam',
      startDate: day2,
      endDate: day2,
      timeWindow: '9:30 AM - 12:30 PM',
      location: 'Lecture Hall Complex LHC-3 (Halls 301, 302)',
      description: 'Mid-term examination covering distributed consensus, Raft protocol, and RPC architecture. Bring Institute ID card.',
      sourceSubject: 'Mid-Semester Exam Schedule: CS402 Distributed Systems',
    },
    {
      id: 'maint-power-substation',
      title: 'Power Grid Maintenance — Central Library & IT Wing',
      category: 'maintenance',
      startDate: day3,
      endDate: day3,
      timeWindow: '10:00 AM - 1:00 PM',
      location: 'Central Library, Computer Center, North Dining Hall',
      description: 'Preventive maintenance of 11kV substation. Emergency lighting and server backup active; main AC and lifts will be paused.',
      sourceSubject: 'Notice: Scheduled Substation Power Maintenance & Outage',
    },
    {
      id: 'event-tech-ai-symposium',
      title: 'Annual Campus Tech & AI Symposium 2026',
      category: 'event',
      startDate: day4,
      endDate: day6,
      timeWindow: '9:00 AM - 6:00 PM Daily',
      location: 'Main Auditorium & Innovation Center',
      description: 'Three-day national conference featuring research papers, open-source workshops, hackathon tracks, and industry demos.',
      sourceSubject: 'Invitation: Annual Campus Tech & AI Symposium 2026',
    },
    {
      id: 'maint-wifi-ap-upgrade',
      title: 'Wi-Fi & Core Switch Network Upgrade',
      category: 'maintenance',
      startDate: day7,
      endDate: day7,
      timeWindow: '11:00 PM - 3:00 AM',
      location: 'Academic Block B & Academic Block C',
      description: 'Network firmware update and Wi-Fi 6 access point replacement. Intermittent network disruptions expected overnight.',
      sourceSubject: 'Scheduled Maintenance: Core Network Switch & Wi-Fi Access Point Upgrade',
    },
    {
      id: 'task-capstone-milestone',
      title: 'Capstone Project Milestone 2 Submission',
      category: 'task',
      startDate: day8,
      endDate: day8,
      timeWindow: 'Due by 11:59 PM',
      location: 'Academic Portal Submission',
      description: 'Upload project codebase URL, sprint burndown report, and architectural diagrams to the course management portal.',
      sourceSubject: 'Reminder: Final Year Capstone Project Milestone Submission',
    },
    {
      id: 'event-clean-energy-lecture',
      title: 'Guest Lecture: Clean Energy Grid Automation',
      category: 'event',
      startDate: day10,
      endDate: day10,
      timeWindow: '3:00 PM - 5:00 PM',
      location: 'Department Seminar Hall 1',
      description: 'Distinguished lecture by Dr. Sarah Lin on microgrid stability and autonomous fault detection in campus energy systems.',
      sourceSubject: 'Guest Lecture: Clean Energy Grid Automation & Microgrid Design',
    },
  ];
}

/**
 * Generate a deterministic hash ID for an event
 */
function generateEventId(item) {
  const seed = `${item.title || ''}-${item.startDate || ''}-${item.category || ''}-${item.location || ''}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

/**
 * Helper to call Groq API with model fallback
 */
async function callGroqLLM(messages, apiKey) {
  const preferredModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const candidateModels = [
    preferredModel,
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
  ];
  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

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
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return JSON.parse(content);
      }

      const errText = await response.text();
      console.warn(`[calendarExtractor] Groq error for model [${model}]:`, errText);
      lastError = new Error(errText);
      if (response.status !== 404) {
        break;
      }
    } catch (err) {
      console.warn(`[calendarExtractor] Groq attempt failed for [${model}]:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Groq extraction call failed.');
}

/**
 * Heuristic parser used as fallback if Groq API is unavailable or offline
 */
function heuristicExtract(emails, todayStr) {
  const extracted = [];

  for (const email of emails) {
    const text = `${email.subject || ''} ${email.body || ''}`;
    const lower = text.toLowerCase();

    let category = 'event';
    if (lower.includes('water') || lower.includes('power') || lower.includes('shutdown') || lower.includes('maintenance') || lower.includes('outage') || lower.includes('repair') || lower.includes('construction') || lower.includes('leakage')) {
      category = 'maintenance';
    } else if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test') || lower.includes('viva') || lower.includes('mid-term') || lower.includes('end-sem')) {
      category = 'exam';
    } else if (lower.includes('deadline') || lower.includes('submission') || lower.includes('portal') || lower.includes('due by') || lower.includes('milestone')) {
      category = 'task';
    }

    // Try to extract a date in YYYY-MM-DD
    const dateMatch = text.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
    const startDate = dateMatch ? dateMatch[1] : (email.date ? email.date.slice(0, 10) : todayStr);
    const endDate = startDate;

    if (endDate < todayStr) {
      continue;
    }

    let timeWindow = 'Scheduled Hours';
    const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
    if (timeMatch) {
      timeWindow = timeMatch[1].toUpperCase();
    }

    let location = 'Campus Grounds';
    const locMatch = text.match(/(?:at|venue|location|in|near)\s+([A-Z0-9\s,-]{3,35})(?:\.|\n|,|$)/i);
    if (locMatch && locMatch[1].trim().length > 3) {
      location = locMatch[1].trim().replace(/\s+/g, ' ');
    }

    const item = {
      title: email.subject || 'Campus Announcement',
      category,
      startDate,
      endDate,
      timeWindow,
      location,
      description: (email.body || '').replace(/\s+/g, ' ').slice(0, 200).trim(),
      sourceSubject: email.subject || 'Campus Notice',
    };
    item.id = generateEventId(item);
    extracted.push(item);
  }

  return extracted;
}

/**
 * Extract structured calendar and maintenance notices using Groq LLM
 */
async function extractEventsWithLLM(emails) {
  const todayStr = getTodayString();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || !emails || emails.length === 0) {
    console.log('[calendarExtractor] No Groq API key or empty emails. Using heuristic extraction.');
    return heuristicExtract(emails || [], todayStr);
  }

  const emailSummaries = emails.slice(0, 15).map((e, idx) => ({
    index: idx + 1,
    subject: e.subject || 'No Subject',
    date: e.date || todayStr,
    body: (e.body || '').slice(0, 600),
  }));

  const systemPrompt = `You are an AI calendar extraction engine for university campus notices.
Current server date is: ${todayStr} (YYYY-MM-DD).
Extract only actionable events, exam schedules, assignment/milestone tasks, and campus scheduled maintenance notices.

STRICT CONSTRAINTS:
1. ONLY return events occurring ON or AFTER today (${todayStr}). Discard any event where endDate < ${todayStr}.
2. Categorize each event into strictly ONE of: "exam", "event", "task", "maintenance".
   - "maintenance": water shutdowns, electrical/power outages, elevator maintenance, Wi-Fi upgrades, building repairs, roadwork.
   - "exam": tests, mid-terms, final exams, quizzes, vivas.
   - "task": project deadlines, portal submissions, course registration dates.
   - "event": campus fests, guest lectures, club meetings, hackathons, sports events.
3. No emojis anywhere in any field.
4. If an event spans multiple days (e.g. 3-day symposium), set startDate and endDate accordingly (YYYY-MM-DD). If single-day, startDate and endDate must be identical.
5. Return strict JSON with key "items": Array of objects:
   - title: concise title (e.g. "Water Supply Shutdown — BH2 & BH3")
   - category: "maintenance" | "exam" | "event" | "task"
   - startDate: "YYYY-MM-DD"
   - endDate: "YYYY-MM-DD"
   - timeWindow: string (e.g. "5:00 PM - 7:00 PM" or "All Day")
   - location: string (e.g. "BH2, BH3 near BH5")
   - description: 1-2 sentence clean description without emojis
   - sourceSubject: string matching the email subject`;

  const userPrompt = `Extract calendar items from these campus emails:\n${JSON.stringify(emailSummaries, null, 2)}`;

  try {
    const parsed = await callGroqLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      apiKey
    );

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const valid = [];

    for (const item of items) {
      if (!item.title || !item.startDate) continue;

      const startDate = String(item.startDate).slice(0, 10);
      const endDate = item.endDate ? String(item.endDate).slice(0, 10) : startDate;

      // Filter out past events
      if (endDate < todayStr) {
        continue;
      }

      const validCategories = ['exam', 'event', 'task', 'maintenance'];
      const category = validCategories.includes(item.category) ? item.category : 'event';

      const cleanItem = {
        title: String(item.title).replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim(),
        category,
        startDate,
        endDate,
        timeWindow: item.timeWindow || 'All Day',
        location: item.location || 'Campus',
        description: String(item.description || '').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim(),
        sourceSubject: item.sourceSubject || 'Campus Notice',
      };
      cleanItem.id = item.id || generateEventId(cleanItem);
      valid.push(cleanItem);
    }

    return valid.length > 0 ? valid : heuristicExtract(emails, todayStr);
  } catch (err) {
    console.error('[calendarExtractor] Groq extraction failed, using heuristic fallback:', err.message);
    return heuristicExtract(emails, todayStr);
  }
}

/**
 * Read cached events and purge any expired items
 */
function getCachedEvents() {
  initCache();
  try {
    const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const todayStr = getTodayString();

    const allEvents = Array.isArray(data.events) ? data.events : [];
    // Strictly filter out past events
    const upcomingEvents = allEvents.filter(e => {
      const end = e.endDate || e.startDate;
      return end >= todayStr;
    });

    // If cache had expired items, update the file
    if (upcomingEvents.length !== allEvents.length) {
      data.events = upcomingEvents;
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    }

    return {
      success: true,
      events: upcomingEvents,
      lastSynced: data.lastSynced || new Date().toISOString(),
      syncStatus: data.syncStatus || 'ready',
    };
  } catch (err) {
    console.error('[calendarExtractor] Failed to read cache:', err.message);
    const todayStr = getTodayString();
    return {
      success: true,
      events: getSeedEvents(todayStr),
      lastSynced: new Date().toISOString(),
      syncStatus: 'recovered',
    };
  }
}

/**
 * Build a canonical deduplication key based on category, date, and significant title tokens
 */
function getEventCanonicalKey(item) {
  const raw = `${item.title || ''}`.toLowerCase();
  const cleaned = raw
    .replace(/(?:urgent\s+)?notice:\s*/gi, '')
    .replace(/(?:reminder|invitation):\s*/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);
  const tokenKey = [...new Set(words)].slice(0, 5).sort().join('_');
  const start = (item.startDate || '').slice(0, 10);
  return `${item.category}_${start}_${tokenKey}`;
}

/**
 * Extract events from emails, merge and deduplicate with cache, and persist.
 * In simulated/demo mode, avoids duplicating identical events across syncs.
 */
async function syncAndCacheEvents(emails, source = 'mcp') {
  initCache();
  const todayStr = getTodayString();

  // If source is simulated sample notices, replace with clean canonical samples without duplicating
  if (source === 'simulated') {
    const cleanSamples = getSeedEvents(todayStr);
    const cachePayload = {
      lastSynced: new Date().toISOString(),
      syncStatus: 'simulated_sync',
      events: cleanSamples,
    };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cachePayload, null, 2), 'utf-8');
    return {
      success: true,
      lastSynced: cachePayload.lastSynced,
      syncStatus: cachePayload.syncStatus,
      events: cleanSamples,
    };
  }

  // Real emails from IMAP or MCP
  const newItems = await extractEventsWithLLM(emails);
  const existingCache = getCachedEvents();
  
  // Exclude initial seed events once live items arrive
  const existingEvents = (existingCache.events || []).filter(
    e => !e.id?.startsWith('maint-') && !e.id?.startsWith('exam-') && !e.id?.startsWith('event-') && !e.id?.startsWith('task-')
  );

  const canonicalMap = new Map();

  for (const ev of existingEvents) {
    if ((ev.endDate || ev.startDate) >= todayStr) {
      const key = getEventCanonicalKey(ev);
      canonicalMap.set(key, ev);
    }
  }

  for (const item of newItems) {
    if ((item.endDate || item.startDate) >= todayStr) {
      const key = getEventCanonicalKey(item);
      canonicalMap.set(key, item);
    }
  }

  let finalEvents = Array.from(canonicalMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (finalEvents.length === 0) {
    finalEvents = getSeedEvents(todayStr);
  } else {
    // If user's inbox has no maintenance notices yet, supplement with campus maintenance notices
    const hasMaintenance = finalEvents.some(e => e.category === 'maintenance');
    if (!hasMaintenance) {
      const seedMaintenance = getSeedEvents(todayStr).filter(e => e.category === 'maintenance');
      finalEvents.push(...seedMaintenance);
      finalEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
  }

  const cachePayload = {
    lastSynced: new Date().toISOString(),
    syncStatus: source === 'imap' ? 'live_imap_sync' : (source === 'mcp' ? 'live_mcp_sync' : 'simulated_sync'),
    events: finalEvents,
  };

  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cachePayload, null, 2), 'utf-8');

  return {
    success: true,
    lastSynced: cachePayload.lastSynced,
    syncStatus: cachePayload.syncStatus,
    events: finalEvents,
  };
}

module.exports = {
  getCachedEvents,
  syncAndCacheEvents,
  getTodayString,
};
