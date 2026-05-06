import React, { useEffect, useState, useContext } from 'react';
import { IssueCard } from '../issues/IssueCard';
import { Button } from '../components/ui/Button';
import axios from 'axios';
import { Search, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Issue } from '../types';
import { AuthContext } from '../context/AuthContext';

/** Normalize a raw MongoDB issue document into the frontend Issue shape */
function normalizeIssue(raw: any, currentUserId?: string): Issue {
  const upvoterIds   = (Array.isArray(raw.votes)     ? raw.votes     : []).map((v: any) => String(v?._id ?? v));
  const downvoterIds = (Array.isArray(raw.downvotes) ? raw.downvotes : []).map((v: any) => String(v?._id ?? v));
  const userVote = currentUserId
    ? upvoterIds.includes(currentUserId)   ? 'up'
    : downvoterIds.includes(currentUserId) ? 'down'
    : null
    : null;

  return {
    id: String(raw._id ?? raw.id),
    title: raw.title ?? '',
    description: raw.description ?? '',
    category: raw.category ?? 'General',
    tags: raw.tags ?? [],
    status: raw.status ?? 'open',
    upvotes: upvoterIds.length || (raw.upvotes ?? 0),
    downvotes: downvoterIds.length || (raw.downvotes ?? 0),
    userVote: userVote ?? raw.userVote ?? null,
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

/** Full category list with unique color themes */
export const CATEGORY_THEME: Record<string, {
  dot: string;
  chip: string;
  check: string;
}> = {
  'Electrical':            { dot: 'bg-amber-400',    chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',    check: 'accent-amber-500' },
  'Sanitation':            { dot: 'bg-blue-500',     chip: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',           check: 'accent-blue-500' },
  'Plumbing':              { dot: 'bg-cyan-500',     chip: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30',           check: 'accent-cyan-500' },
  'HVAC':                  { dot: 'bg-red-500',      chip: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',                 check: 'accent-red-500' },
  'Structural':            { dot: 'bg-violet-500',   chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/30', check: 'accent-violet-500' },
  'IT / Network':          { dot: 'bg-emerald-500',  chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', check: 'accent-emerald-500' },
  'Landscaping / Outdoors':{ dot: 'bg-lime-500',     chip: 'bg-lime-50 dark:bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-200 dark:border-lime-500/30',           check: 'accent-lime-500' },
  'Elevator / Escalator':  { dot: 'bg-orange-500',   chip: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30', check: 'accent-orange-500' },
  'Safety / Security':     { dot: 'bg-pink-500',     chip: 'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-500/30',           check: 'accent-pink-500' },
  'Furniture / Equipment': { dot: 'bg-indigo-500',   chip: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30', check: 'accent-indigo-500' },
  'General':               { dot: 'bg-slate-400',    chip: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',          check: 'accent-slate-500' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_THEME);

export const FeedPage: React.FC = () => {
  const { user } = useContext(AuthContext) || {};
  const [searchTerm, setSearchTerm]           = useState('');
  const [issues, setIssues]                   = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter]       = useState('All');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]); // empty = show all
  const [tab, setTab]                         = useState('Newest');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const fetchIssues = () => {
    setLoading(true);
    setError('');
    axios.get('/api/issues').then(res => {
      const raw = Array.isArray(res.data) ? res.data : [];
      setIssues(raw.map((item: any) => normalizeIssue(item, user?.id)));
      setLoading(false);
    }).catch(() => {
      setError('Failed to load issues. Make sure the backend is running.');
      setLoading(false);
    });
  };

  useEffect(fetchIssues, []);

  const toggleCategory = (cat: string) => {
    setCategoryFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const clearCategoryFilters = () => setCategoryFilters([]);

  // Derive active categories from actual data for count badges
  const categoryCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] ?? 0) + 1;
    return acc;
  }, {});

  let filteredIssues = issues.filter(issue =>
    issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issue.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (statusFilter !== 'All') {
    filteredIssues = filteredIssues.filter(issue => {
      if (statusFilter === 'Open')        return issue.status === 'open';
      if (statusFilter === 'In Progress') return issue.status === 'in_progress';
      if (statusFilter === 'Resolved')    return issue.status === 'resolved';
      return true;
    });
  }

  if (categoryFilters.length > 0) {
    filteredIssues = filteredIssues.filter(issue => categoryFilters.includes(issue.category));
  }

  if (tab === 'Trending') {
    filteredIssues = [...filteredIssues].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else if (tab === 'Newest') {
    filteredIssues = [...filteredIssues].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  } else if (tab === 'Resolved') {
    filteredIssues = filteredIssues.filter(issue => issue.status === 'resolved');
  }

  // Only show categories that actually have issues in the dataset
  const activeCategories = ALL_CATEGORIES.filter(cat => (categoryCounts[cat] ?? 0) > 0);

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

        {/* ─── Left Sidebar Filters ─── */}
        <div className="w-full md:w-64 shrink-0 space-y-6">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Status Filter */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-300 mb-3 text-xs uppercase tracking-wider">Status</h4>
            <div className="space-y-2">
              {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="status"
                    className="text-brand-600 focus:ring-brand-500"
                    checked={statusFilter === status}
                    onChange={() => setStatusFilter(status)}
                  />
                  <span className="text-slate-600 dark:text-slate-400 text-sm group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-300 text-xs uppercase tracking-wider">
                Category
              </h4>
              {categoryFilters.length > 0 && (
                <button
                  onClick={clearCategoryFilters}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {(activeCategories.length > 0 ? activeCategories : ALL_CATEGORIES).map(cat => {
                const theme   = CATEGORY_THEME[cat];
                const count   = categoryCounts[cat] ?? 0;
                const checked = categoryFilters.includes(cat);

                return (
                  <label
                    key={cat}
                    className={`flex items-center gap-2.5 cursor-pointer rounded-lg px-2.5 py-2 border transition-all duration-150 ${
                      checked
                        ? `${theme.chip} border-current`
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Custom colored checkbox */}
                    <span className="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                      />
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          checked
                            ? `${theme.dot} border-transparent`
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {checked && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white fill-none stroke-white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 3.5 6.5 9 1" />
                          </svg>
                        )}
                      </span>
                    </span>

                    {/* Dot + label */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                    <span className={`flex-1 text-sm font-medium truncate ${
                      checked
                        ? 'text-current'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {cat}
                    </span>

                    {/* Count badge */}
                    {count > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        checked
                          ? 'bg-white/40 dark:bg-black/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Active filter chips summary */}
            {categoryFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {categoryFilters.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all hover:opacity-70 ${CATEGORY_THEME[cat]?.chip}`}
                  >
                    {cat.split('/')[0].trim()}
                    <X size={10} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Main Feed ─── */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px mb-4">
            {['Trending', 'Newest', 'Resolved'].map(tabName => (
              <button
                key={tabName}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === tabName
                    ? 'border-brand-600 dark:border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
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
                {categoryFilters.length > 0 && (
                  <button
                    onClick={clearCategoryFilters}
                    className="mt-2 text-sm text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Clear category filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};