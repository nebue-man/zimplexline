import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { Commission } from '../types';

export interface CommissionFilters {
  page: number;
  limit: number;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function useCommissions() {
  const { user } = useAuth();
  const [data, setData] = useState<Commission[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<CommissionFilters>({
    page: 1,
    limit: 20,
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const fetchCommissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.type) params.type = filters.type;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.search) params.search = filters.search;

      // Select endpoint based on user role
      const endpoint = user.role === 'admin'
        ? API_ENDPOINTS.admin.commissions
        : API_ENDPOINTS.commissions.list;

      const response = await api.get(endpoint, { params });

      if (response.data?.success) {
        setData(response.data.data?.records || response.data.data || []);
        setTotalCount(response.data.data?.total || (response.data.data || []).length);
      }
    } catch (err: any) {
      console.error('Error fetching commissions:', err);
      setError(err.response?.data?.message || 'Failed to load commission records.');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchCommissions();
  }, [filters.page, filters.limit, filters.type, filters.dateFrom, filters.dateTo, fetchCommissions]);

  const updateFilters = (newFilters: Partial<CommissionFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }));
  };

  // Compute aggregate metrics of currently loaded commission rows
  const getSummaryMetrics = () => {
    const totals: { [key: string]: number } = {
      total: 0,
      ownActivity: 0,
      directAgent: 0,
      directSubagent: 0,
      deepTeam: 0,
      locked: 0,
    };

    data.forEach((comm) => {
      totals.total += comm.amount;
      if (comm.isLocked) {
        totals.locked += comm.amount;
      }
      
      if (comm.type === 'own_activity' || comm.type === 'own') {
        totals.ownActivity += comm.amount;
      } else if (comm.type === 'direct_agent' || comm.type === 'direct_agents') {
        totals.directAgent += comm.amount;
      } else if (comm.type === 'direct_subagent' || comm.type === 'direct_subagents') {
        totals.directSubagent += comm.amount;
      } else {
        totals.deepTeam += comm.amount;
      }
    });

    return totals;
  };

  return {
    data,
    totalCount,
    filters,
    loading,
    error,
    updateFilters,
    getSummaryMetrics,
    refresh: fetchCommissions,
  };
}
