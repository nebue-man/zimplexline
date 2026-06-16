import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getToken, setToken, clearToken, decodeToken } from '../utils/auth';
import axiosInstance from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export type { AuthContextType };
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (currentToken: string) => {
    try {
      const response = await axiosInstance.get(API_ENDPOINTS.auth.me, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      if (response.data?.success && response.data?.data) {
        setUser(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch user profile:', err);
      // If unauthorized, logout
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = getToken();
      if (savedToken) {
        await fetchProfile(savedToken);
      } else {
        setLoading(false);
      }
    };
    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (newToken: string) => {
    setLoading(true);
    setToken(newToken);
    setTokenState(newToken);
    await fetchProfile(newToken);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setLoading(false);
  };

  const refreshUser = async () => {
    const activeToken = getToken();
    if (activeToken) {
      try {
        const response = await axiosInstance.get(API_ENDPOINTS.auth.me);
        if (response.data?.success && response.data?.data) {
          setUser(response.data.data);
        }
      } catch (err) {
        console.error('Failed to refresh user profile:', err);
      }
    }
  };

  const role = user ? user.role : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

