import React from 'react';

type BadgeType = 'admin' | 'manager' | 'agent' | 'subagent' | 'direct_agent' | 'approved' | 'pending' | 'rejected' | 'deposit' | 'withdrawal';

interface BadgeProps {
  id?: string;
  type: BadgeType | string;
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ id, type, className = '', children }) => {
  const normalizedType = type.toLowerCase();

  let styles = 'inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-transparent';

  switch (normalizedType) {
    case 'admin':
      styles += ' bg-[#EFF6FF] text-[#1D4ED8]';
      break;
    case 'manager':
      styles += ' bg-[#F0FDF4] text-[#166534]';
      break;
    case 'agent':
      styles += ' bg-[#FFFBEB] text-[#92400E]';
      break;
    case 'subagent':
      styles += ' bg-[#FFF1F2] text-[#9F1239]';
      break;
    case 'direct_agent':
      styles += ' bg-[#F3E8FF] text-[#6B21A8]';
      break;
    case 'approved':
      styles += ' bg-[#F0FDF4] text-[#166534]';
      break;
    case 'pending':
      styles += ' bg-[#FFFBEB] text-[#92400E]';
      break;
    case 'rejected':
      styles += ' bg-[#FFF1F2] text-[#9F1239]';
      break;
    case 'deposit':
      styles += ' bg-[#EFF6FF] text-[#1D4ED8]';
      break;
    case 'withdrawal':
      styles += ' bg-[#FFF1F2] text-[#9F1239]';
      break;
    default:
      styles += ' bg-[#F1F5F9] text-[#64748B]';
  }

  return (
    <span id={id} className={`${styles} ${className}`}>
      {children || normalizedType}
    </span>
  );
};
