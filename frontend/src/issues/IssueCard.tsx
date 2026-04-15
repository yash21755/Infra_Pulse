import React from 'react';
import type { Issue } from '../types';
import { MapPin, MessageSquare, Eye, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface IssueCardProps {
  issue: Issue;
  rank: number;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue, rank }) => {
  const statusColors = {
    open: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700'
  };

  const statusLabels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

  return (
    <div className="flex bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-slate-100 border-l-4 border-l-brand-500 p-4 gap-4 cursor-pointer group">
      
      {/* Rank */}
      <div className="hidden sm:flex items-center justify-center w-8 text-2xl font-display font-bold text-slate-200">
        #{rank}
      </div>

      {/* Vote Column */}
      <div className="flex flex-col items-center gap-1">
        <button className={`p-1 rounded hover:bg-slate-100 ${issue.userVote === 'up' ? 'text-brand-600' : 'text-slate-400'}`}>
          <ChevronUp size={24} strokeWidth={issue.userVote === 'up' ? 3 : 2} />
        </button>
        <span className="font-mono font-medium text-slate-700">{issue.upvotes - issue.downvotes}</span>
        <button className={`p-1 rounded hover:bg-slate-100 ${issue.userVote === 'down' ? 'text-rose-600' : 'text-slate-400'}`}>
          <ChevronDown size={24} strokeWidth={issue.userVote === 'down' ? 3 : 2} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex justify-between items-start gap-4 mb-1">
          <h3 className="font-display font-semibold text-slate-900 text-lg group-hover:text-brand-600 transition-colors truncate">
            {issue.title}
          </h3>
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status]}`}>
            {statusLabels[issue.status]}
          </span>
        </div>
        
        <p className="text-slate-600 text-sm line-clamp-2 mb-3">
          {issue.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-slate-400" />
            {issue.location.label}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" />
            2 hrs ago
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-slate-400" />
            {issue.commentCount}
          </div>
          <div className="flex items-center gap-1.5">
            <Eye size={14} className="text-slate-400" />
            {issue.viewCount}
          </div>
        </div>
      </div>
    </div>
  );
};