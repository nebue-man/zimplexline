import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Copy, Check, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';
import { InviteLink, GeneratedInvite } from '../types';
import { formatDate } from '../utils/format';

interface InviteSectionProps {
  userRole: string;
  agentLocked?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  agent: 'Agent',
  subagent: 'Sub-agent',
  direct_agent: 'Direct Agent',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  used: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
  inactive: 'bg-rose-50 text-rose-600 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  used: 'Used',
  expired: 'Expired',
  inactive: 'Deactivated',
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

const PAGE_SIZE = 10;

export function InviteSection({ userRole, agentLocked }: InviteSectionProps) {
  const intendedRole = ROLE_LABELS[
    userRole === 'admin' ? 'manager' : userRole === 'manager' ? 'agent' : 'subagent'
  ] || 'Sub-agent';

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedInvite | null>(null);
  const [generateError, setGenerateError] = useState('');
  const [copied, setCopied] = useState(false);
  const [capacity, setCapacity] = useState<{ current: number; max: number } | null>(null);

  // Invite history state
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [page, setPage] = useState(1);

  // Deactivate state
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [confirmToken, setConfirmToken] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await api.get(API_ENDPOINTS.invite.myInvites);
      if (res.data?.success) {
        const list: InviteLink[] = res.data.data?.invites || [];
        setInvites(list);
        // Derive capacity from active + used non-expired invites isn't reliable;
        // use the first generated response or fetch separately
      }
    } catch (err: any) {
      setHistoryError('Failed to load invite history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    setGenerated(null);
    try {
      const res = await api.post(API_ENDPOINTS.invite.generate);
      if (res.data?.success) {
        const data: GeneratedInvite = res.data.data;
        setGenerated(data);
        setCapacity(data.capacity);
        fetchInvites();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to generate invite link.';
      setGenerateError(msg);
      if (err.response?.data?.data) {
        setCapacity(err.response.data.data);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generated) return;
    copyToClipboard(generated.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeactivate = async (token: string) => {
    setDeactivating(token);
    try {
      await api.patch(API_ENDPOINTS.invite.deactivate(token));
      setConfirmToken(null);
      fetchInvites();
    } catch {
      // silently handled — list will refresh
    } finally {
      setDeactivating(null);
    }
  };

  const atCapacity = capacity !== null && capacity.current >= capacity.max;
  const totalPages = Math.ceil(invites.length / PAGE_SIZE);
  const pagedInvites = invites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">

      {/* ─── Generate Section ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Invite a new {intendedRole}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Generate a one-time invite link to grow your team.</p>
          </div>
          {capacity && (
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">{capacity.current} / {capacity.max} slots used</p>
              <div className="mt-1 h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atCapacity ? 'bg-rose-400' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((capacity.current / capacity.max) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {agentLocked && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              You can invite sub-agents at any time, but you will only earn commissions from their activity once your monthly deposits reach LKR 10,000.
            </p>
          </div>
        )}

        {generateError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">{generateError}</p>
          </div>
        )}

        {generated && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-800">Invite link generated!</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700">
                {generated.invite_url}
              </code>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition border ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Expires in 7 days · Share this link with the person you want to invite. The link can only be used once.
            </p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || atCapacity}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {generating ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
          ) : atCapacity ? (
            <><Users className="h-4 w-4" /> Capacity Full</>
          ) : (
            <><Link2 className="h-4 w-4" /> Generate invite link</>
          )}
        </button>
      </div>

      {/* ─── Invite History ─── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">My invite links</h3>
        </div>

        {historyLoading ? (
          <div className="p-8 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent border-t-blue-500 mx-auto" />
            <p className="mt-2 text-xs text-slate-400">Loading invite history...</p>
          </div>
        ) : historyError ? (
          <div className="p-8 text-center text-xs text-rose-500">{historyError}</div>
        ) : invites.length === 0 ? (
          <div className="p-10 text-center">
            <Link2 className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No invite links yet</p>
            <p className="mt-1 text-xs text-slate-400">Generate your first link above to start building your team.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-5">Created</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Used by</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedInvites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-500">{formatDate(inv.created_at)}</td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-semibold text-slate-700">{ROLE_LABELS[inv.intended_role] || inv.intended_role}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {inv.used_by_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {inv.status === 'active' && (
                          confirmToken === inv.token ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">Confirm?</span>
                              <button
                                onClick={() => handleDeactivate(inv.token)}
                                disabled={deactivating === inv.token}
                                className="text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-50"
                              >
                                {deactivating === inv.token ? 'Deactivating...' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmToken(null)}
                                className="text-[10px] font-bold text-slate-500 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmToken(inv.token)}
                              className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 hover:underline transition"
                            >
                              Deactivate
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>{invites.length} total</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Prev
                  </button>
                  <span>{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
