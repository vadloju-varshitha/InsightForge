'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import DashboardLayout from '../../components/DashboardLayout';
import {
  Search,
  FileText,
  Download,
  Calendar,
  Layers,
  MapPin,
  Clock,
  ArrowUpDown,
  Filter,
  Loader2,
  Trash2,
  Bookmark,
} from 'lucide-react';
import Link from 'next/link';

export default function ReportsHistoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  // 1. Fetch Reports List
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['reports', searchTerm, categoryFilter, statusFilter, sortBy],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/reports', {
        params: {
          search: searchTerm || undefined,
          business_type: categoryFilter || undefined,
          status: statusFilter || undefined,
          sort: sortBy || undefined,
        },
      });
      return res.data;
    },
    refetchInterval: false,
  });

  // 2. Fetch Saved Locations
  const { data: savedLocations = [], isLoading: savedLoading } = useQuery({
    queryKey: ['savedLocations'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/reports/saved');
      return res.data;
    },
  });

  // 3. Remove Saved Location Mutation
  const deleteSavedLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`http://localhost:5000/api/reports/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations'] });
    },
  });

  return (
    <DashboardLayout>
      
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
            Research Reports & Libraries
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Browse through your saved libraries, generated reports, and white-label documents.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 text-sm transition-all"
        >
          Generate New Report
        </Link>
      </div>

      {/* Filter and Search toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search reports by location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
            />
          </div>

          {/* Business Vertical Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Filter size={16} />
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none appearance-none transition-all"
            >
              <option value="">All Business Types</option>
              <option value="Grocery">Grocery / Supermarket</option>
              <option value="Pharmacy">Pharmacy & Healthcare</option>
              <option value="Fashion">Fashion & Apparel</option>
              <option value="Electronics">Electronics Store</option>
              <option value="Restaurants">Restaurant / cafe</option>
              <option value="Healthcare">Diagnostic / clinic</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Clock size={16} />
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none appearance-none transition-all"
            >
              <option value="">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Processing">Processing</option>
              <option value="Requested">Requested</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <ArrowUpDown size={16} />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none appearance-none transition-all"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="location_asc">Name: A to Z</option>
              <option value="location_desc">Name: Z to A</option>
            </select>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Reports History List (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            Generated Reports ({reports.length})
          </h3>

          {reportsLoading ? (
            <div className="h-64 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center p-8">
              <FileText size={32} className="text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No reports found matching criteria</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Try loosening filters or request a new report.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report: any) => (
                <div
                  key={report.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        report.status === 'Ready'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 animate-pulse'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {report.business_type} Store
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-950 dark:text-slate-50 text-base">{report.location_name}</h4>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers size={12} />
                        Size: {report.store_size.toLocaleString()} sq ft
                      </span>
                      {report.footfall_estimate && (
                        <span className="text-emerald-600">
                          Est. Footfall: {report.footfall_estimate.toLocaleString()}/mo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:self-center">
                    <Link
                      href={report.status === 'Ready' ? `/reports/${report.id}` : '#'}
                      className={`px-4 py-2 border rounded-xl font-bold text-xs transition-colors ${
                        report.status === 'Ready'
                          ? 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : 'border-slate-200 text-slate-300 pointer-events-none'
                      }`}
                    >
                      View Intelligence
                    </Link>
                    
                    {report.pdf_url && (
                      <a
                        href={report.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="p-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/10 text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download size={14} />
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Saved Locations Library (Right 1 column) */}
        <div className="space-y-4">
          
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Bookmark size={18} className="text-blue-600" />
            Saved Locations Library
          </h3>

          {savedLoading ? (
            <div className="h-40 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          ) : savedLocations.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs font-semibold text-slate-400">
              No locations saved to library. Click &quot;Save Location&quot; inside any active report detail dashboard to save it here.
            </div>
          ) : (
            <div className="space-y-3">
              {savedLocations.map((loc: any) => (
                <div
                  key={loc.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between items-center"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{loc.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <button
                      onClick={() => deleteSavedLocationMutation.mutate(loc.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </DashboardLayout>
  );
}
