import React from 'react';
import { BarChart3, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

const categoryData = [
  { name: 'Electrical', value: 400, color: '#f59e0b' },
  { name: 'Sanitation', value: 300, color: '#3b82f6' },
  { name: 'Plumbing', value: 300, color: '#06b6d4' },
  { name: 'Furniture', value: 200, color: '#8b5cf6' },
];

const trendData = [
  { week: 'W1', reported: 45, resolved: 30 },
  { week: 'W2', reported: 52, resolved: 38 },
  { week: 'W3', reported: 38, resolved: 45 },
  { week: 'W4', reported: 65, resolved: 50 },
];

export const DashboardPage = () => {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Resolution Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Overview of campus infrastructure health.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Issues', value: '1,248', icon: BarChart3, color: 'text-brand-600', bg: 'bg-brand-100' },
          { label: 'Resolved (30d)', value: '84%', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { label: 'Avg Resolution', value: '2.4 days', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Pending Critical', value: '12', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg.replace('bg-', 'bg-').replace('100', '100 dark:bg-opacity-10 dark:bg-')} ${stat.color} dark:!text-[${stat.color.replace('text-', '')}]`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Issues by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 flex-wrap mt-4">
            {categoryData.map(c => (
              <div key={c.name} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Reporting vs Resolution Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="reported" stroke="#7c3aed" strokeWidth={3} dot={{r: 4}} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};