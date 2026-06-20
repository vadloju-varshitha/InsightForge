'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm font-bold text-slate-500 animate-pulse tracking-wide uppercase font-display">
            Forging Insights...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // AuthContext redirect handles router push to /login
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}
