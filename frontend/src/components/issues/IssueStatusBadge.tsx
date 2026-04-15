import type { FC } from 'react';
import type { IssueStatus } from '../../types';

interface Props {
  status: IssueStatus;
}

const statusMap: Record<IssueStatus, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: 'bg-slate-100', text: 'text-slate-700' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-100', text: 'text-amber-700' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export const IssueStatusBadge: FC<Props> = ({ status }) => {
  const { label, bg, text } = statusMap[status];
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${bg} ${text} font-body transition-all duration-200`}
    >
      {label}
    </span>
  );
};
