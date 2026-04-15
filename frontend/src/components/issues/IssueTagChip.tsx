import type { FC } from 'react';

interface Props {
  tag: string;
}

export const IssueTagChip: FC<Props> = ({ tag }) => (
  <span className="inline-block px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium font-body mr-1 mb-1 border border-brand-200 transition-all duration-200">
    {tag}
  </span>
);
