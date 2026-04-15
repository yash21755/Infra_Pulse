import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dummyIssues } from '../data/dummyData';
import { MapPin, Clock, Eye, MessageSquare, ChevronUp, ChevronDown, CheckCircle2, Share2, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const IssueDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const issue = dummyIssues.find(i => i.id === id) || dummyIssues[0]; // fallback for demo
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(issue.userVote);
  const [votes, setVotes] = useState(issue.upvotes - issue.downvotes);

  const handleVote = (type: 'up' | 'down') => {
    if (userVote === type) {
      setUserVote(null);
      setVotes(v => type === 'up' ? v - 1 : v + 1);
    } else {
      setUserVote(type);
      setVotes(v => {
        if (type === 'up') return v + (userVote === 'down' ? 2 : 1);
        return v - (userVote === 'up' ? 2 : 1);
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <Link to="/feed" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 font-medium mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Feed
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Details */}
        <div className="flex-1 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                {issue.status.replace('_', ' ')}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 uppercase tracking-wide">
                {issue.priority} Priority
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 leading-tight mb-4">{issue.title}</h1>
            <div className="flex flex-wrap gap-2 mb-6">
              {issue.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-md text-sm font-medium">{tag}</span>
              ))}
            </div>
          </div>

          <p className="text-lg text-slate-700 leading-relaxed">{issue.description}</p>

          {issue.images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {issue.images.map(img => (
                <img key={img.id} src={img.url} alt="Issue" className="rounded-xl w-full h-64 object-cover border border-slate-200" />
              ))}
            </div>
          )}

          {issue.status === 'resolved' && issue.proofOfWork && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mt-8">
              <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2 mb-4">
                <CheckCircle2 className="text-emerald-500" /> Resolution Confirmed
              </h3>
              <p className="text-emerald-900 mb-4">{issue.proofOfWork.description}</p>
              <div className="text-sm text-emerald-700 font-medium">
                Resolved by <span className="font-bold">{issue.proofOfWork.resolvedBy}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-6">
            {/* Voting Component */}
            <div className="flex items-center justify-between mb-8 p-4 bg-slate-50 rounded-xl">
              <button onClick={() => handleVote('up')} className={`p-2 rounded-lg transition-colors ${userVote === 'up' ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-200 text-slate-500'}`}>
                <ChevronUp size={28} strokeWidth={userVote === 'up' ? 3 : 2} />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-display font-bold text-slate-900">{votes}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Votes</span>
              </div>
              <button onClick={() => handleVote('down')} className={`p-2 rounded-lg transition-colors ${userVote === 'down' ? 'bg-rose-100 text-rose-600' : 'hover:bg-slate-200 text-slate-500'}`}>
                <ChevronDown size={28} strokeWidth={userVote === 'down' ? 3 : 2} />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-600">
              <div className="flex items-center gap-3"><MapPin className="text-slate-400" size={18} /> <span className="font-medium">{issue.location.label}</span></div>
              <div className="flex items-center gap-3"><Clock className="text-slate-400" size={18} /> Reported 2 days ago</div>
              <div className="flex items-center gap-3"><Eye className="text-slate-400" size={18} /> {issue.viewCount} Views</div>
              <div className="flex items-center gap-3"><MessageSquare className="text-slate-400" size={18} /> {issue.commentCount} Comments</div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <Button variant="secondary" className="w-full gap-2">
                <Share2 size={18} /> Share Issue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};