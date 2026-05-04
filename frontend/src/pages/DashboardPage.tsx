import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip, LineChart, Line,
  XAxis, YAxis, CartesianGrid
} from 'recharts';
import axios from 'axios';

const CATEGORY_COLORS: Record<string, string> = {
  'Electrical':           '#f59e0b',
  'Sanitation':           '#3b82f6',
  'Plumbing':             '#06b6d4',
  'HVAC':                 '#ef4444',
  'Structural':           '#8b5cf6',
  'IT / Network':         '#10b981',
  'Landscaping / Outdoors': '#84cc16',
  'Elevator / Escalator': '#f97316',
  'Safety / Security':    '#ec4899',
  'Furniture / Equipment':'#6366f1',
  'General':              '#94a3b8',
};

const DEFAULT_COLOR = '#94a3b8';

interface StatsData {
  total: number;
  resolved: number;
  inProgress: number;
  open: number;
  resolutionRate: number;
  categoryBreakdown: { name: string; value: number }[];
  weeklyTrend: { week: string; reported: number; resolved: number }[];
}

export const DashboardPage = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/stats')
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(() => { setError('Failed to load stats.'); setLoading(false); });
  }, []);

  const kpi = [
    {
      label: 'Total Issues',
      value: loading ? '—' : stats?.total?.toLocaleString() ?? '0',
      icon: BarChart3,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-100 dark:bg-brand-500/20',
    },
    {
      label: 'Resolution Rate',
      value: loading ? '—' : `${stats?.resolutionRate ?? 0}%`,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    },
    {
      label: 'In Progress',
      value: loading ? '—' : stats?.inProgress?.toLocaleString() ?? '0',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-500/20',
    },
    {
      label: 'Still Open',
      value: loading ? '—' : stats?.open?.toLocaleString() ?? '0',
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-100 dark:bg-rose-500/20',
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
            Resolution Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Overview of campus infrastructure health.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpi.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4"
          >
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {loading ? <Loader2 size={20} className="animate-spin text-slate-300" /> : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Issues by Category
          </h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          ) : stats?.categoryBreakdown?.length ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryBreakdown}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.name] ?? DEFAULT_COLOR}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{
                        backgroundColor: 'var(--color-bg, #1e293b)',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                {stats.categoryBreakdown.map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR }}
                    />
                    {c.name} ({c.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              No issues reported yet.
            </div>
          )}
        </div>

        {/* Weekly Trend Line */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Reporting vs Resolution Trend
          </h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          ) : stats?.weeklyTrend?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Line type="monotone" dataKey="reported" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} name="Reported" />
                  <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Resolved" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              No weekly data available.
            </div>
          )}

          {/* Legend */}
          {!loading && stats?.weeklyTrend?.length ? (
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className="w-4 h-1 rounded bg-purple-600" /> Reported
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className="w-4 h-1 rounded bg-emerald-500" /> Resolved
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};