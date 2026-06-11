import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { VerificationItem } from '../types';

export function useVerifications() {
  const { user } = useAuth();
  const [data, setData] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(API_ENDPOINTS.dashboard.pendingVerifications);
      if (response.data?.success) {
        setData(response.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching verifications:', err);
      setError(err.response?.data?.message || 'Failed to fetch pending verification items.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVerifications();
    }
  }, [user, fetchVerifications]);

  const verifyUser = async (targetUserId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      const response = await api.patch(API_ENDPOINTS.auth.verify(targetUserId), {
        status,
        rejectReason: reason,
      });

      if (response.data?.success) {
        await fetchVerifications(); // Refresh the list
        return { success: true };
      }
      return { success: false, message: response.data?.message || 'Verification update failed' };
    } catch (err: any) {
      console.error('Error updating verification status:', err);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Error occurred while saving verification status'
      };
    }
  };

  return {
    data,
    loading,
    error,
    verifyUser,
    refresh: fetchVerifications,
  };
}
