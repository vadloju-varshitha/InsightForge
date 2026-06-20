'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import {
  FileText,
  Clock,
  Coins,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import Link from 'next/link';

const COLORS = ['#1E3A8A', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function DashboardPage() {
  const { user } = useAuth();

  // 1. Fetch Reports History
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/reports');
      return res.data;
    },
  });

  // 2. Fetch Credit History
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/credits/history');
      return res.data;
    },
  });

  // 3. Check for Saved Location Alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['locationAlerts'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/reports/alerts/check');
      return res.data;
    },
    refetchInterval: 30000, // Poll alerts every 30 seconds
  });

  const totalReports = reports.length;
  const processingReports = reports.filter((r: any) => r.status === 'Processing' || r.status === 'Requested').length;
  const readyReports = reports.filter((r: any) => r.status === 'Ready').length;

  // Compile monthly reports stats for chart
  const reportsPerMonthMap: Record<string, number> = {};
  reports.forEach((r: any) => {
    const date = new Date(r.created_at);
    const month = date.toLocaleString('default', { month: 'short' });
    reportsPerMonthMap[month] = (reportsPerMonthMap[month] || 0) + 1;
  });

  const reportsChartData = Object.keys(reportsPerMonthMap).map((month) => ({
    name: month,
    reports: reportsPerMonthMap[month],
  }));

  // Compile credit usage for chart
  const creditUsageData = transactions
    .filter((tx: any) => tx.type === 'USAGE')
    .slice(0, 10)
    .reverse()
    .map((tx: any) => ({
      date: new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      amount: Math.abs(tx.amount),
    }));

  // Compile popular business categories
  const categoryMap: Record<string, number> = {};
  reports.forEach((r: any) => {
    categoryMap[r.business_type] = (categoryMap[r.business_type] || 0) + 1;
  });
  const categoryPieData = Object.keys(categoryMap).map((cat) => ({
    name: cat,
    value: categoryMap[cat],
  }));

  return (
    <DashboardLayout>
      
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
            Workspace Dashboard
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Analyze demographics, competitor locations and generate research reports.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 text-sm transition-all"
        >
          <MapPin size={16} />
          Analyze New Location
        </Link>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle size={18} />
            Location Density Alerts ({alerts.length})
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {alerts.map((alert: any, idx: number) => (
              <li key={idx}>
                <strong>{alert.locationName}</strong>: {alert.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Credits */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Available Credits</p>
              <h3 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                {user?.credits !== undefined && user.credits >= 0 ? user.credits : 'Suspended'}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Coins size={22} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>1 Credit = 1 Location Report</span>
            <Link href="/credits" className="text-blue-600 hover:text-blue-500 flex items-center gap-0.5">
              Refill
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Total Reports */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Reports</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 mt-2">{totalReports}</h3>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-xl">
              <FileText size={22} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>Ready PDF library: {readyReports}</span>
            <Link href="/reports" className="text-blue-600 hover:text-blue-500 flex items-center gap-0.5">
              View All
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Reports in Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">In Progress</p>
              <h3 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">{processingReports}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>ETA: ~5s per report</span>
            {processingReports > 0 && <span className="flex items-center gap-1 text-[10px] text-amber-600 animate-pulse font-extrabold uppercase">processing...</span>}
          </div>
        </div>

        {/* Company Shares */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Shared Library</p>
              <h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">Active</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>Multi-user sync: ON</span>
            <span className="text-slate-400 font-semibold">{user?.companyRole || 'OWNER'}</span>
          </div>
        </div>

      </div>

      {/* Main Charts & Dashboard Row */}
      {reportsLoading ? (
        <div className="h-96 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : totalReports === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-8 text-center">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full mb-4">
            <FileText size={36} />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50">No reports generated yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Begin analyzing demographic viability by requesting your first location intelligence report.
          </p>
          <Link
            href="/reports/new"
            className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 text-sm transition-all"
          >
            Create Report
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart - Reports Trend */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Volume and Report Trends
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportsChartData.length > 0 ? reportsChartData : [{ name: 'None', reports: 0 }]}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                  <Bar dataKey="reports" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Popular Categories Pie Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" />
              Popular Industry Types
            </h4>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Pie Legends */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
              {categoryPieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity lists */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 mb-6">
              Recent Report Queue
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {reports.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${r.status === 'Ready' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'}`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{r.location_name}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{r.business_type} Store Expansion</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      r.status === 'Ready' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 animate-pulse'
                    }`}>
                      {r.status}
                    </span>
                    <Link
                      href={r.status === 'Ready' ? `/reports/${r.id}` : '#'}
                      className={`text-xs font-bold ${r.status === 'Ready' ? 'text-blue-600 hover:text-blue-500' : 'text-slate-400 pointer-events-none'}`}
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Transactions Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 mb-6">
              Credit Usage
            </h4>
            <div className="h-60 w-full">
              {creditUsageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={creditUsageData}>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                  No credit usages logged yet
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </DashboardLayout>
  );
}
