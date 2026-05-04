/**
 * cleanup_and_backfill.js
 * 
 * 1. Remove duplicate issues from MongoDB (keep oldest of each group)
 * 2. Re-backfill ALL remaining issues into the redundancy vector store
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('./models/Issue');

const GEOSPATIAL_API_URL = process.env.GEOSPATIAL_API_URL || 'http://127.0.0.1:8001';
const REDUNDANCY_API_URL = process.env.REDUNDANCY_API_URL || 'http://127.0.0.1:8002';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // ── Step 1: Find and remove duplicates ──────────────────────────────────
  const all = await Issue.find({}).sort({ createdAt: 1 });
  console.log('Total issues in DB: ' + all.length);

  // Group by rough title similarity
  const kept = [];
  const toDelete = [];

  for (const issue of all) {
    const titleLower = (issue.title || '').toLowerCase().trim();
    const isDupe = kept.some(k => {
      const kTitle = (k.title || '').toLowerCase().trim();
      // Simple word-overlap check
      const kWords = new Set(kTitle.split(/\s+/).filter(w => w.length > 3));
      const iWords = titleLower.split(/\s+/).filter(w => w.length > 3);
      if (kWords.size === 0 || iWords.length === 0) return false;
      const overlap = iWords.filter(w => kWords.has(w)).length;
      return overlap / Math.max(kWords.size, iWords.length) >= 0.5;
    });

    if (isDupe) {
      toDelete.push(issue);
    } else {
      kept.push(issue);
    }
  }

  if (toDelete.length > 0) {
    console.log('\nRemoving ' + toDelete.length + ' duplicate(s):');
    for (const d of toDelete) {
      console.log('  DEL: ' + d._id + ' | ' + d.title);
      await Issue.findByIdAndDelete(d._id);
    }
  } else {
    console.log('\nNo duplicates found.');
  }

  // ── Step 2: Wipe vector store and re-backfill ───────────────────────────
  console.log('\nWiping vector store...');
  const remaining = await Issue.find({}).sort({ createdAt: 1 });

  // Delete all existing entries from vector store
  for (const issue of all) {
    try {
      await fetch(REDUNDANCY_API_URL + '/issues/' + issue._id.toString(), { method: 'DELETE' });
    } catch (_) {}
  }

  console.log('Re-registering ' + remaining.length + ' issues...\n');

  for (const issue of remaining) {
    const text = (issue.description || issue.title || '').trim();
    if (!text) continue;

    // Resolve building
    let bid = 'CAMPUS_GLOBAL';
    if (issue.location && issue.location.lat && issue.location.lng) {
      try {
        const gRes = await fetch(GEOSPATIAL_API_URL + '/resolve-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: issue.location.lat, longitude: issue.location.lng }),
        });
        if (gRes.ok) {
          const g = await gRes.json();
          if (g.success && g.building_id) bid = g.building_id;
        }
      } catch (_) {}
    }

    // Register
    const fd = new FormData();
    fd.append('issue_id', issue._id.toString());
    fd.append('building_id', bid);
    fd.append('text', text);
    const res = await fetch(REDUNDANCY_API_URL + '/register-issue', { method: 'POST', body: fd });
    const d = await res.json();
    console.log('  ' + (d.success ? 'OK' : 'skip') + ' [' + bid + '] ' + issue._id + ' | ' + issue.title);
  }

  // Show stats
  const statsRes = await fetch(REDUNDANCY_API_URL + '/stats');
  const stats = await statsRes.json();
  console.log('\nFinal vector store: ' + JSON.stringify(stats, null, 2));

  console.log('\nRemaining issues in MongoDB:');
  for (const i of remaining) {
    console.log('  ' + i._id + ' | ' + (i.publicId || 'no-id') + ' | cat=' + i.category + ' | ' + i.title);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
