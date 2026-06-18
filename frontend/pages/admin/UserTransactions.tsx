import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { Badge } from '../../components/Badge';
import { Toast, ToastType } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { formatLKR, formatDate } from '../../utils/format';
import { API_ENDPOINTS } from '../../utils/constants';
import api from '../../api/axios';
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

interface TransactionCommission {
  id: string;
  beneficiary: { full_name: string; role: string };
  percentage: number;
  amount: number;
  commission_type: string;
  commission_status: string;
}

interface TxDetail {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  player_id?: string;
  bank_slip_url?: string;
  withdrawal_details?: { withdrawal_code: string; bank: string; branch: string; account_number: string };
  transaction_status: 'pending' | 'approved' | 'rejected';
  transaction_date: string;
  created_at: string;
  commissions: TransactionCommission[];
}

interface UserInfo {
  id: string;
  fullName: string;
  role: string;
  joinedAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
  if (status === 'rejected') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">Rejected</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
}

export default function UserTransactions() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<TxDetail[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  const [expandedComm, setExpandedComm] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => { setToastMsg(msg); setToastType(type); };

  // Reject dialog state
  const [rejectTxId, setRejectTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTransactions = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(API_ENDPOINTS.admin.userTransactions(userId), {
        params: { page, limit: PAGE_SIZE },
      });
      if (res.data?.success) {
        setUserInfo(res.data.data.user);
        setTransactions(res.data.data.transactions || []);
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, [userId, page]);

  const toggleComm = (id: string) => {
    setExpandedComm((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleApprove = async (txId: string) => {
    setActionLoading(true);
    try {
      const res = await api.patch(API_ENDPOINTS.admin.approveTransaction(txId));
      if (res.data?.success) {
        showToast('Transaction approved. Commissions have been activated.', 'success');
        setTransactions((prev) => prev.map((t) => t.id === txId
          ? { ...t, transaction_status: 'approved', commissions: t.commissions.map((c) => ({ ...c, commission_status: 'approved' })) }
          : t
        ));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to approve.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTxId) return;
    setActionLoading(true);
    try {
      const res = await api.patch(API_ENDPOINTS.admin.rejectTransaction(rejectTxId), { reason: rejectReason });
      if (res.data?.success) {
        showToast('Transaction rejected.', 'info');
        setTransactions((prev) => prev.map((t) => t.id === rejectTxId
          ? { ...t, transaction_status: 'rejected', commissions: t.commissions.map((c) => ({ ...c, commission_status: 'rejected' })) }
          : t
        ));
        setRejectTxId(null);
        setRejectReason('');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reject.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      {userInfo && (
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{userInfo.fullName}'s Transactions</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge type={userInfo.role as any} />
              <span className="text-xs text-slate-500 font-mono">Joined {formatDate(userInfo.joinedAt)}</span>
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400 text-sm">No transactions found.</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={tx.transaction_status} />
                    <Badge type={tx.type} />
                    <span className="text-xl font-bold text-slate-900 font-mono">{formatLKR(tx.amount)}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono shrink-0">{formatDate(tx.transaction_date, true)}</span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {tx.type === 'deposit' ? (
                    <>
                      {tx.player_id && <div><span className="text-slate-400">Player ID: </span><span className="font-semibold text-slate-800">{tx.player_id}</span></div>}
                      {tx.bank_slip_url && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 block mb-1">Bank Slip:</span>
                          <img
                            src={tx.bank_slip_url}
                            alt="Bank slip"
                            style={{ width: '100px', height: '100px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '6px' }}
                            onClick={() => window.open(tx.bank_slip_url, '_blank')}
                            title="Click to open full size"
                          />
                        </div>
                      )}
                    </>
                  ) : tx.withdrawal_details ? (
                    <>
                      <div><span className="text-slate-400">Withdrawal Code: </span><span className="font-semibold text-slate-800">{tx.withdrawal_details.withdrawal_code}</span></div>
                      <div><span className="text-slate-400">Bank: </span><span className="font-semibold text-slate-800">{tx.withdrawal_details.bank}</span></div>
                      <div><span className="text-slate-400">Branch: </span><span className="font-semibold text-slate-800">{tx.withdrawal_details.branch}</span></div>
                      <div><span className="text-slate-400">Account: </span><span className="font-semibold text-slate-800">{tx.withdrawal_details.account_number}</span></div>
                    </>
                  ) : null}
                </div>

                {/* Commissions collapsible */}
                {tx.commissions.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleComm(tx.id)}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
                    >
                      {expandedComm.has(tx.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Commissions ({tx.commissions.length})
                    </button>

                    {expandedComm.has(tx.id) && (
                      <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400">
                              <th className="py-2 px-3">Earner</th>
                              <th className="py-2 px-3">Role</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">%</th>
                              <th className="py-2 px-3">Amount</th>
                              <th className="py-2 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tx.commissions.map((c) => (
                              <tr key={c.id}>
                                <td className="py-2 px-3 font-semibold text-slate-800">{c.beneficiary.full_name}</td>
                                <td className="py-2 px-3"><Badge type={c.beneficiary.role as any} /></td>
                                <td className="py-2 px-3 font-mono text-slate-500">{c.commission_type.replace(/_/g, ' ')}</td>
                                <td className="py-2 px-3 font-mono">{(c.percentage * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-900">{formatLKR(c.amount)}</td>
                                <td className="py-2 px-3"><StatusBadge status={c.commission_status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons — only for pending */}
                {tx.transaction_status === 'pending' && user?.role === 'admin' && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                    <button
                      onClick={() => handleApprove(tx.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve Transaction
                    </button>
                    <button
                      onClick={() => { setRejectTxId(tx.id); setRejectReason(''); }}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject Transaction
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination currentPage={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* Reject confirmation modal */}
      <Modal isOpen={!!rejectTxId} onClose={() => setRejectTxId(null)} title="Reject Transaction">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Optionally provide a reason for rejecting this transaction.</p>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Reason (optional)</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Bank slip does not match amount…"
              className="block w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-red-400"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setRejectTxId(null)} className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-slate-50">Cancel</button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
