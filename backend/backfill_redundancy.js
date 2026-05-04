/**
 * backfill_redundancy.js
 * 
 * One-time script to register ALL existing MongoDB issues into the
 * Redundancy API vector store.
 * 
 * Run with:  node backfill_redundancy.js
 * 
 * What it does:
 *   1. Fetches every issue from MongoDB
 *   2. Calls the Geospatial API to resolve the building_id for each issue
 *      (uses CAMPUS_GLOBAL if location is missing or unresolvable)
 *   3. Calls POST /register-issue on the Redundancy API with text + building_id
 *   4. Skips issues already registered (idempotent)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('./models/Issue');

const GEOSPATIAL_API_URL = process.env.GEOSPATIAL_API_URL || 'http://127.0.0.1:8001';
const REDUNDANCY_API_URL = process.env.REDUNDANCY_API_URL || 'http://127.0.0.1:8002';

async function resolveBuildingId(issue) {
  // If already stored in the DB from a previous successful geo lookup, use it
  if (issue.buildingId) return issue.buildingId;

  // If there's no location, fall back
  if (!issue.location || !issue.location.lat || !issue.location.lng) {
    return 'CAMPUS_GLOBAL';
  }

  try {
    const res = await fetch(`${GEOSPATIAL_API_URL}/resolve-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: issue.location.lat,
        longitude: issue.location.lng,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.building_id) return data.building_id;
    }
  } catch (err) {
    console.warn(`  ⚠ Geo API error for issue ${issue._id}: ${err.message}`);
  }

  return 'CAMPUS_GLOBAL';
}

async function registerWithRedundancyApi(issue, buildingId) {
  const text = (issue.description || issue.title || '').trim();
  if (!text) {
    console.log(`  skip (no text): ${issue._id}`);
    return;
  }

  const formData = new FormData();
  formData.append('issue_id', issue._id.toString());
  formData.append('building_id', buildingId);
  formData.append('text', text);

  const res = await fetch(`${REDUNDANCY_API_URL}/register-issue`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (data.success) {
    console.log(`  ✓ Registered [${buildingId}] ${issue._id} — "${text.substring(0, 60)}"`);
  } else {
    console.log(`  ~ Already registered: ${issue._id} — ${data.message}`);
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const issues = await Issue.find({}).sort({ createdAt: 1 });
  console.log(`Found ${issues.length} issues to backfill.\n`);

  // Check redundancy API health first
  try {
    const health = await fetch(`${REDUNDANCY_API_URL}/health`);
    const h = await health.json();
    console.log(`Redundancy API: ${h.status} | mode: ${h.coupling_network}\n`);
    const stats = h.vector_store;
    if (stats) {
      console.log(`Vector store currently has ${stats.total_issues || 0} issues registered.\n`);
    }
  } catch (err) {
    console.error(`ERROR: Cannot reach Redundancy API at ${REDUNDANCY_API_URL}`);
    console.error('Make sure python main.py is running in the apis/ folder.');
    process.exit(1);
  }

  let registered = 0;
  let skipped = 0;

  for (const issue of issues) {
    process.stdout.write(`Processing ${issue._id} (${issue.title?.substring(0, 40)})...\n`);
    try {
      const buildingId = await resolveBuildingId(issue);
      await registerWithRedundancyApi(issue, buildingId);

      // Also update the buildingId in MongoDB if it wasn't stored
      if (!issue.buildingId && buildingId !== 'CAMPUS_GLOBAL') {
        await Issue.findByIdAndUpdate(issue._id, { buildingId });
      }

      registered++;
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n✓ Done. Registered: ${registered}, Failed/Skipped: ${skipped}`);

  // Show final vector store stats
  try {
    const statsRes = await fetch(`${REDUNDANCY_API_URL}/stats`);
    const stats = await statsRes.json();
    console.log('\nVector store stats after backfill:');
    console.log(JSON.stringify(stats, null, 2));
  } catch (_) {}

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
