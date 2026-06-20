'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import DashboardLayout from '../../components/DashboardLayout';
import {
  GitCompare,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);

  // 1. Fetch Reports List for Selection (Only ready reports)
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['readyReports'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/reports');
      return res.data.filter((r: any) => r.status === 'Ready');
    },
  });

  // 2. Comparison Mutation
  const compareMutation = useMutation({
    mutationFn: async (reportIds: number[]) => {
      const res = await axios.post('http://localhost:5000/api/reports/compare', { reportIds });
      return res.data;
    },
    onSuccess: (data) => {
      setComparisonResult(data);
    },
  });

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      if (selectedIds.length >= 3) {
        alert('You can compare a maximum of 3 locations at once.');
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCompare = () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 locations to compare.');
      return;
    }
    setComparisonResult(null);
    compareMutation.mutate(selectedIds);
  };

  // Format Recharts data
  // Radar data requires normalized metric nodes: Population, Income Score, Competitors, Footfall
  const radarChartData = comparisonResult
    ? [
        {
          subject: 'Population',
          [comparisonResult.reports[0].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[0].population / 500000) * 100),
          [comparisonResult.reports[1].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[1].population / 500000) * 100),
        },
        {
          subject: 'Density',
          [comparisonResult.reports[0].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[0].density / 15000) * 100),
          [comparisonResult.reports[1].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[1].density / 15000) * 100),
        },
        {
          subject: 'Footfall',
          [comparisonResult.reports[0].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[0].footfall / 150000) * 100),
          [comparisonResult.reports[1].name.split(',')[0]]: Math.min(100, (comparisonResult.reports[1].footfall / 150000) * 100),
        },
        {
          subject: 'Competitors',
          // More competitors is lower radar score (inverse penalty)
          [comparisonResult.reports[0].name.split(',')[0]]: Math.max(10, 100 - comparisonResult.reports[0].competitors * 6),
          [comparisonResult.reports[1].name.split(',')[0]]: Math.max(10, 100 - comparisonResult.reports[1].competitors * 6),
        },
      ]
    : [];

  const barChartData = comparisonResult
    ? comparisonResult.reports.map((r: any) => ({
        name: r.name.split(',')[0],
        'Modeled Footfall': r.footfall,
        Population: r.population / 5, // scaled for chart alignment
      }))
    : [];

  return (
    <DashboardLayout>
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
          Location Comparison Engine
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Perform site comparisons (A vs B scenario modeling) to determine optimal expansion venues.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Selection Sidebar Panel (Left 1 column) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5 h-fit">
          <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <GitCompare size={16} className="text-blue-600" />
            Select Reports to Compare
          </h3>

          {reportsLoading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-xs text-slate-400 font-semibold text-center py-6">
              No ready reports available. Generate reports first.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {reports.map((r: any) => {
                const isSelected = selectedIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleSelect(r.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/50'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {isSelected && <CheckCircle size={10} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{r.location_name}</p>
                      <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{r.business_type} store</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trigger button */}
          <button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || compareMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-500/10 text-xs transition-colors disabled:opacity-50"
          >
            {compareMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Crunching comparisons...
              </>
            ) : (
              <>
                Compare Selected ({selectedIds.length})
              </>
            )}
          </button>
        </div>

        {/* Results Panel (Right 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {!comparisonResult && !compareMutation.isPending && (
            <div className="h-96 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center p-8">
              <GitCompare size={36} className="text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Comparison Engine Idle</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Select at least 2 locations on the left sidebar to execute modeling.</p>
            </div>
          )}

          {compareMutation.isPending && (
            <div className="h-96 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center p-8">
              <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Comparing site demographics...</p>
              <p className="text-[10px] text-slate-400 font-semibold animate-pulse mt-1">Benchmarking densities, competitor mapping, and footfall ratios.</p>
            </div>
          )}

          {comparisonResult && (
            <>
              {/* Radar & Bar charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Radar chart - normalized metrics */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wide mb-4">Location Benchmark comparison</h4>
                  <div className="h-60 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={10} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#cbd5e1" />
                        <Radar name={comparisonResult.reports[0].name.split(',')[0]} dataKey={comparisonResult.reports[0].name.split(',')[0]} stroke="#1E3A8A" fill="#1E3A8A" fillOpacity={0.25} />
                        <Radar name={comparisonResult.reports[1].name.split(',')[0]} dataKey={comparisonResult.reports[1].name.split(',')[0]} stroke="#10B981" fill="#10B981" fillOpacity={0.25} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar chart - Raw metrics */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wide mb-4">Estimated footfall comparison</h4>
                  <div className="h-60 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData}>
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                        <Bar dataKey="Modeled Footfall" fill="#1E3A8A" radius={[3, 3, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Side by side stats details table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-sm text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  Granular Metric breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 font-bold text-slate-500">
                        <th className="py-2.5">Metric</th>
                        <th className="py-2.5">{comparisonResult.reports[0].name}</th>
                        <th className="py-2.5">{comparisonResult.reports[1].name}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="py-2.5 text-slate-500">Population</td>
                        <td className="py-2.5">{comparisonResult.reports[0].population.toLocaleString()}</td>
                        <td className="py-2.5">{comparisonResult.reports[1].population.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-500">Population Density</td>
                        <td className="py-2.5">{comparisonResult.reports[0].density.toLocaleString()} / sq km</td>
                        <td className="py-2.5">{comparisonResult.reports[1].density.toLocaleString()} / sq km</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-500">Income Level</td>
                        <td className="py-2.5">{comparisonResult.reports[0].income}</td>
                        <td className="py-2.5">{comparisonResult.reports[1].income}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-500">Nearby Competitors</td>
                        <td className="py-2.5 text-red-500">{comparisonResult.reports[0].competitors} direct players</td>
                        <td className="py-2.5 text-red-500">{comparisonResult.reports[1].competitors} direct players</td>
                      </tr>
                      <tr className="font-extrabold text-slate-900 dark:text-slate-50">
                        <td className="py-3 text-slate-500">Estimated Footfall</td>
                        <td className="py-3 text-blue-600 dark:text-blue-400">{comparisonResult.reports[0].footfall.toLocaleString()} / mo</td>
                        <td className="py-3 text-emerald-600 dark:text-emerald-400">{comparisonResult.reports[1].footfall.toLocaleString()} / mo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scenario modeling result (Pros, Cons, Recommendation) */}
              <div className="bg-gradient-to-br from-blue-50/50 to-emerald-50/30 dark:from-slate-900/50 dark:to-slate-900/30 border border-blue-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                
                <h3 className="font-extrabold text-base text-slate-950 dark:text-slate-50 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  AI Scenario Modeling comparison
                </h3>

                {/* Pros and cons comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Location A */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-blue-800 dark:text-blue-400 uppercase tracking-wider">{comparisonResult.reports[0].name.split(',')[0]} Analysis</h4>
                    
                    <div className="space-y-2">
                      {comparisonResult.modelResult.prosA.map((pro: string, i: number) => (
                        <div key={i} className="flex gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <ThumbsUp size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>{pro}</span>
                        </div>
                      ))}
                      {comparisonResult.modelResult.consA.map((con: string, i: number) => (
                        <div key={i} className="flex gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <ThumbsDown size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{con}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Location B */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">{comparisonResult.reports[1].name.split(',')[0]} Analysis</h4>

                    <div className="space-y-2">
                      {comparisonResult.modelResult.prosB.map((pro: string, i: number) => (
                        <div key={i} className="flex gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <ThumbsUp size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>{pro}</span>
                        </div>
                      ))}
                      {comparisonResult.modelResult.consB.map((con: string, i: number) => (
                        <div key={i} className="flex gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <ThumbsDown size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{con}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Final recommendation statement */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Strategic Recommendation</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5 leading-relaxed bg-white/70 dark:bg-slate-950/40 p-4 border border-blue-100/60 dark:border-slate-800/80 rounded-xl">
                    {comparisonResult.modelResult.recommendation}
                  </p>
                </div>

              </div>
            </>
          )}

        </div>

      </div>

    </DashboardLayout>
  );
}
