import type { FC, ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: string | number;
  colorClass?: string;
  bgClass?: string;
}

export const StatCard: FC<Props> = ({ icon, label, value, colorClass = 'text-brand-600', bgClass = 'bg-brand-100' }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all duration-200">
    <div className={`p-4 rounded-xl ${bgClass} ${colorClass} flex items-center justify-center`}>
      {icon}
    </div>
    <div>
      <div className="text-2xl font-display font-bold text-slate-900">{value}</div>
      <div className="text-xs font-body text-slate-500 mt-1">{label}</div>
    </div>
  </div>
);
