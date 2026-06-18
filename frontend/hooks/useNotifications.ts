import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { Notification } from '../types';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(API_ENDPOINTS.notifications.unreadCount);
      if (res.data?.success) setUnreadCount(res.data.data.count);
    } catch (err) {
      // silent
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.notifications.list, { params: { limit: 10 } });
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount((res.data.data || []).filter((n: Notification) => !n.is_read).length);
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      intervalRef.current = setInterval(fetchUnreadCount, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchUnreadCount]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(API_ENDPOINTS.notifications.markRead(id));
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(API_ENDPOINTS.notifications.markAllRead);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      // silent
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: fetchNotifications };
}
