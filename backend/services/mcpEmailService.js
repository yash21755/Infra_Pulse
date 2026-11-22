const path = require('path');
const dotenv = require('dotenv');

// Dynamically ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let Client = null;
let StdioClientTransport = null;
let ImapFlow = null;

try {
  const sdkPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/cjs');
  ({ Client } = require(path.join(sdkPath, 'client/index.js')));
  ({ StdioClientTransport } = require(path.join(sdkPath, 'client/stdio.js')));
} catch (err) {
  try {
    ({ Client } = require('@modelcontextprotocol/sdk/client'));
    ({ StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio'));
  } catch (innerErr) {
    console.warn('[mcpEmailService] MCP SDK notice:', innerErr.message);
  }
}

try {
  ({ ImapFlow } = require('imapflow'));
} catch (err) {
  console.warn('[mcpEmailService] imapflow load notice:', err.message);
}

/**
 * Returns canonical campus sample notices anchored to today's date
 * Used in demo mode or when email credentials fail authentication
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
      sender: 'estate_office@campus.edu',
      subject: 'Urgent Notice: Scheduled Water Supply Shutdown for BH2 & BH3',
      date: day1,
      body: `Dear Residents,
Please be informed that water supply will be suspended in Boys Hostel 2 (BH2) and Boys Hostel 3 (BH3) on ${day1} from 5:00 PM to 7:00 PM.
This is required to conduct emergency pipeline replacement and repair a major underground supply leakage detected near BH5 pump station.
Residents are advised to store sufficient water in advance.
Estate Maintenance Division`,
    },
    {
      id: 'sample-power-substation-library',
      sender: 'electrical_maintenance@campus.edu',
      subject: 'Notice: Scheduled Substation Power Maintenance & Outage',
      date: day3,
      body: `Dear Campus Community,
Routine preventive maintenance of the North Campus 11kV electrical substation is scheduled on ${day3} between 10:00 AM and 1:00 PM.
Affected areas: Central Library, Computer Center, and North Dining Hall.
Backup diesel generators will power essential network racks and emergency lighting only.
Campus Electrical Engineering Wing`,
    },
    {
      id: 'sample-exam-cs402-distrib',
      sender: 'academics@campus.edu',
      subject: 'Mid-Semester Exam Schedule: CS402 Distributed Systems',
      date: day2,
      body: `Notice to All Registered Students:
The mid-semester examination for CS402 (Distributed Systems) will be conducted on ${day2} from 9:30 AM to 12:30 PM.
Venue: Lecture Hall Complex LHC-3, Halls 301 and 302.
Please arrive 15 minutes before the scheduled start with your Institute ID cards.
Office of the Dean of Academics`,
    },
    {
      id: 'sample-tech-ai-symposium',
      sender: 'studentaffairs@campus.edu',
      subject: 'Invitation: Annual Campus Tech & AI Symposium 2026',
      date: day4,
      body: `We are thrilled to announce the 2026 Campus Tech & AI Symposium spanning 3 days from ${day4} to ${day6}.
Timings: 9:00 AM - 6:00 PM daily.
Location: Main Campus Auditorium and Innovation Center.
Keynote speakers from leading AI research laboratories and industry demonstrations.
All students and faculty are cordially invited to register and attend.`,
    },
    {
      id: 'sample-wifi-network-upgrade',
      sender: 'it_helpdesk@campus.edu',
      subject: 'Scheduled Maintenance: Core Network Switch & Wi-Fi Access Point Upgrade',
      date: day7,
      body: `Dear All,
The IT Infrastructure team will be upgrading access point firmware and core distribution switches on ${day7} between 11:00 PM and 3:00 AM.
Expect intermittent Wi-Fi and wired LAN interruptions in Academic Block B and Academic Block C during this maintenance window.
IT Infrastructure Services`,
    },
    {
      id: 'sample-capstone-project-deadline',
      sender: 'dean_rnd@campus.edu',
      subject: 'Reminder: Final Year Capstone Project Milestone Submission',
      date: day8,
      body: `All final-year undergraduate and postgraduate students are reminded that the Milestone 2 Capstone Project submission portal closes on ${day8} at 11:59 PM.
Upload complete architecture documentation and GitHub repository links to the academic portal before the deadline.
No extensions will be granted.`,
    },
    {
      id: 'sample-guest-lecture-clean-energy',
      sender: 'events@campus.edu',
      subject: 'Guest Lecture: Clean Energy Grid Automation & Microgrid Design',
      date: day10,
      body: `The Department of Electrical Engineering cordially invites you to a distinguished guest lecture on Clean Energy Grid Automation.
Date: ${day10}
Time: 3:00 PM - 5:00 PM
Location: Department Seminar Hall 1.
Speaker: Dr. Sarah Lin, National Renewable Energy Lab.`,
    },
  ];
}

/**
 * Fetch real emails directly via secure IMAP using ImapFlow
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
    connectionTimeout: 12000,
  });

  await client.connect();

  const emails = [];
  const lock = await client.getMailboxLock('INBOX');

  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);

    const uids = await client.search({ since: sinceDate });
    const recentUids = uids.slice(-35);

    if (recentUids.length > 0) {
      for await (const msg of client.fetch(recentUids, { envelope: true, source: true })) {
        const envelope = msg.envelope || {};
        let bodyText = '';
        if (msg.source) {
          const raw = msg.source.toString('utf-8');
          const parts = raw.split(/\r?\n\r?\n/);
          const bodyPart = parts.length > 1 ? parts.slice(1).join('\n') : raw;
          bodyText = bodyPart
            .replace(/<[^>]+>/g, ' ')
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\s+/g, ' ')
            .slice(0, 1000)
            .trim();
        }

        emails.push({
          id: `imap-email-${msg.uid}`,
          subject: envelope.subject || 'Campus Notice',
          sender: envelope.from?.[0]?.address || userEmail,
          date: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
          body: bodyText,
        });
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
  return emails;
}

/**
 * Fetch recent emails via MCP server using stdio transport
 */
async function fetchViaMCPServer(command, args, env) {
  if (!Client || !StdioClientTransport) {
    throw new Error('MCP SDK transport is not available.');
  }

  const transport = new StdioClientTransport({
    command,
    args,
    env,
  });

  const client = new Client(
    { name: 'infra-pulse-calendar-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await Promise.race([
    client.connect(transport),
    new Promise((_, reject) => setTimeout(() => reject(new Error('MCP server connection timed out after 10s')), 10000)),
  ]);

  const toolsResult = await client.listTools();
  const tools = toolsResult?.tools || [];
  const fetchTool = tools.find(t =>
    ['fetch_emails', 'list_emails', 'search_emails', 'get_recent_emails', 'list_messages'].includes(t.name)
  ) || tools[0];

  let emailData = [];
  if (fetchTool) {
    const toolCallResult = await client.callTool({
      name: fetchTool.name,
      arguments: { limit: 20 },
    });

    if (toolCallResult?.content && Array.isArray(toolCallResult.content)) {
      for (const item of toolCallResult.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) emailData = parsed;
            else if (parsed.emails) emailData = parsed.emails;
            else emailData.push({ body: item.text });
          } catch {
            emailData.push({ body: item.text });
          }
        }
      }
    }
  }

  await transport.close();
  return emailData;
}

/**
 * Main email fetching orchestrator
 * Tries direct IMAP first, then MCP if configured, and falls back to clean sample notices
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
      console.log(`[mcpEmailService] Successfully fetched ${emails.length} live emails from ${userEmail}.`);
      return {
        success: true,
        source: 'imap',
        message: `Successfully synced ${emails.length} emails from your inbox (${userEmail}).`,
        emails,
      };
    }

    console.log('[mcpEmailService] Inbox query returned 0 new notices. Displaying campus notices.');
    return {
      success: true,
      source: 'simulated',
      message: 'Inbox connected, but no new campus notice emails were found in the last 30 days. Showing sample notices.',
      emails: getCampusSampleEmails(),
    };
  } catch (imapErr) {
    console.warn('[mcpEmailService] IMAP connection attempt result:', imapErr.message);

    let userFriendlyMsg = imapErr.message;
    if (imapErr.response && imapErr.response.includes('AUTHENTICATIONFAILED')) {
      userFriendlyMsg = `Google IMAP authentication failed for ${userEmail}. Google accounts require a 16-character App Password (from https://myaccount.google.com/apppasswords), not your regular password. Displaying sample campus notices.`;
    } else if (imapErr.message.includes('AUTHENTICATIONFAILED') || imapErr.code === 'EAUTH') {
      userFriendlyMsg = `Invalid email credentials for ${userEmail}. If using Gmail/IIITA, please use a Google App Password. Displaying sample campus notices.`;
    } else {
      userFriendlyMsg = `Could not connect to ${imapHost} (${imapErr.message}). Displaying sample campus notices.`;
    }

    // Try MCP as secondary fallback if configured
    const mcpCmd = process.env.MCP_EMAIL_SERVER_CMD;
    const mcpArgs = process.env.MCP_EMAIL_SERVER_ARGS;

    if (mcpCmd && mcpArgs && !mcpArgs.includes('@modelcontextprotocol/server-imap')) {
      try {
        console.log(`[mcpEmailService] Attempting configured MCP server: ${mcpCmd} ${mcpArgs}...`);
        const mcpEmails = await fetchViaMCPServer(mcpCmd, mcpArgs.split(' ').filter(Boolean), {
          ...process.env,
          IMAP_HOST: imapHost,
          IMAP_PORT: imapPort,
          IMAP_USER: userEmail,
          IMAP_PASSWORD: appPassword,
          EMAIL: userEmail,
        });

        if (mcpEmails && mcpEmails.length > 0) {
          return {
            success: true,
            source: 'mcp',
            message: `Synced ${mcpEmails.length} emails via MCP server.`,
            emails: mcpEmails,
          };
        }
      } catch (mcpErr) {
        console.warn('[mcpEmailService] Secondary MCP attempt failed:', mcpErr.message);
      }
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
};
