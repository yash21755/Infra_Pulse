const path = require('path');
const dotenv = require('dotenv');

// Dynamically ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let Client = null;
let StdioClientTransport = null;
let ImapFlow = null;
let simpleParser = null;

try {
  const sdkPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/cjs');
  ({ Client } = require(path.join(sdkPath, 'client/index.js')));
  ({ StdioClientTransport } = require(path.join(sdkPath, 'client/stdio.js')));
} catch (err) {
  try {
    ({ Client } = require('@modelcontextprotocol/sdk/client'));
    ({ StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio'));
  } catch (innerErr) {
    // SDK fallback
  }
}

try {
  ({ ImapFlow } = require('imapflow'));
} catch (err) {
  console.warn('[mcpEmailService] imapflow load notice:', err.message);
}

try {
  ({ simpleParser } = require('mailparser'));
} catch (err) {
  console.warn('[mcpEmailService] mailparser load notice:', err.message);
}

/**
 * Filter: ONLY allow emails ending in @iiita.ac.in
 * and with NON-NUMBERED local part (reject student roll numbers like iec2023075, pmb2023001, rss2025507)
 * Strictly allows official institutional senders (e.g. kgpanda, dean.acad, dean.ri, dean.sa, ar.aaa, aaa, geekhaven, gdg, placements)
 */
function isAllowedCampusSender(senderEmail) {
  if (!senderEmail || typeof senderEmail !== 'string') return false;
  const email = senderEmail.trim().toLowerCase();

  // Reject external emails (must end with @iiita.ac.in)
  if (!email.endsWith('@iiita.ac.in')) {
    return false;
  }

  const localPart = email.split('@')[0];
  // Reject student roll numbers (must contain NO digits)
  if (/\d/.test(localPart)) {
    return false;
  }

  return true;
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
 * Returns canonical campus sample notices anchored to today's date
 */
function getCampusSampleEmails() {
  const now = new Date();
  const formatYMD = (offsetDays) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const day1 = formatYMD(1);
  const day2 = formatYMD(2);
  const day3 = formatYMD(3);
  const day4 = formatYMD(4);
  const day6 = formatYMD(6);
  const day7 = formatYMD(7);
  const day8 = formatYMD(8);
  const day10 = formatYMD(10);

  return [
    {
      id: 'sample-water-supply-bh2-bh3',
      sender: 'estate_office@iiita.ac.in',
      subject: 'Urgent Notice: Scheduled Water Supply Shutdown for BH2 & BH3',
      date: day1,
      body: `Water supply will be suspended in Boys Hostel 2 (BH2) and Boys Hostel 3 (BH3) on ${day1} from 5:00 PM to 7:00 PM due to underground main line repair near BH5 pump station.`,
    },
    {
      id: 'sample-exam-cs402-distrib',
      sender: 'dean.acad@iiita.ac.in',
      subject: 'Mid-Semester Exam Schedule: CS402 Distributed Systems',
      date: day2,
      body: `The examination for CS402 (Distributed Systems) will be conducted on ${day2} from 9:30 AM to 12:30 PM at Lecture Hall Complex LHC-3 (Halls 301, 302).`,
    },
    {
      id: 'sample-power-substation-library',
      sender: 'electrical_maintenance@iiita.ac.in',
      subject: 'Notice: Scheduled Substation Power Maintenance & Outage',
      date: day3,
      body: `Routine preventive maintenance of the North Campus 11kV electrical substation is scheduled on ${day3} between 10:00 AM and 1:00 PM. Affected: Central Library and Computer Center.`,
    },
    {
      id: 'sample-tech-ai-symposium',
      sender: 'geekhaven@iiita.ac.in',
      subject: 'Annual Campus Tech & AI Symposium 2026',
      date: day4,
      body: `Annual Campus Tech & AI Symposium spanning from ${day4} to ${day6} at Main Campus Auditorium and Innovation Center. Timings: 9:00 AM - 6:00 PM daily.`,
    },
    {
      id: 'sample-wifi-network-upgrade',
      sender: 'it_helpdesk@iiita.ac.in',
      subject: 'Scheduled Maintenance: Core Network Switch & Wi-Fi Access Point Upgrade',
      date: day7,
      body: `Network firmware update on ${day7} between 11:00 PM and 3:00 AM. Intermittent Wi-Fi and wired LAN interruptions in Academic Block B & C.`,
    },
    {
      id: 'sample-capstone-project-deadline',
      sender: 'dean.ri@iiita.ac.in',
      subject: 'Reminder: Final Year Capstone Project Milestone Submission',
      date: day8,
      body: `Milestone 2 submission portal closes on ${day8} at 11:59 PM. Upload project codebase URL and documentation to academic portal.`,
    },
    {
      id: 'sample-guest-lecture-clean-energy',
      sender: 'events@iiita.ac.in',
      subject: 'Guest Lecture: Clean Energy Grid Automation & Microgrid Design',
      date: day10,
      body: `Distinguished guest lecture on Clean Energy Grid Automation on ${day10} from 3:00 PM to 5:00 PM at Department Seminar Hall 1.`,
    },
  ];
}

/**
 * Fetch real emails directly via secure IMAP using ImapFlow
 * Strictly filters to allowed campus senders (@iiita.ac.in with non-numbered names)
 * Uses high-speed two-phase fetching with mailparser for clean text extraction
 */
async function fetchViaDirectIMAP(userEmail, appPassword, host, port) {
  if (!ImapFlow) {
    throw new Error('ImapFlow library is not available.');
  }

  const client = new ImapFlow({
    host: host || 'imap.gmail.com',
    port: parseInt(port || '993', 10),
    secure: true,
    auth: {
      user: userEmail,
      pass: appPassword,
    },
    logger: false,
    connectionTimeout: 15000,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    const status = await client.status('INBOX', { messages: true });
    const total = status.messages || 1;
    // Scan recent 180 messages to capture notices from the last 2-3 weeks
    const range = `${Math.max(1, total - 180)}:*`;

    // Phase 1: Fast envelope-only scan
    const matched = [];
    for await (const msg of client.fetch(range, { envelope: true })) {
      const from = msg.envelope?.from?.[0]?.address || '';
      if (isAllowedCampusSender(from)) {
        const subject = msg.envelope?.subject || 'Campus Notice';
        const threadKey = normalizeThreadSubject(subject);
        matched.push({
          seq: msg.seq,
          uid: msg.uid,
          sender: from,
          subject,
          threadKey,
          date: msg.envelope?.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
        });
      }
    }

    if (matched.length === 0) {
      return [];
    }

    // Phase 2: Deduplicate threads, keeping latest message sequence for each thread
    const threadMap = new Map();
    for (const item of matched) {
      threadMap.set(item.threadKey, item);
    }
    const uniqueThreads = Array.from(threadMap.values());

    // Phase 3: Single batch fetch for full message body sources
    const seqSet = uniqueThreads.map(t => t.seq).join(',');
    const seqMap = new Map(uniqueThreads.map(t => [t.seq, t]));

    for await (const msg of client.fetch(seqSet, { source: { maxLength: 80000 } })) {
      const item = seqMap.get(msg.seq);
      if (item && msg.source) {
        let cleanText = '';
        if (simpleParser) {
          try {
            const parsed = await simpleParser(msg.source);
            cleanText = (parsed.text || parsed.html || '')
              .replace(/\s+/g, ' ')
              .slice(0, 1500)
              .trim();
          } catch (pErr) {
            console.warn('[mcpEmailService] mailparser parse error:', pErr.message);
          }
        }
        if (!cleanText) {
          const raw = msg.source.toString('utf-8');
          const splitIdx = raw.indexOf('\r\n\r\n');
          const bodyPart = splitIdx !== -1 ? raw.slice(splitIdx) : raw;
          cleanText = bodyPart
            .replace(/<[^>]+>/g, ' ')
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\s+/g, ' ')
            .slice(0, 1500)
            .trim();
        }
        item.body = cleanText;
      }
    }

    return uniqueThreads.map(t => ({
      id: `email-${t.uid || t.seq}`,
      sender: t.sender,
      subject: t.subject,
      date: t.date,
      body: t.body || '',
    }));
  } finally {
    lock.release();
    await client.logout();
  }
}

/**
 * Main email fetching orchestrator
 */
async function fetchEmailsViaMCP() {
  // Always refresh from disk so newly added App Passwords are used immediately without restart
  dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

  const userEmail = (process.env.USER_EMAIL || '').trim();
  const appPassword = (process.env.EMAIL_APP_PASSWORD || '').trim();
  const imapHost = (process.env.EMAIL_IMAP_HOST || 'imap.gmail.com').trim();
  const imapPort = (process.env.EMAIL_IMAP_PORT || '993').trim();

  // If user hasn't configured real credentials yet
  if (!userEmail || !appPassword || userEmail === 'your_email@example.com' || appPassword === 'your_app_password') {
    return {
      success: true,
      source: 'simulated',
      message: 'Running in demo mode. Configure USER_EMAIL and EMAIL_APP_PASSWORD in backend/.env for live mailbox sync.',
      emails: getCampusSampleEmails(),
    };
  }

  // Attempt direct IMAP connection with imapflow
  try {
    console.log(`[mcpEmailService] Connecting to IMAP server ${imapHost}:${imapPort} as ${userEmail}...`);
    const emails = await fetchViaDirectIMAP(userEmail, appPassword, imapHost, imapPort);

    if (emails && emails.length > 0) {
      console.log(`[mcpEmailService] Successfully fetched ${emails.length} verified campus announcements from ${userEmail}.`);
      return {
        success: true,
        source: 'imap',
        message: `Successfully synced ${emails.length} official campus notices from @iiita.ac.in.`,
        emails,
      };
    }

    console.log('[mcpEmailService] No matching non-numbered @iiita.ac.in emails found in recent history. Displaying campus notices.');
    return {
      success: true,
      source: 'simulated',
      message: 'Connected to your mailbox, but no new official @iiita.ac.in announcements found in the last 30 days. Showing sample notices.',
      emails: getCampusSampleEmails(),
    };
  } catch (imapErr) {
    console.warn('[mcpEmailService] IMAP connection attempt result:', imapErr.message);

    let userFriendlyMsg = imapErr.message;
    if (imapErr.response && imapErr.response.includes('AUTHENTICATIONFAILED')) {
      userFriendlyMsg = `Google IMAP authentication failed for ${userEmail}. Google accounts require a 16-character App Password (from https://myaccount.google.com/apppasswords), not your regular password. Displaying sample campus notices.`;
    } else {
      userFriendlyMsg = `Could not connect to ${imapHost} (${imapErr.message}). Displaying sample campus notices.`;
    }

    return {
      success: false,
      source: 'simulated',
      message: userFriendlyMsg,
      emails: getCampusSampleEmails(),
    };
  }
}

module.exports = {
  fetchEmailsViaMCP,
  getCampusSampleEmails,
  isAllowedCampusSender,
};
