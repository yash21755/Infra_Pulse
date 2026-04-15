import React, { useState } from 'react';
import { IssueCard } from '../issues/IssueCard';
import { Button } from '../components/ui/Button';
import { dummyIssues } from '../data/dummyData';
import { Search, Plus } from 'lucide-react';

export const FeedPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Basic filtering for demo purposes
  const filteredIssues = dummyIssues.filter(issue => 
    issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issue.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Issue Feed</h1>
          <p className="text-slate-500 mt-1">Discover and prioritize campus improvements.</p>
        </div>
        <Button variant="primary" className="gap-2 w-full sm:w-auto">
          <Plus size={20} />
          Report Issue
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Sidebar - Filters */}
        <div className="w-full md:w-64 shrink-0 space-y-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search issues..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">Status</h4>
            <div className="space-y-2">
              {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" className="text-brand-600 focus:ring-brand-500" defaultChecked={status === 'All'} />
                  <span className="text-slate-600 text-sm">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Main Feed Area */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 border-b border-slate-200 pb-px mb-4">
            {['Trending', 'Newest', 'Resolved'].map((tab, idx) => (
              <button 
                key={tab}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${idx === 0 ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredIssues.map((issue, idx) => (
              <IssueCard key={issue.id} issue={issue} rank={idx + 1} />
            ))}
            
            {filteredIssues.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <p className="text-slate-500">No issues found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};