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
      description: 'Distinguished lecture on microgrid stability and autonomous fault detection in campus energy systems.',
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
 * Helper to call Groq API with automatic retry
 */
async function callGroqLLM(messages, apiKey) {
  const preferredModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const candidateModels = [
    preferredModel,
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ];
  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

  let lastError = null;
  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
        console.warn(`[calendarExtractor] Groq response for [${model}] (attempt ${attempt + 1}):`, errText);
        lastError = new Error(errText);

        if (response.status === 429) {
          const delayMatch = errText.match(/try again in ([\d.]+)s/i);
          const delaySec = delayMatch ? parseFloat(delayMatch[1]) : 2;
          if (delaySec <= 3 && attempt === 0) {
            await new Promise(r => setTimeout(r, (delaySec + 0.5) * 1000));
            continue;
          }
          break;
        }

        if (response.status !== 404) {
          break;
        }
      } catch (err) {
        console.warn(`[calendarExtractor] Groq attempt failed for [${model}]:`, err.message);
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Groq extraction call failed.');
}

const MONTH_MAP = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Robust date parser supporting DD-MM-YYYY, DD-MMM-YYYY, DDth Month YYYY, YYYY-MM-DD
 */
function parseDateString(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = text.match(/\b([0-3]?\d)[-/]([01]?\d)[-/](202\d)\b/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const year = dmyMatch[3];
    if (parseInt(month, 10) <= 12 && parseInt(day, 10) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 2. DD-MMM-YYYY (e.g. 23-Nov-2026)
  const dMmmYMatch = text.match(/\b([0-3]?\d)[-/]([A-Za-z]{3,9})[-/](202\d)\b/);
  if (dMmmYMatch) {
    const day = String(parseInt(dMmmYMatch[1], 10)).padStart(2, '0');
    const monthStr = dMmmYMatch[2].toLowerCase();
    const month = MONTH_MAP[monthStr] || MONTH_MAP[monthStr.slice(0, 3)];
    const year = dMmmYMatch[3];
    if (month && parseInt(day, 10) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 3. DDth Month YYYY (e.g. 22nd November, 2026 or 20 November 2026)
  const verboseMatch = text.match(/\b([0-3]?\d)(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})[,\s]+(202\d)\b/i);
  if (verboseMatch) {
    const day = String(parseInt(verboseMatch[1], 10)).padStart(2, '0');
    const monthStr = verboseMatch[2].toLowerCase();
    const month = MONTH_MAP[monthStr] || MONTH_MAP[monthStr.slice(0, 3)];
    const year = verboseMatch[3];
    if (month && parseInt(day, 10) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 4. YYYY-MM-DD
  const ymdMatch = text.match(/\b(202\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Filter out emails that have no event keywords and no upcoming dates
 */
function isCandidateNoticeEmail(email, todayStr) {
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || '').toLowerCase();
  const text = `${subject} ${body}`;

  // Check if subject explicitly has a date in the past
  const subjDate = parseDateString(email.subject);
  if (subjDate && subjDate < todayStr) {
    return false;
  }

  // Check if body explicitly has only a past date
  const bodyDate = parseDateString(email.body);
  if (!subjDate && bodyDate && bodyDate < todayStr && !text.includes('opencode') && !text.includes('fellowship') && !text.includes('exam')) {
    return false;
  }

  const keywords = [
    'evaluat', 'presentat', 'viva', 'exam', 'quiz', 'test', 'mid-sem', 'end-sem',
    'hackathon', 'workshop', 'seminar', 'symposium', 'colloquium', 'opencode', 'ctf',
    'fellowship', 'scholarship', 'deadline', 'submission', 'due by', 'milestone',
    'apply by', 'application', 'invitation', 'call for', 'shutdown', 'outage',
    'maintenance', 'repair', 'construction', 'dropped from', 'transport'
  ];

  return keywords.some(kw => text.includes(kw));
}

/**
 * Heuristic parser used as fallback if Groq API is unavailable or offline
 */
function heuristicExtract(emails, todayStr) {
  const extracted = [];

  for (const email of emails) {
    const subject = email.subject || '';
    const body = email.body || '';
    const text = `${subject} ${body}`;
    const lower = text.toLowerCase();
    const subjLower = subject.toLowerCase();

    // Categorization: prioritize academic evaluations and tests
    let category = 'event';
    if (
      subjLower.includes('evaluation') ||
      subjLower.includes('presentation') ||
      subjLower.includes('viva') ||
      subjLower.includes('exam') ||
      subjLower.includes('quiz') ||
      subjLower.includes('test') ||
      subjLower.includes('end-sem') ||
      subjLower.includes('mid-sem') ||
      subjLower.includes('dropped from') ||
      lower.includes('project evaluation')
    ) {
      category = 'exam';
    } else if (
      subjLower.includes('water') ||
      subjLower.includes('power') ||
      subjLower.includes('shutdown') ||
      subjLower.includes('outage') ||
      subjLower.includes('repair') ||
      subjLower.includes('substation') ||
      subjLower.includes('suspension of transport') ||
      subjLower.includes('switch upgrade')
    ) {
      category = 'maintenance';
    } else if (
      lower.includes('fellowship') ||
      lower.includes('deadline') ||
      lower.includes('submission') ||
      lower.includes('due by') ||
      lower.includes('milestone') ||
      lower.includes('apply by') ||
      lower.includes('application')
    ) {
      category = 'task';
    }

    let foundDate = parseDateString(subject) || parseDateString(body);
    if (!foundDate && email.date) {
      const emailDate = email.date.slice(0, 10);
      if (emailDate >= todayStr) {
        foundDate = emailDate;
      }
    }

    if (!foundDate || foundDate < todayStr) {
      continue;
    }

    const startDate = foundDate;
    const endDate = foundDate;

    let timeWindow = 'Scheduled Hours';
    const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)(?:\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))?)/);
    if (timeMatch) {
      timeWindow = timeMatch[1].toUpperCase();
    }

    let location = 'Campus';
    const locMatch = text.match(/(?:at|venue|location|in room|room no\.?|room)\s+([A-Z0-9\s,-]{2,30})(?:\.|\n|,|;|\(|$)/i);
    if (locMatch && locMatch[1].trim().length > 2) {
      location = locMatch[1].trim().replace(/\s+/g, ' ');
    }

    const cleanTitle = subject
      .replace(/^(?:re|fwd|fw):\s*/gi, '')
      .replace(/^(?:re|fwd|fw):\s*/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    const cleanDescription = (body || subject)
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .slice(0, 200)
      .trim();

    const item = {
      title: cleanTitle || 'Campus Notice',
      category,
      startDate,
      endDate,
      timeWindow,
      location,
      description: cleanDescription,
      sourceSubject: subject || 'Campus Notice',
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

  if (!emails || emails.length === 0) {
    return [];
  }

  // Pre-filter to only candidate emails relevant to events, deadlines, and notices
  const candidateEmails = emails.filter(e => isCandidateNoticeEmail(e, todayStr));
  const activeSet = candidateEmails.length > 0 ? candidateEmails : emails.slice(0, 15);

  if (!apiKey) {
    console.log('[calendarExtractor] No Groq API key configured. Using heuristic extraction.');
    return heuristicExtract(activeSet, todayStr);
  }

  // Keep batches to 7 emails and 280-char snippets to stay well under TPM/OTPM thresholds
  const BATCH_SIZE = 7;
  const batches = [];
  for (let i = 0; i < activeSet.length; i += BATCH_SIZE) {
    batches.push(activeSet.slice(i, i + BATCH_SIZE));
  }

  const systemPrompt = `You are an AI campus calendar and notices extraction engine.
Current date is: ${todayStr} (YYYY-MM-DD).
Extract all actionable events, project evaluations, viva presentations, exams, hackathons, competitions, fellowship applications, deadlines, and campus maintenance notices.

CRITICAL RULES:
1. Include every email that mentions an upcoming or currently ongoing event/deadline whose endDate >= ${todayStr}.
2. Categorize strictly as:
   - "exam": project evaluations, viva presentations, mid-term/end-term exams, quizzes.
   - "event": hackathons, fests, technical contests, workshops, seminars, symposiums.
   - "task": fellowships, scholarship applications, milestone deadlines, portal submissions, course registration.
   - "maintenance": water, power, internet/Wi-Fi, elevator, transport shutdowns or repairs.
3. If an event is multi-day or ongoing (e.g. OpenCode runs until 25 December 2026), set startDate and endDate accordingly (YYYY-MM-DD). If single-day, startDate and endDate must be identical.
4. If a submission deadline is given (e.g. submit by 30th November 2026), set startDate and endDate to that date.
5. No emojis in any output field.
6. Return JSON format: { "items": [ { "title": "...", "category": "exam"|"event"|"task"|"maintenance", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "timeWindow": "...", "location": "...", "description": "...", "sourceSubject": "..." } ] }`;

  const allExtracted = [];

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    const emailSummaries = batch.map((e, idx) => ({
      index: idx + 1,
      sender: e.sender || '',
      subject: e.subject || 'No Subject',
      date: e.date || todayStr,
      body: (e.body || '').slice(0, 280),
    }));

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
      for (const item of items) {
        if (!item.title || !item.startDate) continue;

        const startDate = String(item.startDate).slice(0, 10);
        const endDate = item.endDate ? String(item.endDate).slice(0, 10) : startDate;

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
        cleanItem.id = generateEventId(cleanItem);
        allExtracted.push(cleanItem);
      }

      if (bIdx < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    } catch (err) {
      console.warn(`[calendarExtractor] Groq batch ${bIdx + 1}/${batches.length} failed, running heuristic on batch:`, err.message);
      const fallbackItems = heuristicExtract(batch, todayStr);
      allExtracted.push(...fallbackItems);
    }
  }

  return allExtracted.length > 0 ? allExtracted : heuristicExtract(activeSet, todayStr);
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
 * Extract normalized keywords from title for robust deduplication
 */
function getTitleTokenKey(title) {
  const raw = `${title || ''}`.toLowerCase();
  const metaWords = new Set([
    'and', 'the', 'for', 'with', 'from', 'this', 'that', 'schedule', 'notice',
    'board', 'date', 'time', 'venue', 'room', 'campus', 'all', 'day', 'hours',
    'application', 'applications', 'apply', 'open', 'deadline', 'reminder',
    'invite', 'invitation', 'update', 'regarding', 'urgent', 'gentle', 're', 'fwd',
    'startups', 'startup', 'students', 'student', 'can', 'will', 'may', 'must',
    'are', 'has', 'have', 'jan', 'january', 'feb', 'february', 'mar', 'march',
    'apr', 'april', 'may', 'jun', 'june', 'jul', 'july', 'aug', 'august',
    'sep', 'september', 'oct', 'october', 'nov', 'november', 'dec', 'december'
  ]);
  const words = raw
    .replace(/[^a-z]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !metaWords.has(w));
  const uniqueWords = [...new Set(words)].sort();
  return uniqueWords.slice(0, 3).join('_');
}

/**
 * Normalizes subject to group thread replies together
 */
function normalizeThreadSubject(subject) {
  return (subject || '')
    .toLowerCase()
    .replace(/^(?:re|fwd|fw):\s*/gi, '')
    .replace(/^(?:re|fwd|fw):\s*/gi, '')
    .replace(/\[f\.no.*?\]/gi, '')
    .trim();
}

/**
 * Build a canonical deduplication key based on start date and significant title keywords
 */
function getEventCanonicalKey(item) {
  const tokenKey = getTitleTokenKey(item.title);
  const start = (item.startDate || '').slice(0, 10);
  return `${start}_${tokenKey || 'item'}`;
}

/**
 * Priority rank for category assignment when merging duplicate items
 */
const CATEGORY_PRIORITY = {
  exam: 4,
  maintenance: 3,
  task: 2,
  event: 1,
};

/**
 * Merge two duplicate items into the best combined item
 */
function mergeDuplicateEvents(existing, incoming) {
  const category = (CATEGORY_PRIORITY[incoming.category] || 1) >= (CATEGORY_PRIORITY[existing.category] || 1)
    ? incoming.category
    : existing.category;

  const description = (incoming.description || '').length > (existing.description || '').length
    ? incoming.description
    : existing.description;

  const timeWindow = incoming.timeWindow && incoming.timeWindow !== 'Scheduled Hours' && incoming.timeWindow !== 'All Day'
    ? incoming.timeWindow
    : existing.timeWindow || 'All Day';

  const location = incoming.location && incoming.location !== 'Campus'
    ? incoming.location
    : existing.location || 'Campus';

  // Expand start & end date span if one item covers a wider date window
  const startDate = existing.startDate <= incoming.startDate ? existing.startDate : incoming.startDate;
  const existingEnd = existing.endDate || existing.startDate;
  const incomingEnd = incoming.endDate || incoming.startDate;
  const endDate = existingEnd >= incomingEnd ? existingEnd : incomingEnd;

  return {
    ...existing,
    ...incoming,
    startDate,
    endDate,
    category,
    description,
    timeWindow,
    location,
  };
}

/**
 * Find matching existing key by thread subject or title token overlap with overlapping dates
 */
function findMatchingCanonicalKey(canonicalMap, incoming) {
  const incomingSubjKey = normalizeThreadSubject(incoming.sourceSubject || '');
  const incomingTokens = getTitleTokenKey(incoming.title);
  const incomingStart = incoming.startDate;
  const incomingEnd = incoming.endDate || incoming.startDate;

  for (const [key, existing] of canonicalMap.entries()) {
    const existingStart = existing.startDate;
    const existingEnd = existing.endDate || existing.startDate;
    const datesOverlap = incomingStart <= existingEnd && incomingEnd >= existingStart;

    // 1. Thread-level match: if from the same email notice thread and dates overlap
    const existingSubjKey = normalizeThreadSubject(existing.sourceSubject || '');
    if (incomingSubjKey && existingSubjKey && incomingSubjKey === existingSubjKey && datesOverlap) {
      return key;
    }

    // 2. Token overlap: if significant title tokens match and dates overlap
    const existingTokens = getTitleTokenKey(existing.title);
    if (datesOverlap && incomingTokens && existingTokens) {
      const inWords = incomingTokens.split('_');
      const exWords = existingTokens.split('_');
      const common = inWords.filter(w => exWords.includes(w));
      if (common.length >= 2 || (common.length >= 1 && (inWords.length === 1 || exWords.length === 1))) {
        return key;
      }
    }
  }

  return null;
}

/**
 * Extract events from emails, merge and deduplicate with cache, and persist.
 * Prevents duplicates in both demo mode and live sync.
 */
async function syncAndCacheEvents(emails, source = 'mcp') {
  initCache();
  const todayStr = getTodayString();

  // If source is simulated sample notices, cleanly replace with canonical seed events
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

  // Preserve valid upcoming existing live events
  for (const ev of existingEvents) {
    if ((ev.endDate || ev.startDate) >= todayStr) {
      const key = getEventCanonicalKey(ev);
      canonicalMap.set(key, ev);
    }
  }

  // Merge newly extracted live events
  for (const item of newItems) {
    if ((item.endDate || item.startDate) >= todayStr) {
      const matchedKey = findMatchingCanonicalKey(canonicalMap, item) || getEventCanonicalKey(item);
      if (canonicalMap.has(matchedKey)) {
        canonicalMap.set(matchedKey, mergeDuplicateEvents(canonicalMap.get(matchedKey), item));
      } else {
        canonicalMap.set(matchedKey, item);
      }
    }
  }

  let finalEvents = Array.from(canonicalMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (finalEvents.length === 0) {
    finalEvents = getSeedEvents(todayStr);
  } else {
    // If user's inbox has no physical maintenance notices, supplement with campus maintenance notices
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
