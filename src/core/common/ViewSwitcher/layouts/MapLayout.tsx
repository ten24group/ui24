/**
 * MapLayout — embedded map view for the unified ViewSwitcher (#119).
 *
 * Data strategy:
 * 1. If config has its own apiConfig → use that (independent fetching)
 * 2. If parentApiConfig is provided (from the parent Table) → use that (independent fetching)
 * 3. If config has static data → use that
 * 4. Fallback to shared records from parent
 *
 * Maps need all records with valid coordinates to render markers, so
 * independent mode fetches with a high count limit (maxRecords).
 */

import React, { useMemo, useEffect } from 'react';
import { Card, Alert, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapViewConfig } from '../types';
import { useMapData } from '../hooks/useMapData';
import type { IApiConfig } from '../../../context/ApiContext';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

export interface MapLayoutProps {
  /** Shared records from parent (last resort fallback) */
  records?: Record<string, unknown>[];
  config: MapViewConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
  /** Parent table's API config — used for independent fetching when config has no apiConfig */
  parentApiConfig?: IApiConfig;
  /** Parent table's applied filters — forwarded to independent query */
  appliedFilters?: Record<string, unknown>;
  /** Route params for URL substitution */
  routeParams?: Record<string, string>;
  /** Entity name for cache key scoping */
  entityName?: string;
}

interface GeoRecord {
  lat: number;
  lng: number;
  title: string;
  id: string;
  summaryValues: string[];
  original: Record<string, unknown>;
}

function extractGeoRecords(
  records: Record<string, unknown>[],
  config: MapViewConfig,
  idKey: string
): GeoRecord[] {
  const result: GeoRecord[] = [];
  records.forEach((rec, index) => {
    const lat = parseFloat(String(rec[ config.latField ] ?? ''));
    const lng = parseFloat(String(rec[ config.lngField ] ?? ''));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const summaryValues = (config.summaryFields ?? [])
        .map((f) => (rec[ f ] != null ? String(rec[ f ]) : ''))
        .filter(Boolean);
      result.push({
        lat,
        lng,
        title: String(rec[ config.titleField ] ?? `Record ${index + 1}`),
        id: String(rec[ idKey ] ?? index),
        summaryValues,
        original: rec,
      });
    }
  });
  return result;
}

const FitBounds: React.FC<{ geoRecords: GeoRecord[]; defaultCenter: LatLngTuple; defaultZoom: number }> = ({
  geoRecords,
  defaultCenter,
  defaultZoom,
}) => {
  const map = useMap();
  useEffect(() => {
    if (geoRecords.length === 0) {
      map.setView(defaultCenter, defaultZoom);
      return;
    }
    if (geoRecords.length === 1) {
      map.setView([ geoRecords[ 0 ].lat, geoRecords[ 0 ].lng ], defaultZoom);
      return;
    }
    const bounds = L.latLngBounds(geoRecords.map((r) => [ r.lat, r.lng ] as LatLngTuple));
    map.fitBounds(bounds, { padding: [ 32, 32 ] });
  }, [ geoRecords, map, defaultCenter, defaultZoom ]);
  return null;
};

export const MapLayout: React.FC<MapLayoutProps> = ({
  records: sharedRecords,
  config,
  recordIdentifierKey,
  onRecordClick,
  parentApiConfig,
  appliedFilters = {},
  routeParams = {},
  entityName = 'entity',
}) => {
  const idKey = config.idField || recordIdentifierKey;
  const defaultCenter: LatLngTuple = config.defaultCenter ?? [ 51.505, -0.09 ];
  const defaultZoom = config.defaultZoom ?? 10;
  const mapHeight = config.mapHeight ?? 500;

  const effectiveApiConfig: IApiConfig | null = config.apiConfig ?? parentApiConfig ?? null;
  const useIndependentData = effectiveApiConfig != null;

  const independentResult = useMapData({
    apiConfig: effectiveApiConfig ?? { apiUrl: '', apiMethod: 'GET' },
    appliedFilters,
    routeParams,
    entityName,
    maxRecords: config.maxRecords,
    enabled: useIndependentData,
  });

  const effectiveRecords = useMemo(() => {
    if (useIndependentData) return independentResult.records;
    return config.data ?? sharedRecords ?? [];
  }, [ useIndependentData, independentResult.records, config.data, sharedRecords ]);

  const isLoading = useIndependentData && independentResult.isLoading;

  const geoRecords = useMemo(
    () => extractGeoRecords(effectiveRecords, config, idKey),
    [ effectiveRecords, config, idKey ]
  );

  if (isLoading) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined />} />
      </Card>
    );
  }

  if (geoRecords.length === 0) {
    return (
      <Alert
        type="info"
        message="No records with valid coordinates"
        style={{ margin: 16 }}
      />
    );
  }

  return (
    <Card style={{ marginTop: 8, padding: 0 }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: mapHeight, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds
          geoRecords={geoRecords}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />
        {geoRecords.map((rec) => (
          <Marker
            key={rec.id}
            position={[ rec.lat, rec.lng ]}
            eventHandlers={
              onRecordClick
                ? { click: () => onRecordClick(rec.original) }
                : undefined
            }
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>{rec.title}</strong>
                {rec.summaryValues.length > 0 && (
                  <span style={{ display: 'block', fontSize: 12, color: '#666' }}>
                    {rec.summaryValues.join(' · ')}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Card>
  );
};
