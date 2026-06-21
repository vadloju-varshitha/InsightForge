'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  MapPin,
  ImageIcon,
  Check,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://insightforge-2.onrender.com';
// Dynamically import LocationMap with SSR disabled to prevent hydration errors
const LocationMap = dynamic(() => import('../../../components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px] bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

export default function NewReportPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form Fields
  const [businessType, setBusinessType] = useState('Grocery');
  const [storeSize, setStoreSize] = useState<number>(2500);
  const [investmentAmount, setInvestmentAmount] = useState<number>(50000);
  const [targetAudience, setTargetAudience] = useState('Family & Residential');
  const [customSections, setCustomSections] = useState<string[]>([
    'demographics',
    'competitors',
    'footfall',
    'charts',
    'recommendation',
  ]);

  // White label branding settings
  const [primaryColor, setPrimaryColor] = useState('#1E3A8A');
  const [logoUrl, setLogoUrl] = useState('');

  // Location Selector states (OpenStreetMap Nominatim)
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocality, setSelectedLocality] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [latitude, setLatitude] = useState<number>(17.3850); // Default Hyderabad center
  const [longitude, setLongitude] = useState<number>(78.4867); // Default Hyderabad center
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Statuses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sections list options
  const sectionOptions = [
    { id: 'demographics', label: 'Demographics Analysis', desc: 'Population, density, age and gender ratios' },
    { id: 'competitors', label: 'Competitor Analysis', desc: 'Nearby businesses categorized mapping and list' },
    { id: 'footfall', label: 'Footfall Model Estimate', desc: 'Predictive footfall estimation based on category' },
    { id: 'charts', label: 'Visual Dashboards', desc: 'Pie charts, bar charts and interactive grids' },
    { id: 'recommendation', label: 'AI Executive Recommendation', desc: 'Summarized site viability insights' },
  ];

  // Address Geocoding Search Autocomplete (OpenStreetMap Nominatim)
  const handleAddressSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressSearch(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=in&limit=5`;
      const res = await axios.get(`https://corsproxy.io/?${encodeURIComponent}`
      );
      setSearchResults(res.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('OSM Nominatim search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setAddressSearch(result.display_name);
    setLatitude(lat);
    setLongitude(lng);
    
    // Parse city and locality from display name
    const parts = result.display_name.split(',').map((s: string) => s.trim());
    if (parts.length >= 3) {
      setSelectedLocality(parts[0]);
      setSelectedCity(parts[2]);
    } else {
      setSelectedLocality(parts[0] || 'Selected Locality');
      setSelectedCity(parts[1] || 'Hyderabad');
    }
    
    setSearchResults([]);
    setShowDropdown(false);
  };

  // Reverse Geocoding Nominatim
  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await axios.get(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const data = res.data;
      if (data && data.display_name) {
        setAddressSearch(data.display_name);
        
        // Extract city and locality from address object
        const address = data.address || {};
        const localityName = address.suburb || address.neighbourhood || address.residential || address.city_district || address.village || 'Selected Locality';
        const cityName = address.city || address.town || address.state || 'Hyderabad';
        
        setSelectedLocality(localityName);
        setSelectedCity(cityName);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    }
  };

  const handleMapChange = (lat: number, lng: number) => {
    setLatitude(Number(lat.toFixed(6)));
    setLongitude(Number(lng.toFixed(6)));
    handleReverseGeocode(lat, lng);
  };

  const toggleSection = (id: string) => {
    if (customSections.includes(id)) {
      setCustomSections(customSections.filter((s) => s !== id));
    } else {
      setCustomSections([...customSections, id]);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (user && user.credits < 1) {
      setError('Insufficient credits. Please top up credit balance.');
      setIsSubmitting(false);
      return;
    }

    const locationName = selectedLocality && selectedCity 
      ? `${selectedLocality}, ${selectedCity}`
      : addressSearch || 'Jubilee Hills, Hyderabad';

    try {
      const res = await axios.post('${API_URL}/api/reports', {
        location_name: locationName,
        latitude,
        longitude,
        business_type: businessType,
        store_size: Number(storeSize),
        investment_amount: Number(investmentAmount),
        target_audience: targetAudience,
        custom_sections: customSections,
        brand_settings: {
          primaryColor,
          logoUrl: logoUrl || undefined,
        },
      });

      queryClient?.invalidateQueries({ queryKey: ['reports'] });
      await refreshUser();
      router.push('/reports');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit report request.');
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
          New Research Report
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Select a site on the OpenStreetMap map, choose variables, and generate location intelligence.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Forms and Maps split */}
      <form onSubmit={handleCreateReport} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column - Input Fields */}
        <div className="space-y-6">
          
          {/* Card 1: Core Business Inputs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              1. Business Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business category */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Business Vertical
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 outline-none appearance-none transition-all"
                >
                  <option value="Grocery">Grocery / Supermarket</option>
                  <option value="Pharmacy">Pharmacy & Healthcare</option>
                  <option value="Fashion">Fashion & Apparel</option>
                  <option value="Electronics">Electronics Store</option>
                  <option value="Restaurants">Restaurant / cafe</option>
                  <option value="Healthcare">Diagnostic / clinic</option>
                </select>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Target Audience
                </label>
                <input
                  type="text"
                  required
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Families, Students, Affluent"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Store size */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Planned Outlet Size (Sq Ft)
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  value={storeSize}
                  onChange={(e) => setStoreSize(Number(e.target.value))}
                  placeholder="2500"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>

              {/* Investment amount */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Investment Capital (INR/USD)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                  placeholder="50000"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>
            </div>

          </div>

          {/* Card 2: Report custom layout builder */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
              2. Custom Report Sections
            </h3>
            
            <div className="space-y-3">
              {sectionOptions.map((opt) => {
                const checked = customSections.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleSection(opt.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/50'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {checked && <Check size={10} strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{opt.label}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{opt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: White Label branding settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3">
              3. White Label Report Branding
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Brand Color Scheme
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-9 p-0 border-0 bg-transparent rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:border-blue-600 outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Branded Logo Link (HTTPS)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <ImageIcon size={14} />
                  </span>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://company.com/logo.png"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:border-blue-600 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 text-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing Calculations (costs 1 credit)...
              </>
            ) : (
              <>
                Generate Branded Report (Costs 1 Credit)
              </>
            )}
          </button>

        </div>

        {/* Right Column - Leaflet Location Selector */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col h-full min-h-[500px]">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" />
              4. Locate Target Site
            </h3>

            {/* Address Autocomplete search input */}
            <div className="relative z-[1000]">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                {isSearching ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Search size={16} />}
              </span>
              <input
                type="text"
                value={addressSearch}
                onChange={handleAddressSearchChange}
                placeholder="Search addresses (e.g. Jubilee Hills, Hyderabad)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-600 outline-none transition-all"
              />
              
              {/* Autocomplete Dropdown list */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-[1100] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                  {searchResults.map((result: any, index: number) => (
                    <div
                      key={index}
                      onClick={() => selectSearchResult(result)}
                      className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300"
                    >
                      {result.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leaflet component */}
            <div className="flex-1 w-full rounded-2xl overflow-hidden min-h-[350px] relative z-0">
              <LocationMap
                mode="edit"
                latitude={latitude}
                longitude={longitude}
                onChange={handleMapChange}
                locationName={selectedLocality ? `${selectedLocality}, ${selectedCity}` : 'Selected Site'}
              />
            </div>

            {/* Coordinate readout details */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs text-slate-500 font-bold">
              <div>
                <span>Latitude:</span>
                <span className="block font-mono text-slate-800 dark:text-slate-200 mt-0.5">{latitude}</span>
              </div>
              <div>
                <span>Longitude:</span>
                <span className="block font-mono text-slate-800 dark:text-slate-200 mt-0.5">{longitude}</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium text-center">
              💡 Hint: Search for Hyderabad, Bangalore, Chennai, Pune, or Mumbai localities, or click anywhere on the map to drop a pin.
            </p>
          </div>
        </div>

      </form>
    </DashboardLayout>
  );
}
