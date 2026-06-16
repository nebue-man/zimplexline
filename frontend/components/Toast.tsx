import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  id?: string;
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = 'success',
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const config = {
    success: {
      bg: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-800',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    error: {
      bg: 'bg-rose-50 border-rose-100',
      text: 'text-rose-800',
      icon: XCircle,
      iconColor: 'text-rose-500',
    },
    info: {
      bg: 'bg-blue-50 border-blue-100',
      text: 'text-blue-800',
      icon: CheckCircle,
      iconColor: 'text-blue-500',
    },
  };

  const current = config[type] || config.info;
  const Icon = current.icon;

  return (
    <div
      id={id}
      className={`fixed right-4 top-4 z-[999] flex max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${current.bg}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${current.iconColor}`} />
      
      <div className="flex-1">
        <p className={`text-sm font-medium ${current.text}`}>{message}</p>
      </div>

      <button
        onClick={onClose}
        className={`rounded-lg p-1 transition-colors hover:bg-black/5 ${current.text}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
