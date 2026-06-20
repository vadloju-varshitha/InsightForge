'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon issues in Next.js
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src || markerIcon,
  iconRetinaUrl: markerIcon2x.src || markerIcon2x,
  shadowUrl: markerShadow.src || markerShadow,
});

interface Competitor {
  id: any;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distance?: number;
  address?: string;
}

interface LocationMapProps {
  mode: 'edit' | 'view';
  latitude: number;
  longitude: number;
  onChange?: (lat: number, lng: number) => void;
  competitors?: Competitor[];
  competitorFilter?: string;
  locationName?: string;
}

// Component to dynamically update map center and pan view
function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LocationMap({
  mode,
  latitude,
  longitude,
  onChange,
  competitors = [],
  competitorFilter = '',
  locationName = 'Selected Site',
}: LocationMapProps) {
  const centerPosition: [number, number] = useMemo(() => [latitude, longitude], [latitude, longitude]);
  const markerRef = useRef<L.Marker>(null);

  // Custom marker icon colors using Leaflet DivIcon
  const targetIcon = useMemo(() => {
    return new L.DivIcon({
      html: `<div class="w-8 h-8 rounded-full bg-blue-900 border-2 border-white flex items-center justify-center shadow-lg"><div class="w-3 h-3 rounded-full bg-white"></div></div>`,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }, []);

  const getCompetitorIcon = (category: string) => {
    let bg = 'bg-blue-500';
    if (category === 'Grocery') bg = 'bg-green-600';
    if (category === 'Pharmacy') bg = 'bg-red-500';
    if (category === 'Fashion') bg = 'bg-purple-500';
    if (category === 'Electronics') bg = 'bg-amber-500';
    if (category === 'Restaurants') bg = 'bg-orange-500';

    return new L.DivIcon({
      html: `<div class="w-6 h-6 rounded-full ${bg} border border-white flex items-center justify-center shadow-md text-white text-[9px] font-bold">${category.charAt(0)}</div>`,
      className: 'custom-competitor-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (marker != null && onChange) {
      const latLng = marker.getLatLng();
      onChange(latLng.lat, latLng.lng);
    }
  };

  // Filter competitors for view mode
  const filteredCompetitors = useMemo(() => {
    if (mode !== 'view') return [];
    return competitors.filter((c) =>
      competitorFilter === '' ? true : c.category.toLowerCase() === competitorFilter.toLowerCase()
    );
  }, [mode, competitors, competitorFilter]);

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative z-0">
      <MapContainer
        center={centerPosition}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Dynamic map center update observer */}
        <ChangeMapView center={centerPosition} />

        {/* Primary Target Location Marker */}
        <Marker
          position={centerPosition}
          icon={targetIcon}
          draggable={mode === 'edit'}
          eventHandlers={{
            dragend: handleDragEnd,
          }}
          ref={markerRef}
        >
          <Popup>
            <div className="text-xs font-semibold">
              <p className="font-bold text-slate-800">{locationName}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Competitor Markers (View Mode only) */}
        {mode === 'view' &&
          filteredCompetitors.map((comp) => (
            <Marker
              key={comp.id}
              position={[comp.latitude, comp.longitude]}
              icon={getCompetitorIcon(comp.category)}
            >
              <Popup>
                <div className="text-xs font-semibold space-y-1">
                  <p className="font-bold text-slate-900">{comp.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Category: {comp.category}</p>
                  <p className="text-[10px] text-slate-700">{comp.address || 'Address not available'}</p>
                  {comp.distance !== undefined && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      Distance: {comp.distance} km
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}