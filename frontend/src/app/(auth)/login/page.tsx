'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { TrendingUp, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20 p-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20 mb-3 animate-bounce">
            <TrendingUp size={28} />
          </div>
          <h1 className="font-extrabold text-2xl font-display text-slate-900 dark:text-slate-50 tracking-tight">
            InsightForge
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">
            Log in to access location intelligence dashboard
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-xl shadow-slate-100/50 dark:shadow-none p-8">
          
          {error && (
            <div className="mb-6 flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/30 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Corporate Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 dark:focus:ring-blue-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Account Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 dark:focus:ring-blue-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 text-sm transition-all duration-200 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Authenticate Session
                  <ArrowRight size={16} />
                </>
              )}
            </button>

          </form>

          {/* Quick Login Info */}
          <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Demo Credentials: 
              <br/>
              <span className="font-bold text-slate-700 dark:text-slate-300">client@insightforge.com</span> / <span className="font-bold text-slate-700 dark:text-slate-300">admin123</span> (Client)
              <br/>
              <span className="font-bold text-slate-700 dark:text-slate-300">admin@insightforge.com</span> / <span className="font-bold text-slate-700 dark:text-slate-300">admin123</span> (Admin)
            </p>
          </div>

        </div>

        {/* Redirect Footer */}
        <p className="text-center text-xs font-semibold text-slate-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:text-blue-500 underline underline-offset-4">
            Create corporate account
          </Link>
        </p>

      </div>
    </div>
  );
}
