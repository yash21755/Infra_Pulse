import React from 'react';
import type { Issue } from '../types';
import { MapPin, Clock, ChevronUp, ChevronDown, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORY_THEME } from '../pages/FeedPage';

interface IssueCardProps {
  issue: Issue;
  rank: number;
  onAction?: () => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusColors = {
  open: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  in_progress: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  resolved: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
};
const statusLabels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

export const IssueCard: React.FC<IssueCardProps> = ({ issue, rank, onAction }) => {
  const thumbUrl = issue.images?.[0]?.url ?? null;

  const handleVote = async (e: React.MouseEvent, type: 'up' | 'down') => {
    e.preventDefault(); // don't navigate to detail
    if (!issue.id) return;
    const token = localStorage.getItem('infra_pulse_token');
    try {
      await fetch(`/api/issues/${issue.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
      onAction?.();
    } catch { }
  };

  return (
    <Link to={`/issues/${issue.id}`} className="block group">
      <div className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-slate-100 dark:border-slate-800 border-l-4 border-l-brand-500 overflow-hidden">

        {/* Thumbnail */}
        {thumbUrl ? (
          <div className="hidden sm:block w-32 shrink-0">
            <img
              src={thumbUrl}
              alt={issue.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="hidden sm:flex w-20 shrink-0 items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center gap-1 text-slate-300 dark:text-slate-600">
              <ImageIcon size={20} />
            </div>
          </div>
        )}

        <div className="flex flex-1 gap-3 p-4 min-w-0">

          {/* Rank */}
          <div className="hidden sm:flex items-center justify-center w-7 text-xl font-display font-bold text-slate-200 dark:text-slate-700 shrink-0">
            #{rank}
          </div>

          {/* Vote Column */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <button
              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${issue.userVote === 'up' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`}
              onClick={(e) => handleVote(e, 'up')}
            >
              <ChevronUp size={22} strokeWidth={issue.userVote === 'up' ? 3 : 2} />
            </button>
            <span className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-300">
              {issue.upvotes - issue.downvotes}
            </span>
            <button
              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${issue.userVote === 'down' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}
              onClick={(e) => handleVote(e, 'down')}
            >
              <ChevronDown size={22} strokeWidth={issue.userVote === 'down' ? 3 : 2} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-3 mb-1">
              <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                {issue.title}
              </h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status as keyof typeof statusColors]}`}>
                {statusLabels[issue.status as keyof typeof statusLabels]}
              </span>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 mb-3">
              {issue.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500 font-medium">
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                <span className="truncate max-w-[160px]">{issue.location?.label || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={12} />
                {timeAgo(issue.reportedAt)}
              </div>
              {issue.category && (() => {
                const theme = CATEGORY_THEME[issue.category];
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${theme?.chip ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme?.dot ?? 'bg-slate-400'}`} />
                    {issue.category}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};