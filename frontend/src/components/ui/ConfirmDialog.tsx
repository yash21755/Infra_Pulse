import type { FC, ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  children?: ReactNode;
}

export const ConfirmDialog: FC<Props> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full border border-slate-200">
        <h3 className="text-lg font-display font-bold text-slate-900 mb-2">{title}</h3>
        {description && <p className="text-slate-600 font-body mb-4">{description}</p>}
        {children}
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="px-4 py-2 rounded-xl font-body text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`px-4 py-2 rounded-xl font-body text-white ${danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-brand-600 hover:bg-brand-700'} transition-all duration-200`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
