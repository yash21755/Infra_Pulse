/**
 * migrate_categories.js
 * 
 * One-time script to update any existing issues in MongoDB
 * that have category: 'General' but were created before the fix.
 * 
 * Run with:  node migrate_categories.js
 * 
 * This script does NOT overwrite any issue that already has a
 * non-General category. It only affects documents where category
 * is 'General' AND you can optionally pass a new category via:
 *   node migrate_categories.js --id <mongoId> --category "Electrical"
 * 
 * Or to view all issues and their categories:
 *   node migrate_categories.js --list
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('./models/Issue');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const args = process.argv.slice(2);
  const listMode  = args.includes('--list');
  const idIdx     = args.indexOf('--id');
  const catIdx    = args.indexOf('--category');

  if (listMode) {
    // Show all issues with id, title, and current category
    const issues = await Issue.find({}, 'title category createdAt').sort({ createdAt: -1 });
    console.log(`Found ${issues.length} issues:\n`);
    issues.forEach(i => {
      console.log(`  [${i._id}]  category="${i.category}"  title="${i.title}"`);
    });
  } else if (idIdx !== -1 && catIdx !== -1) {
    // Update a single issue's category
    const id  = args[idIdx  + 1];
    const cat = args[catIdx + 1];
    const result = await Issue.findByIdAndUpdate(id, { category: cat }, { new: true });
    if (!result) { console.error('Issue not found:', id); }
    else { console.log(`Updated issue "${result.title}" → category="${result.category}"`); }
  } else {
    // Show summary by category
    const agg = await Issue.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('Category breakdown in MongoDB:');
    agg.forEach(r => console.log(`  ${r._id || '(null)'}: ${r.count} issues`));
    console.log('\nTo fix a specific issue:');
    console.log('  node migrate_categories.js --id <mongoId> --category "Electrical"');
    console.log('\nTo list all issues with their current category:');
    console.log('  node migrate_categories.js --list');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
