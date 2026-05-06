const mongoose = require('mongoose');

const PRIORITY_API_URL = 'http://127.0.0.1:8003';

async function main() {
  try {
    await mongoose.connect('mongodb://localhost:27017/infra_pulse');
    console.log('Connected to DB');
    
    // We need the Issue model schema definition
    const IssueSchema = new mongoose.Schema({
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }, { strict: false });
    const Issue = mongoose.model('Issue', IssueSchema);

    const issues = await Issue.find().sort({ createdAt: 1 }).limit(3);
    if (issues.length < 3) {
      console.log('Not enough issues found.');
      process.exit(1);
    }

    const voteCounts = [200, 4000, 7];

    for (let i = 0; i < 3; i++) {
      const issue = issues[i];
      const targetVotes = voteCounts[i];
      const issueIdStr = issue._id.toString();
      
      console.log(`Setting ${targetVotes} upvotes for issue ${issueIdStr}`);

      // 1. Update MongoDB votes array
      issue.votes = [];
      for (let v = 0; v < targetVotes; v++) {
        issue.votes.push(new mongoose.Types.ObjectId());
      }
      await issue.save();
      
      // 2. We also need to tell the Priority API about these votes
      // Since it's a test, we can just spam the /vote endpoint or use a quick loop
      // We will do it in batches to not overwhelm the local server
      console.log(`Sending ${targetVotes} requests to Priority API...`);
      let count = 0;
      const batchSize = 100;
      for (let b = 0; b < targetVotes; b += batchSize) {
        const batch = Math.min(batchSize, targetVotes - b);
        const promises = [];
        for (let p = 0; p < batch; p++) {
          promises.push(
            fetch(`${PRIORITY_API_URL}/vote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                issue_id: issueIdStr,
                vote_type: 'upvote',
                dwell_seconds: 5.0
              })
            })
          );
        }
        await Promise.allSettled(promises);
        count += batch;
        if (count % 1000 === 0) console.log(` Sent ${count}/${targetVotes}...`);
      }
      console.log(`Finished ${issueIdStr}`);
    }

    console.log('Successfully updated all 3 issues in MongoDB and Priority API!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
