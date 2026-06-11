import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  tooltip?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  id,
  title,
  value,
  subtext,
  icon: Icon,
  iconColor = 'text-blue-500 bg-blue-50',
  className = '',
  tooltip,
}) => {
  return (
    <div
      id={id}
      title={tooltip}
      className={`relative rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:shadow-md ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#64748B] font-bold uppercase mb-1 tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums tracking-tight mt-1">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {subtext && (
        <div className="mt-3 flex items-center text-[10px] font-semibold text-[#64748B]">
          <span>{subtext}</span>
        </div>
      )}
    </div>
  );
};
