import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Trash2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'deleted';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getStyles = () => {
    switch (toast.type) {
      case 'deleted':
        return {
          border: 'border-rose-200',
          bg: 'bg-rose-950 text-white',
          iconBg: 'bg-rose-500/20 text-rose-300',
          icon: <Trash2 className="w-4 h-4" />,
        };
      case 'error':
        return {
          border: 'border-red-200',
          bg: 'bg-slate-900 text-white',
          iconBg: 'bg-red-500/20 text-red-400',
          icon: <AlertCircle className="w-4 h-4" />,
        };
      case 'info':
        return {
          border: 'border-blue-200',
          bg: 'bg-slate-900 text-white',
          iconBg: 'bg-blue-500/20 text-blue-400',
          icon: <Info className="w-4 h-4" />,
        };
      case 'success':
      default:
        return {
          border: 'border-emerald-200',
          bg: 'bg-slate-900 text-white',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
    }
  };

  const style = getStyles();

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border ${style.border} ${style.bg} transition-all transform animate-in slide-in-from-bottom-2 duration-200`}
    >
      <div className={`p-1.5 rounded-lg ${style.iconBg} shrink-0 mt-0.5`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="text-[11px] text-slate-300 mt-0.5 leading-normal">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white p-1 rounded-md transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
