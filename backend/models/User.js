const mongoose = require('mongoose');

function generateHandle() {
  const adjectives = ['Silent', 'Swift', 'Bold', 'Calm', 'Keen', 'Wise', 'True', 'Iron', 'Jade', 'Neon'];
  const nouns = ['Owl', 'Fox', 'Wolf', 'Hawk', 'Lion', 'Bear', 'Stag', 'Lynx', 'Raven', 'Tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${noun}#${num}`;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: String,
  role: { type: String, enum: ['student', 'faculty', 'authority'], default: 'student' },
  anonymousHandle: { type: String, default: generateHandle },
  reportCount: { type: Number, default: 0 },
  resolvedCount: { type: Number, default: 0 },
  notificationsEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
