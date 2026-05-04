import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, Eye, ChevronUp, ChevronDown, Share2, ArrowLeft,
  Shield, Wrench, CheckCircle2, AlertCircle, ImagePlus, X, Send,
  Loader2, Flag, Tag, User, Calendar, Activity, CheckCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AuthContext } from '../context/AuthContext';
import type { Issue, AuthorityUpdate } from '../types';
import axios from 'axios';
import { CATEGORY_THEME } from './FeedPage';

/* ─────────────────────────────────────────────── helpers ── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('infra_pulse_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeIssue(raw: any, currentUserId?: string): Issue & { reporterHandle?: string } {
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
    category: raw.category ?? 'Electrical',
    tags: raw.tags ?? [],
    status: raw.status ?? 'open',
    upvotes:   upvoterIds.length,
    downvotes: downvoterIds.length,
    userVote,
    location: raw.location ?? { lat: 0, lng: 0, label: 'Unknown' },
    images: raw.imageUrl
      ? [{ id: raw._id, url: raw.imageUrl, uploadedAt: raw.createdAt ?? '', type: 'report' as const }]
      : (raw.images ?? []),
    reportedAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt:  raw.updatedAt ?? new Date().toISOString(),
    commentCount: raw.commentCount ?? 0,
    viewCount:    raw.viewCount ?? 0,
    reporterHandle: raw.reporter?.anonymousHandle ?? 'Anonymous',
  };
}

function normalizeUpdate(raw: any): AuthorityUpdate {
  return {
    id: String(raw._id ?? raw.id),
    issueId: String(raw.issue),
    author: {
      id: String(raw.author?._id ?? raw.author?.id ?? ''),
      anonymousHandle: raw.author?.anonymousHandle ?? 'Authority',
      role: raw.author?.role ?? 'authority',
    },
    message: raw.message ?? '',
    tag: raw.tag,
    imageUrl: raw.imageUrl,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

/* ─────────────────────────────────────── status / tag config ── */

const STATUS_CFG = {
  open:        { label: 'Open',        badge: 'bg-slate-100 text-slate-700 border-slate-200',    dot: 'bg-slate-400'   },
  in_progress: { label: 'In Progress', badge: 'bg-amber-100 text-amber-700 border-amber-200',    dot: 'bg-amber-400'   },
  resolved:    { label: 'Resolved',    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};


const TAG_CFG = {
  work_in_progress: {
    label: 'Work In Progress',
    icon: <Wrench size={12} />,
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    timelineDot: 'bg-amber-400 ring-amber-200',
    timelineLine: 'bg-amber-200',
    card: 'bg-amber-50 border-amber-200',
  },
  finished: {
    label: 'Finished',
    icon: <CheckCheck size={12} />,
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    timelineDot: 'bg-emerald-500 ring-emerald-200',
    timelineLine: 'bg-emerald-200',
    card: 'bg-emerald-50 border-emerald-200',
  },
};

/* ─────────────────────────────────────────────── Timeline ── */

interface TimelineEvent {
  id: string;
  type: 'reported' | 'work_in_progress' | 'finished';
  date: string;
  title: string;
  body: string;
  author?: string;
  imageUrl?: string;
}

function buildTimeline(issue: Issue & { reporterHandle?: string }, updates: AuthorityUpdate[]): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: 'reported',
      type: 'reported',
      date: issue.reportedAt,
      title: 'Issue Reported',
      body: issue.description,
      author: issue.reporterHandle ?? 'Anonymous',
    },
    ...updates.slice().reverse().map(u => ({
      id: u.id,
      type: u.tag as 'work_in_progress' | 'finished',
      date: u.createdAt,
      title: u.tag === 'finished' ? 'Marked as Finished' : 'Update: Work In Progress',
      body: u.message,
      author: u.author.anonymousHandle,
      imageUrl: u.imageUrl,
    })),
  ];
  return events;
}

const TIMELINE_DOT: Record<string, string> = {
  reported:        'bg-indigo-500 ring-indigo-200',
  work_in_progress:'bg-amber-400  ring-amber-200',
  finished:        'bg-emerald-500 ring-emerald-200',
};

const TIMELINE_TITLE_COLOR: Record<string, string> = {
  reported:        'text-indigo-700',
  work_in_progress:'text-amber-700',
  finished:        'text-emerald-700',
};

const TIMELINE_ICON: Record<string, React.ReactNode> = {
  reported:        <Flag size={14} />,
  work_in_progress:<Wrench size={14} />,
  finished:        <CheckCheck size={14} />,
};

/* ══════════════════════════════════════════════════════════════ */

export const IssueDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useContext(AuthContext) || {};
  const isAuthority = user?.role === 'authority';

  const [issue, setIssue] = useState<(Issue & { reporterHandle?: string }) | null>(null);
  const [updates, setUpdates] = useState<AuthorityUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Separate up/down counts so optimistic math is unambiguous
  const [upvoteCount,   setUpvoteCount]   = useState(0);
  const [downvoteCount, setDownvoteCount] = useState(0);
  const [userVote,      setUserVote]      = useState<'up' | 'down' | null>(null);
  const voteScore = upvoteCount - downvoteCount;

  const [updateMsg, setUpdateMsg] = useState('');
  const [updateTag, setUpdateTag] = useState<'work_in_progress' | 'finished'>('work_in_progress');
  const [updateImage, setUpdateImage] = useState<File | null>(null);
  const [updateImagePreview, setUpdateImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── fetch ── */
  const fetchAll = async () => {
    if (!id) return;
    try {
      const [iRes, uRes] = await Promise.all([
        axios.get(`/api/issues/${id}`),
        axios.get(`/api/issues/${id}/updates`),
      ]);
      const norm = normalizeIssue(iRes.data, user?.id);
      setIssue(norm);
      setUpvoteCount(norm.upvotes);
      setDownvoteCount(norm.downvotes);
      setUserVote(norm.userVote);
      setUpdates((Array.isArray(uRes.data) ? uRes.data : []).map(normalizeUpdate));
    } catch {
      setError('Could not load this issue. It may have been removed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  /* ── vote ── */
  const handleVote = async (type: 'up' | 'down') => {
    if (!id) return;
    const prev = userVote;

    // ── Optimistic update (deterministic, no delta math) ──
    if (prev === type) {
      // Click same direction → remove vote
      setUserVote(null);
      if (type === 'up')   setUpvoteCount(u => u - 1);
      else                 setDownvoteCount(d => d - 1);
    } else {
      // New vote or direction switch
      setUserVote(type);
      if (type === 'up') {
        setUpvoteCount(u => u + 1);
        if (prev === 'down') setDownvoteCount(d => d - 1); // switching from down
      } else {
        setDownvoteCount(d => d + 1);
        if (prev === 'up') setUpvoteCount(u => u - 1);     // switching from up
      }
    }

    try {
      await fetch(`/api/issues/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
      // Server response has final counts — sync to prevent drift
    } catch {
      fetchAll(); // revert on error
    }
  };

  /* ── image ── */
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setUpdateImage(f);
    if (f) setUpdateImagePreview(URL.createObjectURL(f));
    else setUpdateImagePreview(null);
  };
  const removeImage = () => {
    setUpdateImage(null);
    if (updateImagePreview) URL.revokeObjectURL(updateImagePreview);
    setUpdateImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ── post update ── */
  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateMsg.trim()) return;
    setPosting(true); setPostError('');
    try {
      const form = new FormData();
      form.append('message', updateMsg.trim());
      form.append('tag', updateTag);
      if (updateImage) form.append('image', updateImage);
      await axios.post(`/api/issues/${id}/updates`, form, {
        headers: { ...authHeaders() }, withCredentials: true,
      });
      setUpdateMsg(''); setUpdateTag('work_in_progress'); removeImage();
      fetchAll();
    } catch (err: any) {
      setPostError(err?.response?.data?.message ?? 'Failed to post update.');
    } finally {
      setPosting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── loading / error ── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
      <Loader2 size={36} className="animate-spin" />
      <p className="text-sm">Loading issue details…</p>
    </div>
  );

  if (error || !issue) return (
    <div className="max-w-3xl mx-auto py-20 px-4 text-center">
      <AlertCircle size={52} className="mx-auto text-rose-400 mb-4" />
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Issue Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
      <Link to="/feed" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold hover:underline">
        <ArrowLeft size={16} /> Back to Feed
      </Link>
    </div>
  );

  const sc    = STATUS_CFG[issue.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.open;
  const timeline = buildTimeline(issue, updates);

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">

      {/* breadcrumb */}
      <Link to="/feed" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-medium mb-6 transition-colors text-sm">
        <ArrowLeft size={15} /> Back to Feed
      </Link>

      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* ═══════════════════════════════ LEFT COLUMN ══ */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ── header card ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* colour strip */}
            <div className={`h-1.5 w-full ${issue.status === 'resolved' ? 'bg-emerald-400' : issue.status === 'in_progress' ? 'bg-amber-400' : 'bg-indigo-500'}`} />

            <div className="p-6 sm:p-8">
              {/* badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${sc.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  {sc.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${CATEGORY_THEME[issue.category]?.chip ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_THEME[issue.category]?.dot ?? 'bg-slate-400'}`} />
                  {issue.category}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white leading-tight mb-4">
                {issue.title}
              </h1>

              {/* meta row */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400 mb-5">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{issue.reporterHandle}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                  {formatDate(issue.reportedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400 dark:text-slate-500" />
                  {issue.location?.label || 'Unknown'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-slate-400 dark:text-slate-500" />
                  {issue.viewCount} views
                </span>
              </div>

              {/* description */}
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">{issue.description}</p>

              {/* tags */}
              {issue.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {issue.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 rounded-md text-xs font-semibold">
                      <Tag size={10} /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── issue photos ── */}
          {issue.images.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <ImagePlus size={18} className="text-brand-500" /> Reported Photos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {issue.images.map(img => (
                  <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                    <img src={img.url} alt="Issue" className="rounded-xl w-full h-60 object-cover border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════ TIMELINE ════════════════ */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <Activity size={18} className="text-brand-500" /> Issue Timeline
            </h2>

            <div className="relative">
              {/* vertical rail */}
              <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800" />

              <div className="space-y-6">
                {timeline.map((event, idx) => {
                  const isLast = idx === timeline.length - 1;
                  const dotClasses = TIMELINE_DOT[event.type] ?? TIMELINE_DOT.reported;
                  const titleColor = TIMELINE_TITLE_COLOR[event.type] ?? 'text-slate-800';
                  const icon = TIMELINE_ICON[event.type];

                  return (
                    <div key={event.id} className="relative flex gap-4 pl-1">
                      {/* dot */}
                      <div className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full ring-4 shrink-0 text-white ${dotClasses} dark:ring-slate-950`}>
                        {icon}
                      </div>

                      {/* content */}
                      <div className={`flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 ${isLast ? 'border-brand-200 dark:border-brand-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                          <div>
                            <span className={`font-bold text-sm ${titleColor}`}>{event.title}</span>
                            {event.author && (
                              <span className="ml-2 text-xs text-slate-400 font-mono">by {event.author}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                            <Clock size={11} />
                            <span title={formatDate(event.date)}>{timeAgo(event.date)}</span>
                          </div>
                        </div>

                        {/* tag badge for updates */}
                        {event.type !== 'reported' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border mb-2 ${TAG_CFG[event.type as keyof typeof TAG_CFG]?.badge}`}>
                            {TAG_CFG[event.type as keyof typeof TAG_CFG]?.icon}
                            {TAG_CFG[event.type as keyof typeof TAG_CFG]?.label}
                          </span>
                        )}

                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{event.body}</p>

                        {event.imageUrl && (
                          <a href={event.imageUrl} target="_blank" rel="noreferrer" className="block mt-3">
                            <img
                              src={event.imageUrl}
                              alt="Proof"
                              className="rounded-lg max-h-52 w-full object-cover border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
                            />
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Shield size={11} /> Authority proof of work
                            </p>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* current status tail */}
                <div className="relative flex gap-4 pl-1">
                  <div className={`relative z-10 w-9 h-9 rounded-full ring-4 shrink-0 flex items-center justify-center ${sc.dot} ring-slate-100`}>
                    {issue.status === 'resolved'
                      ? <CheckCircle2 size={18} className="text-white" />
                      : <Activity size={14} className="text-white" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 py-2">
                    {issue.status === 'resolved' ? '✅ Issue resolved' : issue.status === 'in_progress' ? '🔧 Currently in progress' : '⏳ Awaiting action'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════ AUTHORITY UPDATE FORM ══════ */}
          {isAuthority && (
            <form onSubmit={submitUpdate} className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-500/30 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
                <Shield size={16} className="text-brand-500" /> Post an Authority Update
              </h3>

              {/* tag selector */}
              <div className="grid grid-cols-2 gap-3">
                {(['work_in_progress', 'finished'] as const).map(t => {
                  const c = TAG_CFG[t];
                  const sel = updateTag === t;
                  return (
                    <button
                      key={t} type="button"
                      onClick={() => setUpdateTag(t)}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        sel
                          ? t === 'finished'
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={3}
                value={updateMsg}
                onChange={e => setUpdateMsg(e.target.value)}
                placeholder="Describe what's been done or the current status…"
                className="w-full p-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
              />

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

              {updateImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  <img src={updateImagePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                  <button type="button" onClick={removeImage}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-brand-600 transition-colors">
                  <ImagePlus size={15} /> Attach proof image (optional)
                </button>
              )}

              {postError && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{postError}</p>
              )}

              <Button type="submit" variant="primary" disabled={posting || !updateMsg.trim()} className="w-full justify-center gap-2">
                {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {posting ? 'Posting…' : 'Post Update'}
              </Button>
            </form>
          )}

          {!isAuthority && user && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800">
              <Shield size={14} />
              Only authorities can post updates on this issue.
            </div>
          )}
        </div>

        {/* ══════════════════════════ RIGHT SIDEBAR ══ */}
        <div className="w-full lg:w-72 shrink-0 space-y-5">

          {/* vote card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Community Vote</p>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => handleVote('up')}
                className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 transition-all gap-0.5 ${
                  userVote === 'up' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                }`}>
                <ChevronUp size={22} strokeWidth={userVote === 'up' ? 3 : 2} />
              </button>

              <div className="text-center px-2">
                <p className={`text-3xl font-display font-bold ${voteScore >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                  {voteScore > 0 ? `+${voteScore}` : voteScore}
                </p>
              </div>

              <button onClick={() => handleVote('down')}
                className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 transition-all gap-1 ${
                  userVote === 'down' ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-rose-200 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                }`}>
                <ChevronDown size={22} strokeWidth={userVote === 'down' ? 3 : 2} />
              </button>
            </div>
          </div>

          {/* details card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issue Details</p>

            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><MapPin size={14} /> Location</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300 break-words">{issue.location?.label || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><Calendar size={14} /> Reported</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{timeAgo(issue.reportedAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><User size={14} /> Reporter</dt>
                <dd className="font-mono font-semibold text-slate-700 dark:text-slate-300">{issue.reporterHandle}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><Activity size={14} /> Status</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${sc.badge}`}>{sc.label}</span>
                </dd>
              </div>

              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><Eye size={14} /> Views</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{issue.viewCount}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex items-center gap-1.5 text-slate-400 w-24 shrink-0"><Shield size={14} /> Updates</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">{updates.length}</dd>
              </div>
            </dl>
          </div>

          {/* share card */}
          <Button variant="secondary" onClick={copyLink} className="w-full justify-center gap-2">
            <Share2 size={15} />
            {copied ? 'Link Copied! ✓' : 'Copy Link'}
          </Button>
        </div>

      </div>
    </div>
  );
};