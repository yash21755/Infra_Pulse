import React from 'react';
import { useToast } from '../../hooks/useToast';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle className="text-emerald-500" size={20} />,
          error: <AlertCircle className="text-rose-500" size={20} />,
          info: <Info className="text-blue-500" size={20} />
        };

        const bgColors = {
          success: 'bg-emerald-50 border-emerald-200',
          error: 'bg-rose-50 border-rose-200',
          info: 'bg-blue-50 border-blue-200'
        };

        return (
          <div 
            key={toast.id} 
            className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border ${bgColors[toast.type]} animate-fade-in min-w-[300px]`}
          >
            {icons[toast.type]}
            <p className="text-slate-800 text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};