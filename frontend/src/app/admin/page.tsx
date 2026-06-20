'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import {
  ShieldAlert,
  Users,
  FileSpreadsheet,
  Coins,
  History,
  Info,
  Loader2,
  Lock,
  Unlock,
  Plus,
  TrendingUp,
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
} from 'recharts';

const COLORS = ['#1E3A8A', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function AdminSuitePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'credits' | 'audit' | 'notifications' | 'analytics'>('analytics');

  // Credit adjustment states
  const [targetUserId, setTargetUserId] = useState<number | ''>('');
  const [creditAmount, setCreditAmount] = useState<number>(5);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // 1. Fetch Users
  const { data: usersList = [], isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/admin/users');
      return res.data;
    },
    enabled: user?.role === 'ADMIN',
  });

  // 2. Fetch Audit Logs
  const { data: auditLogs = [], isLoading: auditsLoading } = useQuery({
    queryKey: ['adminAudits'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/admin/audit-logs');
      return res.data;
    },
    enabled: user?.role === 'ADMIN',
  });

  // 3. Fetch Notification Logs
  const { data: notificationLogs = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['adminNotifications'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/admin/notification-logs');
      return res.data;
    },
    enabled: user?.role === 'ADMIN',
  });

  // 4. Fetch Analytics
  const { data: analytics = null, isLoading: analyticsLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/admin/analytics');
      return res.data;
    },
    enabled: user?.role === 'ADMIN',
  });

  // 5. Suspend User Mutation
  const suspendUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.post(`http://localhost:5000/api/admin/users/${id}/suspend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });

  // 6. Adjust Credits Mutation
  const adjustCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!targetUserId) return;
      await axios.post('http://localhost:5000/api/admin/credits/adjust', {
        userId: Number(targetUserId),
        amount: creditAmount,
        reason: adjustReason,
      });
    },
    onSuccess: () => {
      setAdjustSuccess('Credits adjusted successfully!');
      setCreditAmount(5);
      setAdjustReason('');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminAnalytics'] });
    },
  });

  if (user?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <ShieldAlert size={36} className="text-red-500 mb-3" />
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-slate-50">Access Restriction</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Only designated administrators possess permissions to enter the Admin Suite workspace.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
          Admin Control Suite
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Perform administrative adjustments, oversee system audits, monitor notifications, and read global performance metrics.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-bold text-slate-500 dark:text-slate-400">
        {[
          { id: 'analytics', label: 'Global Analytics', icon: TrendingUp },
          { id: 'users', label: 'User Directory', icon: Users },
          { id: 'credits', label: 'Credit Control', icon: Coins },
          { id: 'audit', label: 'Audit Records', icon: FileSpreadsheet },
          { id: 'notifications', label: 'Notification Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3.5 border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold'
                  : 'border-transparent hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        
        {/* Analytics view */}
        {activeTab === 'analytics' && (
          <>
            {analyticsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
              </div>
            ) : analytics && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Registered Clients</span>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mt-1">{analytics.metrics.totalUsers}</h3>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Reports Generated</span>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mt-1">{analytics.metrics.totalReports}</h3>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Credits Purchased</span>
                    <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">+{analytics.metrics.totalPurchased}</h3>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Credits Consumed</span>
                    <h3 className="text-2xl font-extrabold text-red-500 mt-1">-{analytics.metrics.totalUsed}</h3>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-sm text-slate-950 dark:text-slate-50 mb-6">Global Reports Volume Trend</h4>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.reportsPerMonth}>
                          <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="reports" fill="#3B82F6" radius={[3, 3, 0, 0]} barSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-sm text-slate-950 dark:text-slate-50 mb-6">Top Researched Localities</h4>
                    <div className="h-56 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.popularLocations}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="count"
                            nameKey="location"
                          >
                            {analytics.popularLocations.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
                      {analytics.popularLocations.map((entry: any, index: number) => (
                        <div key={entry.location} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          {entry.location} ({entry.count})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Users directory view */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            {usersLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Company</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Credit Balance</th>
                      <th className="py-2.5">Created Date</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-700 dark:text-slate-300">
                    {usersList.map((client: any) => {
                      const isSuspended = client.credits < 0;
                      return (
                        <tr key={client.id}>
                          <td className="py-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{client.name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{client.email}</p>
                          </td>
                          <td className="py-3">{client.company?.name || 'Self-serve Client'}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                              {client.companyRole}
                            </span>
                          </td>
                          <td className="py-3 font-bold text-blue-600 dark:text-blue-400">
                            {isSuspended ? 'Suspended (-1)' : `${client.credits} credits`}
                          </td>
                          <td className="py-3">{new Date(client.created_at).toLocaleDateString()}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => suspendUserMutation.mutate(client.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1.5 ml-auto transition-colors ${
                                isSuspended
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                  : 'bg-red-50 hover:bg-red-100 text-red-500'
                              }`}
                            >
                              {isSuspended ? (
                                <>
                                  <Unlock size={12} />
                                  Unsuspend
                                </>
                              ) : (
                                <>
                                  <Lock size={12} />
                                  Suspend User
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Credit Control view */}
        {activeTab === 'credits' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <Coins size={16} className="text-blue-600" />
                Manual Credit Adjustments
              </h3>

              {adjustSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg">
                  {adjustSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Target Client</label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                  >
                    <option value="">Select User...</option>
                    {usersList.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Adjustment Amount</label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Positive adds credits; negative subtracts / refunds credits.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Reason / Rationale</label>
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Customer goodwill refund, pricing tier upgrade"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                  />
                </div>

                <button
                  onClick={() => adjustCreditsMutation.mutate()}
                  disabled={!targetUserId || !adjustReason || adjustCreditsMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-500/10 text-xs transition-colors"
                >
                  Adjust User Balance
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                Credit Balances Overview
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Company</th>
                      <th className="py-2.5">Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-700 dark:text-slate-300">
                    {usersList.map((client: any) => (
                      <tr key={client.id}>
                        <td className="py-2.5">{client.name}</td>
                        <td className="py-2.5">{client.company?.name || 'Self-serve Client'}</td>
                        <td className={`py-2.5 font-bold ${client.credits < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                          {client.credits < 0 ? 'Suspended' : `${client.credits} credits`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs view */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            {auditsLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5">Timestamp</th>
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Action</th>
                      <th className="py-2.5">Target Scope</th>
                      <th className="py-2.5">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-slate-600 dark:text-slate-400">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="py-3 text-[10px] font-sans font-semibold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-3 font-sans font-bold text-slate-800 dark:text-slate-200">{log.user?.name || 'System / Guest'}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 font-sans text-slate-700 dark:text-slate-300 font-medium">{log.target}</td>
                        <td className="py-3 text-[10px] font-semibold text-slate-400">{log.ip_address || 'Internal'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Notification Logs view */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            {notificationsLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5">Timestamp</th>
                      <th className="py-2.5">Recipient User</th>
                      <th className="py-2.5">Channel</th>
                      <th className="py-2.5">Notification Message</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-600 dark:text-slate-400">
                    {notificationLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="py-3 text-[10px] font-semibold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{log.user?.name} ({log.user?.email})</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                            {log.channel}
                          </span>
                        </td>
                        <td className="py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{log.message}</td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            log.status === 'SENT'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-500'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

    </DashboardLayout>
  );
}
