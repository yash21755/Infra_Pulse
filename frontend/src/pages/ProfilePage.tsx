import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { IssueCard } from '../issues/IssueCard';
import { Award, FileText, CheckCircle2, Calendar, Bell, BellOff, RefreshCw } from 'lucide-react';
import axios from 'axios';
import type { Issue, User } from '../types';

/** Reuse the same normalizer as FeedPage */
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
    category: raw.category ?? 'Electrical',
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

function authHeaders() {
  const token = localStorage.getItem('infra_pulse_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export const ProfilePage = () => {
  const { user: ctxUser } = useContext(AuthContext) || {};

  const [profile, setProfile] = useState<User | null>(ctxUser ?? null);
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = authHeaders();

      const [profileRes, issuesRes] = await Promise.all([
        axios.get('/api/users/me', { headers }),
        axios.get('/api/users/me/issues', { headers }),
      ]);

      // Map DB profile → User type
      const p = profileRes.data;
      setProfile({
        id: String(p.id ?? p._id),
        anonymousHandle: p.anonymousHandle ?? ctxUser?.anonymousHandle ?? 'Anonymous',
        role: p.role ?? ctxUser?.role ?? 'student',
        reportCount: p.reportCount ?? 0,
        resolvedCount: p.resolvedCount ?? 0,
        joinedAt: p.joinedAt ?? p.createdAt ?? new Date().toISOString(),
        notificationsEnabled: p.notificationsEnabled ?? true,
      });

      const raw = Array.isArray(issuesRes.data) ? issuesRes.data : [];
      setMyIssues(raw.map((item: any) => normalizeIssue(item, ctxUser?.id)));
    } catch (err: any) {
      setError('Could not load profile data. Are you logged in?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!ctxUser) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center text-slate-500 dark:text-slate-400">
        You need to be logged in to view your profile.
      </div>
    );
  }

  const avatarInitials = (profile?.anonymousHandle ?? '??').substring(0, 2).toUpperCase();

  const roleColors: Record<string, string> = {
    student: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    faculty: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
    authority: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">

      {/* Header Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-brand-400 to-purple-500 opacity-20"></div>

        {/* Refresh button */}
        <button
          onClick={fetchData}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
          title="Refresh profile"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-display font-bold border-4 border-white dark:border-slate-900 shadow-lg mb-4">
            {avatarInitials}
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            {loading ? '...' : profile?.anonymousHandle}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${roleColors[profile?.role ?? 'student'] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {profile?.role ?? '—'}
            </span>
            <span className={`px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${profile?.notificationsEnabled ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {profile?.notificationsEnabled ? <><Bell size={11} /> Notifications On</> : <><BellOff size={11} /> Notifications Off</>}
            </span>
          </div>
          {profile?.joinedAt && (
            <p className="text-slate-400 text-xs mt-2 flex items-center justify-center gap-1">
              <Calendar size={12} /> Joined {formatDate(profile.joinedAt)}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-xl flex items-center justify-center mb-2">
              <FileText size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : profile?.reportCount ?? 0}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Reports Filed</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-2">
              <Award size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : profile?.resolvedCount ?? 0}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Resolved</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : myIssues.filter(i => i.status === 'open').length}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Still Open</p>
          </div>
        </div>
      </div>

      {/* My Reports Section */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          My Reports
          {!loading && (
            <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">({myIssues.length} total)</span>
          )}
        </h2>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : myIssues.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No reports yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Issues you report will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myIssues.map((issue, idx) => (
              <IssueCard key={issue.id} issue={issue} rank={idx + 1} onAction={fetchData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};