import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { dummyIssues } from '../data/dummyData';
import { IssueCard } from '../issues/IssueCard';
import { Award, FileText, ThumbsUp } from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useContext(AuthContext) || {};
  const myIssues = dummyIssues.slice(0, 2); // Dummy subset

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-brand-400 to-purple-500 opacity-20"></div>
        <div className="relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-display font-bold border-4 border-white shadow-lg mb-4">
            {user.anonymousHandle.substring(0, 2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900">{user.anonymousHandle}</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs">Role: {user.role}</p>
        </div>

        <div className="flex justify-center gap-8 mt-8 pt-8 border-t border-slate-100">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-2"><FileText size={20} /></div>
            <p className="text-2xl font-bold text-slate-900">{user.reportCount}</p>
            <p className="text-xs font-medium text-slate-500 uppercase">Reports Filed</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-2"><Award size={20} /></div>
            <p className="text-2xl font-bold text-slate-900">{user.resolvedCount}</p>
            <p className="text-xs font-medium text-slate-500 uppercase">Resolved via You</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-2"><ThumbsUp size={20} /></div>
            <p className="text-2xl font-bold text-slate-900">142</p>
            <p className="text-xs font-medium text-slate-500 uppercase">Upvotes Given</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">My Reports</h2>
        <div className="space-y-4">
          {myIssues.map((issue, idx) => (
            <IssueCard key={issue.id} issue={issue} rank={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );
};