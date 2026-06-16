import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { AgentUnlockStatus } from '../types';
import { formatLKR, formatDate } from '../utils/format';

interface AgentUnlockBannerProps {
  id?: string;
  status: AgentUnlockStatus | null | undefined;
}

export const AgentUnlockBanner: React.FC<AgentUnlockBannerProps> = ({ id, status }) => {
  if (!status) {
    return (
      <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
        <div className="h-4 w-1/3 rounded-sm bg-slate-200"></div>
        <div className="mt-2 h-2 rounded-sm bg-slate-200"></div>
      </div>
    );
  }

  const { isUnlocked, currentDeposits, target, remaining, unlockDate } = status;
  const percentage = Math.min(100, Math.max(0, (currentDeposits / target) * 100));

  if (!isUnlocked) {
    return (
      <div
        id={id}
        className="mb-6 rounded-xl border border-amber-200 bg-[#FFFDF5] p-5 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
              Team Commissions Locked
            </h4>
            <p className="mt-2 text-xs text-amber-700 leading-relaxed font-medium">
              Deposit <span className="font-bold underline">{formatLKR(remaining)}</span> more this month of your own funds to unlock agent benefits. Currently accumulated Own Deposits: <span className="font-bold text-amber-950">{formatLKR(currentDeposits)}</span>.
            </p>
            
            {/* Progress bar container */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                <span>Progress: {percentage.toFixed(0)}%</span>
                <span>{formatLKR(currentDeposits)} / {formatLKR(target)}</span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-amber-100">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            
            <p className="mt-3 text-[10px] text-amber-500 font-bold uppercase tracking-wider">
              *Once unlocked, you instantly earn active commissions from your entire sub-agent recruitment downline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className="mb-6 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#166534]">
          <Unlock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-[#166534] uppercase tracking-wide">
            Team Commissions Active
          </h4>
          <p className="mt-2 text-xs text-[#166534] leading-relaxed">
            Congratulations! You have satisfied the required {formatLKR(target)} own-activity limit for this month.{' '}
            <span className="font-bold">All sub-agent downline commission earnings are unlocked and active!</span>
          </p>
          {unlockDate && (
            <p className="mt-2.5 text-[10px] text-emerald-750 font-mono font-bold uppercase">
              Unlocked on: {formatDate(unlockDate, true)}
            </p>
          )}

          {/* Fully charged Progress bar */}
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-[#BBF7D0]">
              <div className="h-2 rounded-full bg-[#10B981]" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
