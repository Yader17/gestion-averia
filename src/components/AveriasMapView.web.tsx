import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { Averia } from '../types/averia';

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
const VIEW_RECORDS_BUTTON_STYLE = {
  marginTop: SPACING.sm,
  border: 0,
  borderRadius: 6,
  backgroundColor: COLORS.primary,
  color: COLORS.white,
  fontWeight: '700',
  padding: `${SPACING.xs + 2}px ${SPACING.md}px`,
};
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
  const machineMarkers = useMemo(() => buildMachineMarkers(averias), [averias]);
  const groupedByPoint = useMemo(() => groupMarkersByPoint(machineMarkers), [machineMarkers]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const missingLocationCount = averias.filter((item) => !item.ubicacion).length;
  const mapCenter = machineMarkers.length > 0
    ? ([machineMarkers[0].latitude, machineMarkers[0].longitude] as [number, number])
    : DEFAULT_CENTER;

  if (machineMarkers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No hay ubicaciones para mostrar</Text>
        <Text style={styles.emptyText}>
          Al crear o editar una averia, usa el buscador de Lugar para seleccionar una ubicacion real.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.legendRow}>
        <Text style={styles.legendItem}>Verde: solucionada</Text>
        <Text style={styles.legendItem}>Rojo: pendiente</Text>
        {missingLocationCount > 0 && (
          <Text style={styles.legendMuted}>
            {missingLocationCount} averia(s) sin coordenadas.
          </Text>
        )}
      </View>

      <MapContainerCompat center={mapCenter} zoom={6} style={styles.map}>
        <TileLayerCompat
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
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
                  {`${group.markers.length} averías en este punto. Click para expandir.`}
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
                  {`Nº Bastidor: ${marker.bastidor || 'Sin número'} | Intervenciones: ${marker.interventions}`}
                </TooltipCompat>
                <Popup>
                  <div style={{ minWidth: 230 }}>
                    <strong>Nº Bastidor:</strong> {marker.bastidor || 'Sin número'}
                    <br />
                    <strong>Lugar:</strong> {marker.lugar || 'Sin lugar'}
                    <br />
                    <strong>Intervenciones:</strong> {marker.interventions}
                    <br />
                    <strong>Estado:</strong> {marker.isSolved ? 'Hecha' : 'Pendiente'}
                    <br />
                    <button
                      type="button"
                      style={{
                        ...VIEW_RECORDS_BUTTON_STYLE,
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
                      Ver registros
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

    const key = item.numeroBastidor.trim() || `sin-bastidor-${item.id}`;
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
      isSolved: latest.solucionado,
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

const styles = StyleSheet.create({
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
