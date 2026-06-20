'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from './Providers';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  GitCompare,
  CreditCard,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  TrendingUp,
  MapPin,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/reports', label: 'Report Library', icon: FileText },
    { href: '/reports/new', label: 'Generate Report', icon: PlusCircle },
    { href: '/compare', label: 'Compare Locations', icon: GitCompare },
    { href: '/credits', label: 'Buy Credits', icon: CreditCard },
  ];

  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="w-64 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md flex flex-col justify-between p-4 flex-shrink-0 transition-colors duration-200">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/25">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight font-display text-slate-900 dark:text-slate-50">
              InsightForge
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
              Location Intelligence
            </p>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="mx-1 mb-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{user.name}</p>
                <p className="text-[10px] font-medium text-slate-500 truncate">{user.companyName || 'Retail Client'}</p>
              </div>
            </div>

            {/* Credit count */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Credit Balance</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <CreditCard size={12} />
                {user.credits >= 0 ? user.credits : 'Suspended'}
              </span>
            </div>
          </div>
        )}

        {/* Links Navigation */}
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}

          {/* Admin link */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 mt-6 ${
                pathname.startsWith('/admin')
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <ShieldCheck size={18} />
              Admin Control Suite
            </Link>
          )}
        </nav>
      </div>

      {/* Footer controls */}
      <div className="space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <span className="flex items-center gap-3">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase font-bold text-slate-500">
            {theme}
          </span>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          Logout Session
        </button>
      </div>
    </aside>
  );
}
