'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import axios from 'axios';

// Configure Axios global interceptor to dynamically rewrite localhost:5000 in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('http://localhost:5000')) {
    config.url = config.url.replace('http://localhost:5000', API_URL);
  }
  return config;
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Initialize theme from localStorage or system preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('insightforge_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('insightforge_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // Attach theme and toggle method to global window helper or export context
  useEffect(() => {
    (window as any).__toggleTheme = toggleTheme;
    (window as any).__theme = theme;
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme((window as any).__theme || 'light');
    
    // Simple custom observer or timeout poll
    const interval = setInterval(() => {
      if ((window as any).__theme && (window as any).__theme !== theme) {
        setTheme((window as any).__theme);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [theme]);

  const toggle = () => {
    if ((window as any).__toggleTheme) {
      (window as any).__toggleTheme();
    }
  };

  return { theme, toggleTheme: toggle, isDark: theme === 'dark' };
}
