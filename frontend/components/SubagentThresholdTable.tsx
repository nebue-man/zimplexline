import React from 'react';
import { SubagentThreshold } from '../types';
import { formatLKR, formatPercent } from '../utils/format';
import { Badge } from './Badge';

interface SubagentThresholdTableProps {
  id?: string;
  thresholds: SubagentThreshold[];
  isLocked: boolean;
}

export const SubagentThresholdTable: React.FC<SubagentThresholdTableProps> = ({
  id,
  thresholds,
  isLocked,
}) => {
  return (
    <div id={id} className={`rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm ${isLocked ? 'opacity-50 select-none' : ''}`}>
      <div className="mb-6 flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#0F172A]">Sub-agent Performance & Thresholds</h3>
          <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">Track which sub-agents have achieved the 20,000 LKR threshold to trigger your 3.0% commission tier.</p>
        </div>
        {isLocked && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-[#FFFBEB] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#92400E] border border-[#FDE047] sm:mt-0">
            Locked (Unlock Own Activity First)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-auto border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              <th className="py-3 px-4">Sub-agent Name</th>
              <th className="py-3 px-4">Monthly Deposits</th>
              <th className="py-3 px-4">Progress toward 20,000 LKR</th>
              <th className="py-3 px-4">Commission Rate</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {thresholds.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No sub-agents in your team yet. Use the invite link to recruit sub-agents!
                </td>
              </tr>
            ) : (
              thresholds.map((sub, index) => {
                const percentage = Math.min(100, Math.max(0, sub.progress));
                const rateText = sub.rate < 1 ? formatPercent(sub.rate) : `${sub.rate}%`;
                return (
                  <tr key={index} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-4 px-4 font-medium text-slate-900">{sub.name}</td>
                    <td className="py-4 px-4 font-mono text-slate-800 font-medium">
                      {formatLKR(sub.monthlyDeposits)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              sub.status === 'high' ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono font-bold text-slate-950">{rateText}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {sub.status === 'high' ? (
                        <Badge type="approved">High Rate (3%)</Badge>
                      ) : (
                        <Badge type="pending">Standard Rate (2.5%)</Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
