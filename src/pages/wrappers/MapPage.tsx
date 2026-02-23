/**
 * MapPage — config-driven map/geo view (#48).
 *
 * Renders geo data on a Leaflet map using react-leaflet.
 * Each record with valid lat/lng becomes a marker.
 *
 * Features:
 * - Marker click → navigate to `onMarkerClickNavigateTo`
 * - Popup shows title + optional description + configurable action links
 * - Requires react-leaflet + leaflet (both installed as direct dependencies)
 */

import React, { useMemo, useEffect } from 'react';
import { Card, Spin, Alert } from 'antd';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { useEntityList } from '../../core/query/useEntityList';
import type { IApiConfig } from '../../core/context/ApiContext';
import { useCoreNavigator } from '../../routes/Navigation';
import { substituteUrlParams } from '../../core/utils';

/**
 * Leaflet's default marker icon URLs break when a bundler processes the package because the
 * library resolves icons via a private `_getIconUrl` method that hard-codes relative paths.
 * We delete that method and supply explicit package-relative URLs so they survive bundling.
 */
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface IMapPopupAction {
  label: string;
  icon?: string;
  /** URL to navigate to. Supports `:id` / `:idField` placeholders. */
  url: string;
}

export interface IMapPageConfig {
  entityName?: string;
  apiConfig: IApiConfig;
  latField: string;
  lngField: string;
  titleField: string;
  descriptionField?: string;
  /** Field used as the unique identifier for URL placeholder substitution */
  idField?: string;
  /**
   * Navigate here when a marker is clicked.
   * The entire marker becomes a clickable link. Supports `:id` / `:idField` placeholders.
   */
  onMarkerClickNavigateTo?: string;
  /** Action links rendered inside the marker popup (always visible) */
  popupActions?: IMapPopupAction[];
  defaultCenter?: LatLngTuple;
  defaultZoom?: number;
  mapHeight?: number;
}

interface MapPageProps
  extends IMapPageConfig,
    Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, string | number | undefined>;
  cardStyle?: React.CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface GeoRecord {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  id: string;
}

function extractGeoRecords(
  records: Record<string, unknown>[],
  latField: string,
  lngField: string,
  titleField: string,
  idField: string | undefined,
  descriptionField: string | undefined
): GeoRecord[] {
  const result: GeoRecord[] = [];
  records.forEach((rec, index) => {
    const lat = parseFloat(String(rec[latField] ?? ''));
    const lng = parseFloat(String(rec[lngField] ?? ''));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      result.push({
        lat,
        lng,
        title: String(rec[titleField] ?? `Record ${index + 1}`),
        description:
          descriptionField && rec[descriptionField] != null
            ? String(rec[descriptionField])
            : undefined,
        id: idField ? String(rec[idField] ?? index) : String(index),
      });
    }
  });
  return result;
}

function substituteId(pattern: string, id: string, idField: string | undefined): string {
  let result = pattern.replace(':id', id);
  if (idField) result = result.replace(`:${idField}`, id);
  return result;
}

// ─── Clickable Marker ──────────────────────────────────────────────────────────

/**
 * A small React component that uses the Leaflet map instance to add a click cursor
 * and open the popup programmatically — so the whole marker area is clickable.
 */
const ClickableMarker: React.FC<{
  record: GeoRecord;
  onMarkerClickNavigateTo?: string;
  idField?: string;
  popupActions?: IMapPopupAction[];
  onNavigate: (url: string) => void;
}> = ({ record, onMarkerClickNavigateTo, idField, popupActions, onNavigate }) => {
  const hasClick = !!onMarkerClickNavigateTo;
  const hasActions = (popupActions?.length ?? 0) > 0;
  const showPopup = !hasClick || hasActions;

  return (
    <Marker
      position={[record.lat, record.lng]}
      eventHandlers={
        hasClick
          ? {
              click: () => {
                const url = substituteId(onMarkerClickNavigateTo!, record.id, idField);
                onNavigate(url);
              },
            }
          : undefined
      }
    >
      {showPopup && (
        <Popup>
          <div style={{ minWidth: 140 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>{record.title}</strong>
            {record.description != null && (
              <span style={{ display: 'block', fontSize: 12, marginBottom: 6, color: '#666' }}>
                {record.description}
              </span>
            )}
            {popupActions != null && popupActions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {popupActions.map((action) => {
                  const actionUrl = substituteId(action.url, record.id, idField);
                  return (
                    <a
                      key={action.label}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(actionUrl);
                      }}
                      href={actionUrl}
                      style={{ fontSize: 12 }}
                    >
                      {action.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

// Small helper component: fits the map to markers when records load.
// Must use useEffect (not useMemo) because map.setView / map.fitBounds are side effects.
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
      map.setView([geoRecords[0].lat, geoRecords[0].lng], defaultZoom);
      return;
    }
    const bounds = L.latLngBounds(geoRecords.map((r) => [r.lat, r.lng] as LatLngTuple));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [geoRecords, map, defaultCenter, defaultZoom]);
  return null;
};

// ─── MapPage Component ─────────────────────────────────────────────────────────

export const MapPage: React.FC<MapPageProps> = ({
  entityName,
  apiConfig,
  latField,
  lngField,
  titleField,
  descriptionField,
  idField,
  onMarkerClickNavigateTo,
  popupActions,
  defaultCenter = [51.505, -0.09],
  defaultZoom = 10,
  mapHeight = 500,
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  cardStyle,
}) => {
  const navigate = useCoreNavigator();

  const resolvedUrl = useMemo(
    () => substituteUrlParams(apiConfig.apiUrl, routeParams),
    [apiConfig.apiUrl, routeParams]
  );

  const { data, isLoading, error } = useEntityList({
    entityName: entityName ?? 'map',
    apiConfig,
    apiUrl: resolvedUrl,
    payload:
      apiConfig.payload !== null &&
      typeof apiConfig.payload === 'object' &&
      !(apiConfig.payload instanceof FormData)
        ? apiConfig.payload
        : {},
  });

  const records = useMemo(
    () => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []),
    [data]
  );

  const geoRecords = useMemo(
    () => extractGeoRecords(records, latField, lngField, titleField, idField, descriptionField),
    [records, latField, lngField, titleField, idField, descriptionField]
  );

  return (
    <>
      <PageHeader
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        routeParams={routeParams}
      />

      <Card style={{ marginTop: 16, padding: 0, ...cardStyle }}>
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin />
          </div>
        )}
        {!isLoading && error && (
          <Alert type="error" message="Failed to load map data" style={{ margin: 16 }} />
        )}
        {!isLoading && !error && geoRecords.length === 0 && (
          <Alert
            type="info"
            message="No records with valid coordinates"
            style={{ margin: 16 }}
          />
        )}
        {!isLoading && !error && geoRecords.length > 0 && (
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{
              height: mapHeight,
              width: '100%',
              cursor: onMarkerClickNavigateTo ? 'default' : undefined,
            }}
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
              <ClickableMarker
                key={rec.id}
                record={rec}
                onMarkerClickNavigateTo={onMarkerClickNavigateTo}
                idField={idField}
                popupActions={popupActions}
                onNavigate={navigate}
              />
            ))}
          </MapContainer>
        )}
      </Card>
    </>
  );
};
