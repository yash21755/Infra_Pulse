import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, Eye, ChevronUp, ChevronDown, Share2, ArrowLeft,
  Shield, Wrench, CheckCircle2, AlertCircle, ImagePlus, X, Send, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AuthContext } from '../context/AuthContext';
import type { Issue, AuthorityUpdate } from '../types';
import axios from 'axios';

/* ── helpers ── */
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('infra_pulse_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeIssue(raw: any): Issue {
  return {
    id: String(raw._id ?? raw.id),
    title: raw.title ?? '',
    description: raw.description ?? '',
    category: raw.category ?? 'Electrical',
    tags: raw.tags ?? [],
    status: raw.status ?? 'open',
    priority: raw.priority ?? 'medium',
    upvotes: Array.isArray(raw.votes) ? raw.votes.length : (raw.upvotes ?? 0),
    downvotes: raw.downvotes ?? 0,
    userVote: raw.userVote ?? null,
    location: raw.location ?? { lat: 0, lng: 0, label: 'Unknown' },
    images: raw.imageUrl
      ? [{ id: raw._id, url: raw.imageUrl, uploadedAt: raw.createdAt ?? '', type: 'report' as const }]
      : (raw.images ?? []),
    reportedAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    commentCount: raw.commentCount ?? 0,
    viewCount: raw.viewCount ?? 0,
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

/* ── status config ── */
const statusConfig = {
  open:        { label: 'Open',        color: 'bg-slate-100 text-slate-700',  dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
};

const tagConfig = {
  work_in_progress: {
    label: 'Work In Progress',
    icon: <Wrench size={13} />,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  finished: {
    label: 'Finished',
    icon: <CheckCircle2 size={13} />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

/* ══════════════════════════════════════════════════════════════════ */
export const IssueDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useContext(AuthContext) || {};
  const isAuthority = user?.role === 'authority';

  const [issue, setIssue] = useState<Issue | null>(null);
  const [updates, setUpdates] = useState<AuthorityUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // vote local state
  const [voteCount, setVoteCount] = useState(0);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);

  // update form
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateTag, setUpdateTag] = useState<'work_in_progress' | 'finished'>('work_in_progress');
  const [updateImage, setUpdateImage] = useState<File | null>(null);
  const [updateImagePreview, setUpdateImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── fetch ── */
  const fetchAll = async () => {
    if (!id) return;
    try {
      const [issueRes, updatesRes] = await Promise.all([
        axios.get(`/api/issues/${id}`),
        axios.get(`/api/issues/${id}/updates`),
      ]);
      const norm = normalizeIssue(issueRes.data);
      setIssue(norm);
      setVoteCount(norm.upvotes - norm.downvotes);
      setUserVote(norm.userVote);
      setUpdates((Array.isArray(updatesRes.data) ? updatesRes.data : []).map(normalizeUpdate));
    } catch {
      setError('Could not load this issue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  /* ── vote ── */
  const handleVote = async (type: 'up' | 'down') => {
    if (!id) return;
    // optimistic
    const prev = userVote;
    const delta = type === 'up' ? 1 : -1;
    if (userVote === type) {
      setUserVote(null);
      setVoteCount(v => v - delta);
    } else {
      setUserVote(type);
      setVoteCount(v => v + delta + (prev ? -delta * 2 : 0));
    }
    try {
      await fetch(`/api/issues/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
    } catch { fetchAll(); }
  };

  /* ── image pick ── */
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
    setPosting(true);
    setPostError('');
    try {
      const form = new FormData();
      form.append('message', updateMsg.trim());
      form.append('tag', updateTag);
      if (updateImage) form.append('image', updateImage);

      await axios.post(`/api/issues/${id}/updates`, form, {
        headers: { ...authHeaders() },
        withCredentials: true,
      });
      setUpdateMsg('');
      setUpdateTag('work_in_progress');
      removeImage();
      fetchAll(); // refresh issue status + updates
    } catch (err: any) {
      setPostError(err?.response?.data?.message ?? 'Failed to post update.');
    } finally {
      setPosting(false);
    }
  };

  /* ── render ── */
  if (loading) return (
    <div className="flex justify-center items-center h-64 text-slate-400">
      <Loader2 size={32} className="animate-spin" />
    </div>
  );

  if (error || !issue) return (
    <div className="max-w-5xl mx-auto py-16 px-4 text-center">
      <AlertCircle size={48} className="mx-auto text-rose-400 mb-4" />
      <p className="text-slate-600">{error || 'Issue not found.'}</p>
      <Link to="/feed" className="mt-4 inline-block text-brand-600 hover:underline">← Back to Feed</Link>
    </div>
  );

  const sc = statusConfig[issue.status as keyof typeof statusConfig] ?? statusConfig.open;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <Link to="/feed" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 font-medium mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Feed
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 space-y-6 min-w-0">

          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${sc.color}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${sc.dot}`} />
                {sc.label}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 uppercase tracking-wide">
                {issue.priority} Priority
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 uppercase tracking-wide">
                {issue.category}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 leading-tight mb-3">
              {issue.title}
            </h1>
            {issue.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {issue.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-md text-sm font-medium">{tag}</span>
                ))}
              </div>
            )}
          </div>

          <p className="text-lg text-slate-700 leading-relaxed">{issue.description}</p>

          {/* Issue images */}
          {issue.images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {issue.images.map(img => (
                <img key={img.id} src={img.url} alt="Issue" className="rounded-xl w-full h-64 object-cover border border-slate-200 shadow-sm" />
              ))}
            </div>
          )}

          {/* ── AUTHORITY UPDATES ── */}
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-brand-500" />
              <h2 className="text-xl font-bold text-slate-900">Authority Updates</h2>
              <span className="ml-1 text-sm text-slate-400 font-normal">({updates.length})</span>
            </div>

            {/* Update list */}
            {updates.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                No updates yet from authorities.
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map(upd => {
                  const tc = tagConfig[upd.tag as keyof typeof tagConfig];
                  return (
                    <div
                      key={upd.id}
                      className={`rounded-xl border p-5 ${upd.tag === 'finished' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {upd.author.anonymousHandle.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-slate-800">{upd.author.anonymousHandle}</span>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Shield size={10} className="text-brand-400" />
                              Authority · {timeAgo(upd.createdAt)}
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${tc.color}`}>
                          {tc.icon} {tc.label}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-slate-700 text-sm leading-relaxed mb-3">{upd.message}</p>

                      {/* Proof image */}
                      {upd.imageUrl && (
                        <img
                          src={upd.imageUrl}
                          alt="Proof of work"
                          className="rounded-lg max-h-56 w-full object-cover border border-slate-200 shadow-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── POST UPDATE FORM (authority only) ── */}
            {isAuthority && (
              <form onSubmit={submitUpdate} className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Shield size={16} className="text-brand-500" /> Post an Update
                </h3>

                {/* Tag selector */}
                <div className="flex gap-3">
                  {(['work_in_progress', 'finished'] as const).map(t => {
                    const tc = tagConfig[t];
                    const selected = updateTag === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setUpdateTag(t)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                          selected
                            ? t === 'finished'
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {tc.icon} {tc.label}
                      </button>
                    );
                  })}
                </div>

                {/* Message */}
                <textarea
                  rows={3}
                  value={updateMsg}
                  onChange={e => setUpdateMsg(e.target.value)}
                  placeholder="Describe the current status or work done..."
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                />

                {/* Image attach */}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                {updateImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={updateImagePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600 transition-colors"
                  >
                    <ImagePlus size={16} /> Attach proof image (optional)
                  </button>
                )}

                {postError && (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{postError}</p>
                )}

                <Button type="submit" variant="primary" disabled={posting || !updateMsg.trim()} className="w-full justify-center gap-2">
                  {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {posting ? 'Posting...' : 'Post Update'}
                </Button>
              </form>
            )}

            {!isAuthority && user && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <Shield size={14} />
                Only authorities can post updates on this issue.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-6 space-y-6">

            {/* Vote */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Community Vote</p>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <button
                  onClick={() => handleVote('up')}
                  className={`p-2 rounded-lg transition-colors ${userVote === 'up' ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <ChevronUp size={26} strokeWidth={userVote === 'up' ? 3 : 2} />
                </button>
                <div className="text-center">
                  <span className="text-3xl font-display font-bold text-slate-900">{voteCount}</span>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">votes</p>
                </div>
                <button
                  onClick={() => handleVote('down')}
                  className={`p-2 rounded-lg transition-colors ${userVote === 'down' ? 'bg-rose-100 text-rose-500' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <ChevronDown size={26} strokeWidth={userVote === 'down' ? 3 : 2} />
                </button>
              </div>
            </div>

            {/* Meta */}
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <MapPin className="text-slate-400 mt-0.5 shrink-0" size={16} />
                <span>{issue.location?.label || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-slate-400 shrink-0" size={16} />
                <span>Reported {timeAgo(issue.reportedAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Eye className="text-slate-400 shrink-0" size={16} />
                <span>{issue.viewCount} views</span>
              </div>
            </div>

            {/* Share */}
            <div className="pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => { navigator.clipboard.writeText(window.location.href); }}
              >
                <Share2 size={16} /> Copy Link
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};