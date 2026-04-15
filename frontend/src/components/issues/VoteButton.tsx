import type { FC } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  votes: number;
  userVote: 'up' | 'down' | null;
  onVote: (type: 'up' | 'down') => void;
  vertical?: boolean;
}

export const VoteButton: FC<Props> = ({ votes, userVote, onVote, vertical = true }) => (
  <div className={`flex ${vertical ? 'flex-col items-center gap-1' : 'flex-row items-center gap-2'}`}>
    <button
      className={`p-1 rounded hover:bg-slate-100 ${userVote === 'up' ? 'text-brand-600' : 'text-slate-400'} transition-all duration-200`}
      onClick={() => onVote('up')}
      aria-label="Upvote"
      type="button"
    >
      <ChevronUp size={20} strokeWidth={userVote === 'up' ? 3 : 2} />
    </button>
    <span className="font-mono font-medium text-slate-700 select-none">{votes}</span>
    <button
      className={`p-1 rounded hover:bg-slate-100 ${userVote === 'down' ? 'text-rose-600' : 'text-slate-400'} transition-all duration-200`}
      onClick={() => onVote('down')}
      aria-label="Downvote"
      type="button"
    >
      <ChevronDown size={20} strokeWidth={userVote === 'down' ? 3 : 2} />
    </button>
  </div>
);
