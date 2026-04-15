import React, { useState } from 'react';
import { CampusMap } from '../components/map/CampusMap';
import { Filter } from 'lucide-react';

export const MapPage = () => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] md:h-full">
      {/* Map Background */}
      <CampusMap />

      {/* Floating Filter Overlay */}
      <div className="absolute top-4 left-4 z-[400]">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="bg-white p-3 rounded-xl shadow-md border border-slate-200 text-slate-700 hover:text-brand-600 transition-colors flex items-center gap-2"
        >
          <Filter size={20} />
          <span className="font-medium hidden sm:inline">Filters</span>
        </button>

        {showFilters && (
          <div className="mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-fade-in">
            <h3 className="font-bold text-slate-900 mb-3 text-sm">Status</h3>
            <div className="space-y-2 mb-4">
              {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="map_status" className="text-brand-600 focus:ring-brand-500" defaultChecked={status === 'All'} />
                  <span className="text-sm text-slate-700">{status}</span>
                </label>
              ))}
            </div>
            
            <h3 className="font-bold text-slate-900 mb-3 text-sm">Priority</h3>
            <div className="space-y-2">
              {['Critical', 'High', 'Medium', 'Low'].map(prio => (
                <label key={prio} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="text-brand-600 rounded focus:ring-brand-500" defaultChecked />
                  <span className="text-sm text-slate-700">{prio}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-[400] bg-white rounded-xl shadow-md border border-slate-200 p-3 hidden sm:block">
        <div className="flex gap-4 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Critical (12)</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> High (8)</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-300"></div> Open (24)</span>
        </div>
      </div>
    </div>
  );
};