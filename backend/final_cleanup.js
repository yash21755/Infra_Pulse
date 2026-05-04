/**
 * final_cleanup.js — Remove duplicate dustbin issue and verify redundancy works
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('./models/Issue');

const REDUNDANCY_API_URL = process.env.REDUNDANCY_API_URL || 'http://127.0.0.1:8002';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  // Remove the duplicate dustbin (keep the older one)
  const dustbinDupe = await Issue.findById('69f908f6e82b61697725a748');
  if (dustbinDupe) {
    console.log('Deleting duplicate dustbin: ' + dustbinDupe.title);
    await Issue.findByIdAndDelete(dustbinDupe._id);
    try {
      await fetch(REDUNDANCY_API_URL + '/issues/' + dustbinDupe._id, { method: 'DELETE' });
      console.log('  Removed from vector store');
    } catch(e) {
      console.log('  Vector store: ' + e.message);
    }
  }

  // Show remaining
  const remaining = await Issue.find({}).sort({ createdAt: 1 });
  console.log('\nFinal issues in MongoDB (' + remaining.length + '):');
  for (const i of remaining) {
    console.log('  ' + i._id + ' | ' + i.category + ' | ' + i.title);
  }

  // Test: check if "overflowing dustbin" would be caught as duplicate now
  console.log('\n--- Testing redundancy check with search_all ---');
  const fd = new FormData();
  fd.append('building_id', 'DOESNT_MATTER');
  fd.append('text', 'the dustbin near pocket gate is overflowing');
  fd.append('search_all', 'true');
  
  const res = await fetch(REDUNDANCY_API_URL + '/check-redundancy', { method: 'POST', body: fd });
  const data = await res.json();
  console.log('is_redundant: ' + data.is_redundant);
  console.log('score: ' + data.similarity_score);
  console.log('top_match: ' + data.top_match_id);
  console.log('message: ' + data.message);

  // Test: basketball rim
  console.log('\n--- Testing basketball rim ---');
  const fd2 = new FormData();
  fd2.append('building_id', 'DOESNT_MATTER');
  fd2.append('text', 'broken basketball rim needs fixing');
  fd2.append('search_all', 'true');

  const res2 = await fetch(REDUNDANCY_API_URL + '/check-redundancy', { method: 'POST', body: fd2 });
  const data2 = await res2.json();
  console.log('is_redundant: ' + data2.is_redundant);
  console.log('score: ' + data2.similarity_score);
  console.log('message: ' + data2.message);

  // Vector store stats
  const statsRes = await fetch(REDUNDANCY_API_URL + '/stats');
  console.log('\nVector store: ' + JSON.stringify(await statsRes.json(), null, 2));

  await mongoose.disconnect();
  console.log('\nAll done!');
}

main().catch(e => { console.error(e); process.exit(1); });
