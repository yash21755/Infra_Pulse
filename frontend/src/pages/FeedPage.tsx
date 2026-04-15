import React, { useEffect, useState } from 'react';
import { IssueCard } from '../issues/IssueCard';
import { Button } from '../components/ui/Button';
import axios from 'axios';
import { Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Issue } from '../types';

/** Normalize a raw MongoDB issue document into the frontend Issue shape */
function normalizeIssue(raw: any): Issue {
  return {
    id: String(raw._id ?? raw.id),
    title: raw.title ?? '',
    description: raw.description ?? '',
    category: raw.category ?? 'Electrical',
    tags: raw.tags ?? [],
    status: raw.status ?? 'open',
    priority: raw.priority ?? 'medium',
    // votes is an array of user IDs in the backend
    upvotes: Array.isArray(raw.votes) ? raw.votes.length : (raw.upvotes ?? 0),
    downvotes: raw.downvotes ?? 0,
    userVote: raw.userVote ?? null,
    location: raw.location ?? { lat: 0, lng: 0, label: 'Unknown' },
    images: raw.imageUrl
      ? [{ id: raw._id, url: raw.imageUrl, uploadedAt: raw.createdAt ?? new Date().toISOString(), type: 'report' as const }]
      : (raw.images ?? []),
    reportedAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    commentCount: raw.commentCount ?? 0,
    viewCount: raw.viewCount ?? 0,
  };
}

export const FeedPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [tab, setTab] = useState('Newest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchIssues = () => {
    setLoading(true);
    setError('');
    axios.get('/api/issues').then(res => {
      const raw = Array.isArray(res.data) ? res.data : [];
      setIssues(raw.map(normalizeIssue));
      setLoading(false);
    }).catch(() => {
      setError('Failed to load issues. Make sure the backend is running.');
      setLoading(false);
    });
  };

  useEffect(fetchIssues, []);

  let filteredIssues = issues.filter(issue =>
    issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issue.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (statusFilter !== 'All') {
    filteredIssues = filteredIssues.filter(issue => {
      if (statusFilter === 'Open') return issue.status === 'open';
      if (statusFilter === 'In Progress') return issue.status === 'in_progress';
      if (statusFilter === 'Resolved') return issue.status === 'resolved';
      return true;
    });
  }

  if (tab === 'Trending') {
    filteredIssues = [...filteredIssues].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else if (tab === 'Newest') {
    filteredIssues = [...filteredIssues].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  } else if (tab === 'Resolved') {
    filteredIssues = filteredIssues.filter(issue => issue.status === 'resolved');
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Issue Feed</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Discover and prioritize campus improvements.</p>
        </div>
        <Link to="/report">
          <Button variant="primary" className="gap-2 w-full sm:w-auto">
            <Plus size={20} />
            Report Issue
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Sidebar - Filters */}
        <div className="w-full md:w-64 shrink-0 space-y-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-300 mb-3 text-sm uppercase tracking-wider">Status</h4>
            <div className="space-y-2">
              {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    className="text-brand-600 focus:ring-brand-500"
                    checked={statusFilter === status}
                    onChange={() => setStatusFilter(status)}
                  />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Main Feed Area */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px mb-4">
            {['Trending', 'Newest', 'Resolved'].map((tabName) => (
              <button
                key={tabName}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tabName ? 'border-brand-600 dark:border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}`}
                onClick={() => setTab(tabName)}
              >
                {tabName}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading issues...</div>
            ) : (
              filteredIssues.map((issue, idx) => (
                <IssueCard key={issue.id} issue={issue} rank={idx + 1} onAction={fetchIssues} />
              ))
            )}
            {filteredIssues.length === 0 && !loading && !error && (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                <p className="text-slate-500 dark:text-slate-400">No issues found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};