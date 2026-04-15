import React, { useState } from 'react';
import { CampusMap } from '../components/map/CampusMap';
import { Filter, X } from 'lucide-react';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export const MapPage = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilters, setPriorityFilters] = useState<string[]>(PRIORITIES);

  const togglePriority = (p: string) => {
    setPriorityFilters(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] md:h-full">
      {/* Map */}
      <CampusMap statusFilter={statusFilter} priorityFilters={priorityFilters} />

      {/* Floating Filter Panel */}
      <div className="absolute top-4 left-4 z-[400]">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center gap-2 font-medium text-sm"
        >
          <Filter size={16} />
          <span>Filters</span>
          {(statusFilter !== 'All' || priorityFilters.length < PRIORITIES.length) && (
            <span className="w-2 h-2 rounded-full bg-brand-500 ml-1" />
          )}
        </button>

        {showFilters && (
          <div className="mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 animate-fade-in">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400">
                <X size={16} />
              </button>
            </div>

            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 text-xs uppercase tracking-wider">Status</h4>
            <div className="space-y-1.5 mb-4">
              {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="map_status"
                    className="text-brand-600 focus:ring-brand-500"
                    checked={statusFilter === status}
                    onChange={() => setStatusFilter(status)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{status}</span>
                </label>
              ))}
            </div>

            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 text-xs uppercase tracking-wider">Priority</h4>
            <div className="space-y-1.5">
              {PRIORITIES.map(prio => (
                <label key={prio} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="text-brand-600 rounded focus:ring-brand-500"
                    checked={priorityFilters.includes(prio)}
                    onChange={() => togglePriority(prio)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{prio}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => { setStatusFilter('All'); setPriorityFilters(PRIORITIES); }}
              className="mt-4 w-full text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-center"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};