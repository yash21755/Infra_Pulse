import type { FC, ReactNode } from 'react';
import { FileQuestion } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState: FC<Props> = ({
  title = 'Nothing here yet',
  description = 'There is no data to display.',
  icon = <FileQuestion size={40} className="text-slate-300" />,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
    <div className="mb-4">{icon}</div>
    <h2 className="text-xl font-display font-bold text-slate-900 mb-1">{title}</h2>
    <p className="text-slate-500 font-body mb-4 text-center">{description}</p>
    {action && <div>{action}</div>}
  </div>
);
