import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FONT_SIZES, SPACING } from '../constants/theme';
import { useI18n } from '../i18n/useI18n';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { Averia } from '../types/averia';
import { MapStatusFilter, MapStatusFilterValue } from './MapStatusFilter';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, points]);
  return null;
}

type AveriasMapViewProps = {
  averias: Averia[];
  onViewRecords: (bastidor: string) => void;
};

type MachineMarker = {
  id: string;
  bastidor: string;
  latitude: number;
  longitude: number;
  lugar: string;
  isSolved: boolean;
  interventions: number;
};

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038];
const EXPANSION_RADIUS = 0.00045;
const buildViewRecordsButtonStyle = (colors: Palette) => ({
  marginTop: SPACING.sm,
  border: 0,
  borderRadius: 6,
  backgroundColor: colors.primary,
  color: colors.onPrimary,
  fontWeight: '700',
  padding: `${SPACING.xs + 2}px ${SPACING.md}px`,
});
const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const MapContainerCompat = MapContainer as unknown as React.ComponentType<{
  center: [number, number];
  zoom: number;
  style: {
    width: '100%';
    minHeight: number;
    borderRadius: number;
    overflow: 'hidden';
    borderWidth: number;
    borderColor: string;
  };
  children: React.ReactNode;
}>;
const TileLayerCompat = TileLayer as unknown as React.ComponentType<{
  attribution: string;
  url: string;
}>;
const CircleMarkerCompat = CircleMarker as unknown as React.ComponentType<{
  center: [number, number];
  radius: number;
  pathOptions: {
    color: string;
    fillColor: string;
    fillOpacity: number;
    weight: number;
  };
  eventHandlers?: {
    click?: () => void;
    dblclick?: () => void;
  };
  children?: React.ReactNode;
}>;
const TooltipCompat = Tooltip as unknown as React.ComponentType<{
  direction: string;
  offset: [number, number];
  children: React.ReactNode;
}>;

export function AveriasMapView({ averias, onViewRecords }: AveriasMapViewProps) {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<MapStatusFilterValue>('all');
  const allMarkers = useMemo(() => buildMachineMarkers(averias), [averias]);
  const machineMarkers = useMemo(
    () => allMarkers.filter((m) => statusFilter === 'all' || (statusFilter === 'solved') === m.isSolved),
    [allMarkers, statusFilter]
  );
  const groupedByPoint = useMemo(() => groupMarkersByPoint(machineMarkers), [machineMarkers]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const boundsPoints = useMemo(
    () => groupedByPoint.map((g) => [g.latitude, g.longitude] as [number, number]),
    [groupedByPoint]
  );

  const missingLocationCount = averias.filter((item) => !item.ubicacion).length;
  const mapCenter = machineMarkers.length > 0
    ? ([machineMarkers[0].latitude, machineMarkers[0].longitude] as [number, number])
    : DEFAULT_CENTER;

  if (allMarkers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('map_empty_title')}</Text>
        <Text style={styles.emptyText}>{t('map_empty_body')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MapStatusFilter value={statusFilter} onChange={setStatusFilter} />
      <View style={styles.legendRow}>
        <Text style={styles.legendItem}>{t('map_legend_solved')}</Text>
        <Text style={styles.legendItem}>{t('map_legend_pending')}</Text>
        {missingLocationCount > 0 && (
          <Text style={styles.legendMuted}>{t('map_missing', { count: missingLocationCount })}</Text>
        )}
        {machineMarkers.length === 0 && <Text style={styles.legendMuted}>{t('map_empty_filter')}</Text>}
      </View>

      <MapContainerCompat center={mapCenter} zoom={6} style={styles.map}>
        <FitBounds points={boundsPoints} />
        <TileLayerCompat
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url={isDark ? DARK_TILES : LIGHT_TILES}
        />

        {groupedByPoint.map((group) => {
          const isExpanded = expandedGroups[group.key] ?? false;
          const hasOverlap = group.markers.length > 1;

          if (hasOverlap && !isExpanded) {
            return (
              <CircleMarkerCompat
                key={group.key}
                center={[group.latitude, group.longitude]}
                radius={12}
                pathOptions={{
                  color: '#0b57d0',
                  fillColor: '#1a73e8',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => {
                    setExpandedGroups((previous) => ({
                      ...previous,
                      [group.key]: true,
                    }));
                  },
                }}
              >
                <TooltipCompat direction="top" offset={[0, -8]}>
                  {t('map_group_tooltip', { count: group.markers.length })}
                </TooltipCompat>
              </CircleMarkerCompat>
            );
          }

          return group.markers.map((marker, index) => {
            const position = hasOverlap
              ? getExpandedPosition(group.latitude, group.longitude, index, group.markers.length)
              : ([marker.latitude, marker.longitude] as [number, number]);
            const canViewRecords = marker.bastidor.trim().length > 0;

            return (
              <CircleMarkerCompat
                key={`${group.key}-${marker.id}`}
                center={position}
                radius={10}
                pathOptions={{
                  color: marker.isSolved ? '#2e7d32' : '#d32f2f',
                  fillColor: marker.isSolved ? '#43a047' : '#ef5350',
                  fillOpacity: 0.85,
                  weight: 2,
                }}
                eventHandlers={{
                  dblclick: () => {
                    if (hasOverlap) {
                      setExpandedGroups((previous) => ({
                        ...previous,
                        [group.key]: false,
                      }));
                    }
                  },
                }}
              >
                <TooltipCompat direction="top" offset={[0, -8]}>
                  {`${t('map_vin')}: ${marker.bastidor || t('map_no_number')} | ${t('map_interventions')}: ${marker.interventions}`}
                </TooltipCompat>
                <Popup>
                  <div style={{ minWidth: 230 }}>
                    <strong>{t('map_vin')}:</strong> {marker.bastidor || t('map_no_number')}
                    <br />
                    <strong>{t('map_place')}:</strong> {marker.lugar || t('map_no_place')}
                    <br />
                    <strong>{t('map_interventions')}:</strong> {marker.interventions}
                    <br />
                    <strong>{t('map_status')}:</strong> {marker.isSolved ? t('map_status_done') : t('map_status_pending')}
                    <br />
                    <button
                      type="button"
                      style={{
                        ...buildViewRecordsButtonStyle(colors),
                        opacity: canViewRecords ? 1 : 0.55,
                        cursor: canViewRecords ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!canViewRecords}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onViewRecords(marker.bastidor);
                      }}
                    >
                      {t('map_view_records')}
                    </button>
                  </div>
                </Popup>
              </CircleMarkerCompat>
            );
          });
        })}
      </MapContainerCompat>
    </View>
  );
}

function buildMachineMarkers(averias: Averia[]): MachineMarker[] {
  const groups = new Map<string, Averia[]>();

  averias.forEach((item) => {
    if (!item.ubicacion) {
      return;
    }

    const key = `${item.numeroBastidor.trim() || `sin-bastidor-${item.id}`}@${item.ubicacion.latitude.toFixed(5)},${item.ubicacion.longitude.toFixed(5)}`;
    const previous = groups.get(key) ?? [];
    previous.push(item);
    groups.set(key, previous);
  });

  return Array.from(groups.entries()).map(([bastidor, entries]) => {
    const latest = entries[entries.length - 1];
    const location = latest.ubicacion;

    return {
      id: latest.id,
      bastidor,
      latitude: location?.latitude ?? DEFAULT_CENTER[0],
      longitude: location?.longitude ?? DEFAULT_CENTER[1],
      lugar: latest.lugar,
      isSolved: entries.every((e) => e.solucionado),
      interventions: entries.length,
    };
  });
}

function groupMarkersByPoint(markers: MachineMarker[]) {
  const grouped = new Map<string, MachineMarker[]>();

  markers.forEach((marker) => {
    const pointKey = `${marker.latitude.toFixed(6)}:${marker.longitude.toFixed(6)}`;
    const previous = grouped.get(pointKey) ?? [];
    previous.push(marker);
    grouped.set(pointKey, previous);
  });

  return Array.from(grouped.entries()).map(([key, entries]) => ({
    key,
    latitude: entries[0].latitude,
    longitude: entries[0].longitude,
    markers: entries,
  }));
}

function getExpandedPosition(
  latitude: number,
  longitude: number,
  index: number,
  total: number
): [number, number] {
  const angle = (2 * Math.PI * index) / total;
  const latitudeOffset = Math.sin(angle) * EXPANSION_RADIUS;
  const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const longitudeOffset = (Math.cos(angle) * EXPANSION_RADIUS) / longitudeScale;

  return [latitude + latitudeOffset, longitude + longitudeOffset];
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.md,
  },
  legendItem: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  legendMuted: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  map: {
    width: '100%',
    minHeight: 580,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
  },
});
