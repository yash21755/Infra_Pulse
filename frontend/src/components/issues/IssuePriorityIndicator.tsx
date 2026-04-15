import type { FC } from 'react';
import type { IssuePriority } from '../../types';
import { AlertTriangle, ArrowUpCircle, Circle, CheckCircle2 } from 'lucide-react';

interface Props {
  priority: IssuePriority;
}

const priorityMap: Record<IssuePriority, { label: string; icon: React.ReactNode; color: string }> = {  critical: {
    label: 'Critical',
    icon: <AlertTriangle size={16} className="text-rose-500" />,
    color: 'bg-rose-100 text-rose-700',
  },
  high: {
    label: 'High',
    icon: <ArrowUpCircle size={16} className="text-amber-500" />,
    color: 'bg-amber-100 text-amber-700',
  },
  medium: {
    label: 'Medium',
    icon: <Circle size={16} className="text-brand-500" />,
    color: 'bg-brand-100 text-brand-700',
  },
  low: {
    label: 'Low',
    icon: <CheckCircle2 size={16} className="text-emerald-500" />,
    color: 'bg-emerald-100 text-emerald-700',
  },
};

export const IssuePriorityIndicator: FC<Props> = ({ priority }) => {
  const { label, icon, color } = priorityMap[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-body uppercase ${color} transition-all duration-200`}>
      {icon}
      {label}
    </span>
  );
};
