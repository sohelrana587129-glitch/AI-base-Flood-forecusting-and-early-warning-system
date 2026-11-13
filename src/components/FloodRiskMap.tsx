import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { getLocalFloodRiskMap } from '../services/localEngine';

interface SpatialFeature {
  type: string;
  properties: {
    name: string;
    elevation_meters: number;
    type: string;
    risk_level: 'Low' | 'Medium' | 'High' | 'Safe';
    water_depth?: number;
    description: string;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface SpatialMapResponse {
  type: 'FeatureCollection';
  features: SpatialFeature[];
  metadata: {
    stationName: string;
    region: string;
    center: [number, number];
    hoursAhead: string;
    baseLevelMeters: number;
    waterRiseMeters: number;
    totalWaterLevelMeters: number;
  };
}

export const FloodRiskMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  const [hoursAhead, setHoursAhead] = useState<string>('0');
  const [region, setRegion] = useState<string>('sylhet');
  const [spatialData, setSpatialData] = useState<SpatialMapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const getColor = (risk: string) => {
    if (risk === 'High') return '#ef4444';
    if (risk === 'Medium') return '#f59e0b';
    if (risk === 'Low') return '#10b981';
    return '#2563eb';
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([24.89, 91.87], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const renderMapData = (data: SpatialMapResponse) => {
      if (!active) return;
      setSpatialData(data);
      setLoading(false);

      const map = mapInstanceRef.current;
      if (!map) return;

      if (data.metadata?.center) {
        map.setView(data.metadata.center, 14);
      }

      if (geoJsonLayerRef.current) {
        map.removeLayer(geoJsonLayerRef.current);
      }

      geoJsonLayerRef.current = L.geoJSON(data as unknown as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          const risk = feature?.properties?.risk_level || 'Low';
          return {
            color: '#1e293b',
            weight: 1.5,
            fillColor: getColor(risk),
            fillOpacity: 0.65,
          };
        },
        pointToLayer: (_feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 10,
            fillColor: '#2563eb',
            color: '#ffffff',
            weight: 2.5,
            fillOpacity: 1,
          });
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          layer.bindPopup(`
            <div style="font-family: sans-serif; min-width: 210px;">
              <strong style="font-size: 14px; color: #0f172a;">${props.name}</strong><br/>
              <span style="font-size: 12px; color: #475569;">Type: ${props.type} · Ground Elev: ${props.elevation_meters}m</span><br/>
              <span style="font-size: 12px; font-weight: 700; color: ${getColor(props.risk_level)};">Risk Level: ${props.risk_level}</span><br/>
              <p style="font-size: 12px; color: #334155; margin-top: 4px;">${props.description}</p>
            </div>
          `);
        },
      }).addTo(map);
    };

    fetch(
      `/api/v1/flood-risk-map?hours_ahead=${encodeURIComponent(hoursAhead)}&region=${encodeURIComponent(region)}`
    )
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error('Static deployment fallback');
        }
        return res.json();
      })
      .then((data: SpatialMapResponse) => {
        renderMapData(data);
      })
      .catch(() => {
        const fallbackData = getLocalFloodRiskMap(hoursAhead, region) as unknown as SpatialMapResponse;
        renderMapData(fallbackData);
      });

    return () => {
      active = false;
    };
  }, [hoursAhead, region]);

  return (
    <div className="space-y-5">
      {/* Top Control Bar matching index_44b34260.html + expanded telemetry */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 dashboard-card flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Real-Time Satellite &amp; Topographic Flood Risk Mapping System
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Dynamic Multi-Criteria Evaluation comparing forecasted river gauge water elevation against urban land elevation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="region-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Urban Region:
            </label>
            <select
              id="region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="sylhet">Sylhet (Surma River Basin)</option>
              <option value="dhaka">Dhaka (Buriganga Basin)</option>
              <option value="sunamganj">Sunamganj (Haor Basin)</option>
              <option value="dinajpur">Dinajpur (Punarbhaba Basin)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="hours-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Forecast Time:
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { label: 'Current', value: '0' },
                { label: '+6 Hours', value: '6' },
                { label: '+12 Hours', value: '12' },
                { label: '+24 Hours', value: '24' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHoursAhead(opt.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    hoursAhead === opt.value
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Hydrological Elevation Summary Strip */}
      {spatialData?.metadata && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Active River Gauge Station</span>
            <div className="text-sm font-bold text-slate-900 mt-1 truncate">
              {spatialData.metadata.stationName}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Base River Elevation</span>
            <div className="text-xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
              {spatialData.metadata.baseLevelMeters.toFixed(2)} m
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Predicted Surge (+{hoursAhead}h)</span>
            <div className="text-xl font-bold text-blue-700 mt-1 font-mono tabular-nums">
              +{spatialData.metadata.waterRiseMeters.toFixed(2)} m
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500">Total Forecasted River Level</span>
            <div className="text-xl font-bold text-red-600 mt-1 font-mono tabular-nums">
              {spatialData.metadata.totalWaterLevelMeters.toFixed(2)} m
            </div>
          </div>
        </div>
      )}

      {/* Map Viewport + Spatial Zone Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Interactive GIS Inundation Layer {loading ? '(Updating...)' : ''}
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-red-500 inline-block" /> High Risk (&gt;0.5m depth)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" /> Medium Risk (0–0.5m)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" /> Low Risk (Dry)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Emergency Shelter
              </span>
            </div>
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-[460px] rounded-lg border border-slate-200 z-0"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Urban Zone Inundation Matrix (+{hoursAhead}h)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Click any zone on the map or inspect ground vs. water depth below.
            </p>

            <div className="mt-4 space-y-3">
              {spatialData?.features.map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {feat.properties.name}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        feat.properties.risk_level === 'High'
                          ? 'text-red-600'
                          : feat.properties.risk_level === 'Medium'
                          ? 'text-amber-600'
                          : feat.properties.risk_level === 'Safe'
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {feat.properties.risk_level}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Ground Elevation: {feat.properties.elevation_meters}m · Type: {feat.properties.type}
                  </div>
                  <p className="text-xs text-slate-700 pt-1">
                    {feat.properties.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
            Powered by Spatial Topography Engine &amp; Sentinel-1 SAR DEM Comparison
          </div>
        </div>
      </div>
    </div>
  );
};
