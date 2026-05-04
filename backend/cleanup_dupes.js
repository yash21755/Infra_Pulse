require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('./models/Issue');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const issues = await Issue.find({}, 'title category publicId createdAt').sort({createdAt: 1});
  console.log('All issues in MongoDB:');
  issues.forEach(i => {
    console.log('  ' + i._id + ' | ' + i.publicId + ' | cat=' + i.category + ' | ' + i.title);
  });
  
  // Find duplicate basketball rim issues (keep the original, delete copies)
  const dupes = issues.filter(i => i.title && i.title.toLowerCase().includes('basketball'));
  console.log('\nBasketball-related issues: ' + dupes.length);
  
  if (dupes.length > 1) {
    // Keep the first one, delete the rest
    const keep = dupes[0];
    const toDelete = dupes.slice(1);
    console.log('Keeping: ' + keep._id + ' (' + keep.title + ')');
    for (const d of toDelete) {
      console.log('Deleting: ' + d._id + ' (' + d.title + ')');
      await Issue.findByIdAndDelete(d._id);
      // Also remove from redundancy vector store
      try {
        await fetch('http://127.0.0.1:8002/issues/' + d._id, { method: 'DELETE' });
        console.log('  Removed from vector store');
      } catch(e) {
        console.log('  Vector store cleanup: ' + e.message);
      }
    }
  }
  
  console.log('\nRemaining issues:');
  const remaining = await Issue.find({}, 'title category publicId').sort({createdAt: 1});
  remaining.forEach(i => {
    console.log('  ' + i._id + ' | ' + i.publicId + ' | cat=' + i.category + ' | ' + i.title);
  });
  
  await mongoose.disconnect();
  console.log('\nDone.');
}
main().catch(e => { console.error(e); process.exit(1); });
