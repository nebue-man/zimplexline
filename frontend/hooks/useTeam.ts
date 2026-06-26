import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { TeamMember } from '../types';

export function useTeam() {
  const { user } = useAuth();
  const [data, setData] = useState<TeamMember[]>([]);
  const [capacity, setCapacity] = useState<{ current: number; max: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch team members
      const teamRes = await api.get(API_ENDPOINTS.dashboard.team);
      if (teamRes.data?.success) {
        setData(teamRes.data.data || []);
      }

      // 2. Fetch recruitment capacity limits
      try {
        const capacityRes = await api.get(API_ENDPOINTS.hierarchy.capacity(user.id));
        if (capacityRes.data?.success) {
          setCapacity(capacityRes.data.data);
        }
      } catch (capErr) {
        // Fallback calculations based on user role and constants
        const maxCapacity = user.role === 'manager' ? 5 : (user.role === 'agent' || user.role === 'direct_agent') ? 10 : 0;
        setCapacity({
          current: teamRes.data?.data?.length || 0,
          max: maxCapacity,
        });
      }
    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError(err.response?.data?.message || 'Failed to load your team list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTeam();
    }
  }, [user, fetchTeam]);

  // Generates inviting registration link for downline
  const generateInviteLink = useCallback((): string => {
    if (!user) return '';
    const origin = window.location.origin;
    return `${origin}/register?parent_id=${user.id}`;
  }, [user]);

  return {
    data,
    capacity,
    loading,
    error,
    refresh: fetchTeam,
    generateInviteLink,
  };
}
