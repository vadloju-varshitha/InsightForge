'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter, usePathname } from 'next/navigation';
const API_URL = "https://insightforge-2.onrender.com";
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
  companyRole: 'OWNER' | 'MANAGER' | 'ANALYST';
  companyId: number | null;
  companyName: string | null;
  credits: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    companyName?: string,
    industry?: string,
    joinCompanyId?: number,
    companyRole?: 'OWNER' | 'MANAGER' | 'ANALYST'
  ) => Promise<void>;
  logout: () => void;
  updateUserCredits: (credits: number) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Configure Axios Defaults
  useEffect(() => {
    const savedToken = localStorage.getItem('insightforge_token');
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      
      // Fetch user profile
      axios
        .get(`${API_URL}/api/auth/me`)
        .then((res) => {
          setUser(res.data.user);
        })
        .catch((err) => {
          console.warn('Session expired or invalid token:', err);
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Route guards protection
  useEffect(() => {
    if (isLoading) return;

    const publicRoutes = ['/login', '/signup', '/'];
    const isPublic = publicRoutes.includes(pathname);

    if (!user && !isPublic) {
      router.push('/login');
    } else if (user && isPublic && pathname !== '/') {
      router.push('/dashboard');
    }
  }, [user, pathname, isLoading]);

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      
      localStorage.setItem('insightforge_token', receivedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      
      setToken(receivedToken);
      setUser(receivedUser);
      
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed.');
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    companyName?: string,
    industry?: string,
    joinCompanyId?: number,
    companyRole?: 'OWNER' | 'MANAGER' | 'ANALYST'
  ) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/signup`, {
        name,
        email,
        password,
        companyName,
        industry,
        joinCompanyId,
        companyRole,
      });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('insightforge_token', receivedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;

      setToken(receivedToken);
      setUser(receivedUser);

      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Signup failed.');
    }
  };

  const logout = () => {
    localStorage.removeItem('insightforge_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const updateUserCredits = (credits: number) => {
    if (user) {
      setUser({ ...user, credits });
    }
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`);
      setUser(res.data.user);
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateUserCredits,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
