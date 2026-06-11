import React from 'react';

interface LoadingSpinnerProps {
  id?: string;
  message?: string;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  id,
  message = 'Loading dashboard metrics...',
  fullPage = false,
}) => {
  const containerClass = fullPage
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-xs'
    : 'flex min-h-[16rem] w-full flex-col items-center justify-center py-12';

  return (
    <div id={id} className={containerClass}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600"></div>
        {message && <p className="text-sm font-medium text-slate-500 animate-pulse">{message}</p>}
      </div>
    </div>
  );
};
