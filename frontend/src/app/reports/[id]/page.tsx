'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import dynamic from 'next/dynamic';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  FileText,
  Download,
  MapPin,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  Coins,
  ChevronLeft,
  Loader2,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://insightforge-2.onrender.com';
// Dynamically import LocationMap with SSR disabled to prevent hydration errors
const LocationMap = dynamic(() => import('../../../components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [activeCategory, setActiveCategory] = useState('');
  const [maxDistance, setMaxDistance] = useState(5.0);
  const [sortBy, setSortBy] = useState('distance');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isSaved, setIsSaved] = useState(false);

  // 1. Fetch Report Details
  const { data: report, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const res = await axios.get(`https://insightforge-2.onrender.com/api/reports/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
   useEffect(() => {
    if (report?.business_type) {
      setActiveCategory(report.business_type);
    }
  }, [report]);

  // Extract locality and city names
  let city = 'Hyderabad';
  let locality = 'Jubilee Hills';
  if (report?.location_name) {
    const parts = report.location_name.split(',').map((s: string) => s.trim());
    if (parts.length >= 2) {
      locality = parts[0];
      city = parts[1];
    } else if (parts.length === 1) {
      locality = parts[0];
    }
  }

  // 2. Fetch Demographics Details
  const { data: demographic, isLoading: demoLoading } = useQuery({
    queryKey: ['demographic', city, locality],
    queryFn: async () => {
      const res = await axios.get('https://insightforge-2.onrender.com/api/demographics/details', {
        params: { city, locality },
      });
      return res.data;
    },
    enabled: !!report,
  });

  // 3. Fetch Nearby Competitors
  const { data: competitors = [], isLoading: competitorsLoading } = useQuery({
    queryKey: ['competitors', report?.latitude, report?.longitude, activeCategory],
    queryFn: async () => {
      const res = await axios.get('https://insightforge-2.onrender.com/api/competitors/nearby', {
        params: {
          lat: report.latitude,
          lng: report.longitude,
          radius: 10, // Fetch up to 10km to allow client-side filtering up to 10km
          category: activeCategory,
        },
      });
      return res.data;
    },
    enabled: !!report && !!activeCategory,
  });
  console.log(report);
  console.log(activeCategory);

  // Check if location is already saved in library
  const { data: savedLocations = [] } = useQuery({
    queryKey: ['savedLocations'],
    queryFn: async () => {
      const res = await axios.post('https://insightforge-2.onrender.com/api/reports/saved');
      return res.data;
    },
  });

  useEffect(() => {
    if (report && savedLocations.length > 0) {
      const found = savedLocations.some(
        (loc: any) =>
          Math.abs(loc.latitude - report.latitude) < 0.0001 &&
          Math.abs(loc.longitude - report.longitude) < 0.0001
      );
      setIsSaved(found);
    }
  }, [report, savedLocations]);

  // 4. Save Location Mutation
  const saveLocationMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        // Find saved item ID and unsave
        const savedItem = savedLocations.find(
          (loc: any) =>
            Math.abs(loc.latitude - report.latitude) < 0.0001 &&
            Math.abs(loc.longitude - report.longitude) < 0.0001
        );
        if (savedItem) {
          await axios.delete(`https://insightforge-2.onrender.com/api/reports/saved/${savedItem.id}`);;
          setIsSaved(false);
        }
      } else {
          await axios.post('https://insightforge-2.onrender.com/api/reports/saved', {
          name: report.location_name,
          latitude: report.latitude,
          longitude: report.longitude,
        });
        setIsSaved(true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations'] });
    },
  });

  // Removed Mapbox script rendering effects

  if (reportLoading) {
    return (
      <DashboardLayout>
        <div className="h-96 w-full flex flex-col items-center justify-center">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">Loading intelligence report...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (reportError || !report) {
    return (
      <DashboardLayout>
        <div className="p-6 border border-red-200 rounded-2xl bg-red-50 text-red-700 text-sm font-semibold flex items-center gap-2">
          Failed to load report. Report might not exist or access was denied.
        </div>
      </DashboardLayout>
    );
  }

  // Demographics chart formatting
  const ageChartData = demographic ? [
    { name: '18-25', percentage: demographic.age_18_25 },
    { name: '26-40', percentage: demographic.age_26_40 },
    { name: '41-60', percentage: demographic.age_41_60 },
    { name: '60+', percentage: demographic.age_60_plus },
  ] : [];

  const genderPieData = demographic ? [
    { name: 'Male', value: demographic.male_percentage },
    { name: 'Female', value: demographic.female_percentage },
  ] : [];

  // Client-side filtering and sorting of competitors
  const processedCompetitors = React.useMemo(() => {
    return competitors
      .filter((c: any) => c.distance <= maxDistance)
      .sort((a: any, b: any) => {
        const valA = a.distance || 0;
        const valB = b.distance || 0;

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [competitors, maxDistance, sortOrder]);

  const densityScore = React.useMemo(() => {
    return report?.live_metrics?.competitorDensityScore ?? Math.min(100, competitors.length * 10);
  }, [report, competitors]);

  const downloadCSV = () => {
    const headers = [
      'Business Name',
      'Category',
      'Address',
      'Distance (km)',
      'Latitude',
      'Longitude',
      'OSM Maps Link'
    ];

    const rows = processedCompetitors.map((c: any) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.distance,
      c.latitude,
      c.longitude,
      `"${c.mapUrl || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((e: any) => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `competitors_${report.location_name.split(',')[0].replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom branding adjustments
  const brandColor = (report?.brand_settings as any)?.primaryColor || '#1E3A8A';

  return (
    <DashboardLayout>
      
      {/* Navigation & Toolbar Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/reports')}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full">
                {report.business_type} Store Report
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                <Calendar size={10} />
                {new Date(report.created_at).toLocaleDateString()}
              </span>
              {report.live_metrics?.refreshTimestamp && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Live Intelligence (Refreshed: {new Date(report.live_metrics.refreshTimestamp).toLocaleTimeString()})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 font-display tracking-tight mt-1.5">
              {report.location_name}
            </h1>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          
          {/* Save / Bookmark location */}
          <button
            onClick={() => saveLocationMutation.mutate()}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl font-bold text-xs transition-colors ${
              isSaved
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck size={14} />
                Saved Location
              </>
            ) : (
              <>
                <Bookmark size={14} />
                Save Location
              </>
            )}
          </button>

          {/* Download PDF */}
          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 text-xs transition-colors"
            >
              <Download size={14} />
              Export Branded PDF
            </a>
          )}

        </div>
      </div>

      {/* Main Grid Content */}
      <div className="space-y-6">
        
        {/* Executive summary block */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 flex items-center gap-2">
            <TrendingUp size={16} style={{ color: brandColor }} />
            Executive Viability Summary
          </h3>
          <p className="text-base font-medium text-slate-800 dark:text-slate-200 leading-relaxed border-l-4 pl-4 py-1" style={{ borderColor: brandColor }}>
            &ldquo;{report.executive_summary || 'Analyzing site demographics and market saturation... Summary will load shortly.'}&rdquo;
          </p>
        </div>

        {/* Demographic Module */}
        {demographic && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Demographics numbers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Local Demographic Profile
              </h3>
              
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Target Locality</span>
                  <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{demographic.locality}, {demographic.city}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Local Population</span>
                  <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{demographic.population.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Population Density</span>
                  <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{demographic.density.toLocaleString()} / sq km</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Average Income Level</span>
                  <span className="inline-flex mt-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                    {demographic.income_level} Income
                  </span>
                </div>
              </div>
            </div>

            {/* Demographics Gender Pie chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Gender Distribution
              </h3>
              <div className="h-40 w-full flex items-center justify-center mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill={brandColor} />
                      <Cell fill="#3B82F6" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brandColor }} />
                  Male: {demographic.male_percentage}%
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Female: {demographic.female_percentage}%
                </div>
              </div>
            </div>

            {/* Demographics Age Bar chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Age Distribution Bracket
              </h3>
              <div className="h-44 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="percentage" fill={brandColor} radius={[3, 3, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* Competitor mapping & list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Interactive OSM Map (Left 2 columns) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col h-[520px]">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 flex items-center gap-2">
                <MapPin size={18} className="text-blue-600" />
                Nearby Competitors Mapping
              </h3>

              {/* Competitor Category Filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                  <Filter size={12} />
                </span>
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="pl-8 pr-4 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-xs outline-none focus:border-blue-600 appearance-none transition-all"
                >
                  <option value="Grocery">Grocery</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Restaurants">Restaurants</option>
                  <option value="Healthcare">Healthcare</option>
                </select>
              </div>
            </div>

            {/* Map container */}
            <div className="flex-1 w-full rounded-xl overflow-hidden min-h-[300px] relative z-0">
              <LocationMap
                mode="view"
                latitude={report.latitude}
                longitude={report.longitude}
                competitors={processedCompetitors}
                competitorFilter=""
                locationName={report.location_name}
              />
            </div>
          </div>

          {/* Competitor List detail (Right 1 column) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[520px]">
            <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
              Competitor Directory ({processedCompetitors.length})
            </h3>
            
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 mt-2 pr-1">
              {competitorsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600" />
                </div>
              ) : processedCompetitors.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                  No competitors found in range.
                </div>
              ) : (
                processedCompetitors.map((c: any) => (
                  <div key={c.id} className="py-3 flex justify-between items-start">
                    <div className="overflow-hidden pr-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                        {c.category}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">{c.distance ? `${c.distance} km` : 'Near'}</span>
                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Competitor Density Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Density score card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Competitor Density Score
              </h3>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Density Rating</span>
                  <p className="text-3xl font-black text-slate-800 dark:text-slate-200 mt-1">
                    {densityScore}%
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                    densityScore > 70 ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/30' :
                    densityScore > 35 ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/30' :
                    'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/30'
                  }`}>
                    {densityScore > 70 ? 'Saturated' : densityScore > 35 ? 'Moderate' : 'Low Density'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 font-semibold leading-relaxed">
              {densityScore > 70 ? 'High concentration of direct competitors. Market penetration requires heavy advertising and strong differentiation.' :
               densityScore > 35 ? 'Healthy competition present. The market is active with room for localized capture and niche placement.' :
               'Low competitor density. Excellent first-mover advantages with minimal localized barrier to consumer acquisition.'}
            </div>
          </div>

          {/* Competitor Summary card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Competitor Summary
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Total Nearby</span>
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
                    {competitors.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Avg Distance</span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {competitors.length > 0
                      ? (competitors.reduce((acc: number, c: any) => acc + (c.distance || 0), 0) / competitors.length).toFixed(2)
                      : '0.00'} km
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 font-semibold">
              Based on OpenStreetMap/Overpass dataset.
            </div>
          </div>

          {/* Nearest Competitor card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Closest Competitor
              </h3>
              {processedCompetitors.length > 0 ? (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{processedCompetitors[0].name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{processedCompetitors[0].address}</p>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2">
                    <span>Distance: {processedCompetitors[0].distance} km</span>
                    <span className="text-slate-400 font-mono">
                      {processedCompetitors[0].latitude.toFixed(4)}, {processedCompetitors[0].longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-400 font-medium py-3 text-center">
                  No competitors loaded.
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 font-semibold flex justify-between items-center">
              <span>Proximity Index:</span>
              <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                {processedCompetitors.length > 0 && processedCompetitors[0].distance < 1.0 ? 'High Threat' : 'Safe Proximity'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Competitor Directory Table Module */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-950 dark:text-slate-50">
                Detailed Competitor Directory
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Real-time competitor analysis retrieved from OpenStreetMap & Overpass API.
              </p>
            </div>
            
            {/* Download CSV button */}
            <button
              onClick={downloadCSV}
              type="button"
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Download size={14} />
              Export to CSV
            </button>
          </div>

          {/* Interactive Filters and Sorting controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800">
            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Business Category
              </label>
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-blue-600 transition-all"
              >
                <option value="Grocery">Grocery</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Fashion">Fashion</option>
                <option value="Electronics">Electronics</option>
                <option value="Restaurants">Restaurants</option>
                <option value="Healthcare">Healthcare</option>
              </select>
            </div>

            {/* Distance slider filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex justify-between">
                <span>Filter Distance</span>
                <span className="text-blue-600 dark:text-blue-400">{maxDistance} km</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Sort field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Sort Competitors By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-blue-600 transition-all"
              >
                <option value="distance">Distance</option>
              </select>
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Sort Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-blue-600 transition-all"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Table view */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
            <table className="w-full border-collapse text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Business Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {competitorsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="animate-spin text-blue-600" size={16} />
                        <span>Fetching nearby competitors...</span>
                      </div>
                    </td>
                  </tr>
                ) : processedCompetitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-medium text-slate-400">
                      No competitors found with the selected filters.
                    </td>
                  </tr>
                ) : (
                  processedCompetitors.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-200">{c.name}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                          {c.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[250px] truncate" title={c.address}>{c.address}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-300">{c.distance} km</td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400">
                        {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <a
                          href={c.mapUrl || `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}&zoom=17`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg font-bold text-[10px] transition-colors"
                        >
                          View on OpenStreetMap
                          <ArrowUpRight size={10} />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footfall Estimation & Sentiment widget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Estimated Footfall Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
                Footfall Viability Score
              </h3>
              <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Expected Monthly Traffic</span>
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  ~ {report.footfall_estimate ? report.footfall_estimate.toLocaleString() : 'Processing...'}
                </p>
                <span className="inline-block text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded mt-2.5 border border-emerald-100 dark:border-emerald-900/30">
                  Live Location Intelligence
                </span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-slate-500 flex justify-between items-center">
              <span>Benchmark Rating:</span>
              <span className="text-blue-600 dark:text-blue-400">{report.industry_avg || 'Average'}</span>
            </div>
          </div>

          {/* Estimation confidence Level Gauge */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
              Estimation Confidence Level
            </h3>
            
            <div className="flex-1 flex flex-col items-center justify-center mt-2">
              {/* SVG Vector Gauge */}
              <svg viewBox="0 0 100 60" className="w-32 h-20">
                <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                <circle cx="50" cy="55" r="3" fill="#1E3A8A" />
                <text x="50" y="45" fontSize="10" fill="#1e293b" textAnchor="middle" fontWeight="bold">
                  {report.confidence_score || 85}%
                </text>
              </svg>
              <p className="text-[10px] text-slate-500 font-semibold text-center mt-1">Based on real-time traffic flow, synergy and competitor density metrics.</p>
            </div>
          </div>

          {/* Sentiment analysis Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
              Consumer Review Sentiment
            </h3>
            
            <div className="space-y-4 my-auto py-2">
              <div className="flex gap-1.5 h-4 rounded overflow-hidden">
                <div style={{ flex: report.sentiment_pos || 75 }} className="bg-emerald-500" title="Positive" />
                <div style={{ flex: report.sentiment_neu || 15 }} className="bg-slate-300 dark:bg-slate-700" title="Neutral" />
                <div style={{ flex: report.sentiment_neg || 10 }} className="bg-red-500" title="Negative" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <div>
                  <span className="block text-xs font-extrabold text-emerald-600">{report.sentiment_pos || 75}%</span>
                  Positive
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">{report.sentiment_neu || 15}%</span>
                  Neutral
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-red-500">{report.sentiment_neg || 10}%</span>
                  Negative
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Live Mobility & Environmental Intelligence Section */}
        {report.live_metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Live Traffic Congestion Level */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Live Traffic Congestion
                </h3>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Congestion Index</span>
                    <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200">{report.live_metrics.traffic?.congestionIndex}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${report.live_metrics.traffic?.congestionIndex}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Flow: <span className="font-bold text-slate-700 dark:text-slate-300">{report.live_metrics.traffic?.flowCondition}</span> (Speed Ratio: {report.live_metrics.traffic?.speedRatio})
                  </div>
                </div>
              </div>
            </div>

            {/* Accessibility connectivity */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Transit Accessibility
                </h3>
                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Nearest City Hub</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">{report.live_metrics.accessibility?.hubName}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span>Driving Distance:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{report.live_metrics.accessibility?.distanceKm} km</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Driving Time:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{report.live_metrics.accessibility?.durationMin} mins</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded text-center border border-emerald-100 dark:border-emerald-900/20">
                Connectivity Score: {report.live_metrics.accessibility?.connectivityScore} / 100
              </div>
            </div>

            {/* Live Weather Conditions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Local Weather Context
                </h3>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Current Temperature</span>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-200">{report.live_metrics.weather?.temp}°C</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
                      {report.live_metrics.weather?.condition}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-slate-500 flex justify-between items-center">
                <span>Outdoor Mobility Impact:</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold">{report.live_metrics.weather?.impactFactor}x factor</span>
              </div>
            </div>

          </div>
        )}

      </div>

    </DashboardLayout>
  );
}
