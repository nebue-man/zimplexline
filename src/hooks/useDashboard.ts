import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { DashboardSummary, AgentUnlockStatus, SubagentThreshold } from '../types';

export function useDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<AgentUnlockStatus | null>(null);
  const [subagentThresholds, setSubagentThresholds] = useState<SubagentThreshold[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);
    setError(null);

    try {
      // 1. Fetch main dashboard summary
      const summaryRes = await api.get(API_ENDPOINTS.dashboard.summary);
      let summaryData: DashboardSummary = {
        totalUsers: 0,
        managerCount: 0,
        agentCount: 0,
        subagentCount: 0,
        transactionVolumeThisMonth: 0,
        totalCommissionsPaidThisMonth: 0,
        pendingVerifications: 0,
      };

      if (summaryRes.data?.success) {
        summaryData = summaryRes.data.data;
      }

      // 2. Fetch Earnings history / trend
      try {
        const historyRes = await api.get(
          `${API_ENDPOINTS.dashboard.earningsHistory}?period=30d&group_by=day`
        );
        if (historyRes.data?.success) {
          summaryData.earningsTrend = historyRes.data.data.trend;
          summaryData.recentTransactions = historyRes.data.data.recentTransactions;
        }
      } catch (trendErr) {
        console.warn('Could not fetch earnings history, using defaults:', trendErr);
      }

      setData(summaryData);

      // 3. Role-specific additional metadata
      if (user.role === 'agent') {
        // Fetch Agent unlock metrics
        try {
          const unlockRes = await api.get(API_ENDPOINTS.dashboard.agentUnlockStatus);
          if (unlockRes.data?.success) {
            setUnlockStatus(unlockRes.data.data);
          }
        } catch (unlockErr) {
          console.warn('Could not fetch agent unlock status:', unlockErr);
        }

        // Fetch Sub-agent thresholds
        try {
          const thresholdsRes = await api.get(API_ENDPOINTS.dashboard.subagentThresholds);
          if (thresholdsRes.data?.success) {
            setSubagentThresholds(thresholdsRes.data.data);
          }
        } catch (thresholdsErr) {
          console.warn('Could not fetch subagent thresholds:', thresholdsErr);
        }
      }
    } catch (err: any) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard metrics. Please try again.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();

      // Configure auto-refresh every 60 seconds
      const interval = setInterval(() => {
        fetchData(true);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  return {
    data,
    unlockStatus,
    subagentThresholds,
    loading,
    error,
    refresh: () => fetchData(false),
  };
}
