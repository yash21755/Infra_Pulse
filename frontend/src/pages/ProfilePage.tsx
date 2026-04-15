import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { IssueCard } from '../issues/IssueCard';
import { Award, FileText, CheckCircle2, Calendar, Bell, BellOff, RefreshCw } from 'lucide-react';
import axios from 'axios';
import type { Issue, User } from '../types';

/** Reuse the same normalizer as FeedPage */
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
      setMyIssues(raw.map(normalizeIssue));
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
      <div className="max-w-4xl mx-auto py-16 px-4 text-center text-slate-500">
        You need to be logged in to view your profile.
      </div>
    );
  }

  const avatarInitials = (profile?.anonymousHandle ?? '??').substring(0, 2).toUpperCase();

  const roleColors: Record<string, string> = {
    student: 'bg-blue-100 text-blue-700',
    faculty: 'bg-purple-100 text-purple-700',
    authority: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">

      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-brand-400 to-purple-500 opacity-20"></div>

        {/* Refresh button */}
        <button
          onClick={fetchData}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          title="Refresh profile"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-display font-bold border-4 border-white shadow-lg mb-4">
            {avatarInitials}
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            {loading ? '...' : profile?.anonymousHandle}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${roleColors[profile?.role ?? 'student'] ?? 'bg-slate-100 text-slate-600'}`}>
              {profile?.role ?? '—'}
            </span>
            <span className={`px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${profile?.notificationsEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
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
        <div className="flex justify-center gap-8 mt-8 pt-8 border-t border-slate-100">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-2">
              <FileText size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? '—' : profile?.reportCount ?? 0}
            </p>
            <p className="text-xs font-medium text-slate-500 uppercase">Reports Filed</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
              <Award size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? '—' : profile?.resolvedCount ?? 0}
            </p>
            <p className="text-xs font-medium text-slate-500 uppercase">Resolved</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? '—' : myIssues.filter(i => i.status === 'open').length}
            </p>
            <p className="text-xs font-medium text-slate-500 uppercase">Still Open</p>
          </div>
        </div>
      </div>

      {/* My Reports Section */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          My Reports
          {!loading && (
            <span className="ml-2 text-sm font-normal text-slate-400">({myIssues.length} total)</span>
          )}
        </h2>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : myIssues.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No reports yet</p>
            <p className="text-slate-400 text-sm mt-1">Issues you report will appear here.</p>
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