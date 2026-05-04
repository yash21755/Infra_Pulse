import type { Issue, User } from '../types';

export const dummyUser: User = {
  id: 'u1',
  anonymousHandle: 'SilentOwl#4821',
  role: 'student',
  reportCount: 12,
  resolvedCount: 7,
  joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  notificationsEnabled: true,
};

export const dummyIssues: Issue[] = [
  {
    id: 'iss_1',
    title: 'Broken ceiling fan in Room 204, Block C',
    description: 'The front ceiling fan is making a loud grinding noise and wobbling dangerously.',
    category: 'Electrical',
    tags: ['#Electrical', '#Safety'],
    status: 'open',
    upvotes: 45,
    downvotes: 2,
    userVote: 'up',
    location: { lat: 28.5456, lng: 77.2732, label: 'Block C - Room 204' },
    images: [{ id: 'img1', url: 'https://picsum.photos/seed/iss_1/600/400', uploadedAt: new Date().toISOString(), type: 'report' }],
    reportedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    commentCount: 4,
    viewCount: 120
  },
  {
    id: 'iss_2',
    title: 'Waterlogging near Main Gate after rain',
    description: 'Massive puddle blocking the pedestrian entrance.',
    category: 'Landscaping / Outdoors',
    tags: ['#Sanitation', '#Drainage'],
    status: 'in_progress',
    upvotes: 128,
    downvotes: 5,
    userVote: null,
    location: { lat: 28.5460, lng: 77.2740, label: 'Main Gate' },
    images: [],
    reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    commentCount: 15,
    viewCount: 450
  },
  {
    id: 'iss_3',
    title: 'Flickering lights in Library Reading Hall',
    description: 'Several tube lights in the left wing are flickering, causing eye strain.',
    category: 'Electrical',
    tags: ['#Library', '#Lighting'],
    status: 'resolved',
    upvotes: 89,
    downvotes: 1,
    userVote: 'up',
    location: { lat: 28.5450, lng: 77.2730, label: 'Central Library' },
    images: [],
    reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    proofOfWork: {
      resolvedBy: 'AdminHawk#0001',
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Replaced 4 faulty LED battens in the left wing.',
      images: [{ id: 'pow1', url: 'https://picsum.photos/seed/pow_1/600/400', uploadedAt: new Date().toISOString(), type: 'proof_of_work' }]
    },
    commentCount: 8,
    viewCount: 310
  }
];