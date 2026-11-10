import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { FONT_SIZES, SPACING } from '../constants/theme';
import { useI18n } from '../i18n/useI18n';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { Averia } from '../types/averia';
import { MapStatusFilter, MapStatusFilterValue } from './MapStatusFilter';

type MapLabels = {
  vin: string;
  place: string;
  interventions: string;
  status: string;
  done: string;
  pending: string;
  noNumber: string;
  noPlace: string;
  view: string;
  groupTooltip: string;
};

type AveriasMapViewProps = {
  averias: Averia[];
  onViewRecords?: (bastidor: string) => void;
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

type MarkerGroup = {
  key: string;
  latitude: number;
  longitude: number;
  markers: MachineMarker[];
};

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038];
const EXPANSION_RADIUS = 0.00045;

export function AveriasMapView({ averias, onViewRecords }: AveriasMapViewProps) {
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<MapStatusFilterValue>('all');
  const machineMarkers = useMemo(() => buildMachineMarkers(averias), [averias]);
  const visibleMarkers = useMemo(
    () => machineMarkers.filter((m) => statusFilter === 'all' || (statusFilter === 'solved') === m.isSolved),
    [machineMarkers, statusFilter]
  );
  const markerGroups = useMemo(() => groupMarkersByPoint(visibleMarkers), [visibleMarkers]);
  const missingLocationCount = averias.filter((item) => !item.ubicacion).length;
  const labels = useMemo(
    () => ({
      vin: t('map_vin'),
      place: t('map_place'),
      interventions: t('map_interventions'),
      status: t('map_status'),
      done: t('map_status_done'),
      pending: t('map_status_pending'),
      noNumber: t('map_no_number'),
      noPlace: t('map_no_place'),
      view: t('map_view_records'),
      groupTooltip: t('map_group_tooltip', { count: '{count}' }),
    }),
    [t]
  );
  const html = useMemo(() => buildMapHtml(markerGroups, isDark, labels), [markerGroups, isDark, labels]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          bastidor?: string;
        };

        if (payload.type === 'view-records' && payload.bastidor) {
          onViewRecords?.(payload.bastidor);
        }
      } catch {
        return;
      }
    },
    [onViewRecords]
  );

  if (machineMarkers.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('map_empty_title')}</Text>
        <Text style={styles.body}>{t('map_empty_body')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MapStatusFilter value={statusFilter} onChange={setStatusFilter} />
      <View style={styles.legendRow}>
        <Text style={styles.legendItem}>{t('map_legend_solved')}</Text>
        <Text style={styles.legendItem}>{t('map_legend_pending')}</Text>
        {missingLocationCount > 0 ? (
          <Text style={styles.legendMuted}>{t('map_missing', { count: missingLocationCount })}</Text>
        ) : null}
      </View>
      {visibleMarkers.length === 0 ? (
        <Text style={styles.body}>{t('map_empty_filter')}</Text>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={styles.webview}
        />
      )}
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

  return Array.from(groups.values()).map((entries) => {
    const latest = entries[entries.length - 1];
    const location = latest.ubicacion;

    return {
      id: latest.id,
      bastidor: latest.numeroBastidor.trim(),
      latitude: location?.latitude ?? DEFAULT_CENTER[0],
      longitude: location?.longitude ?? DEFAULT_CENTER[1],
      lugar: latest.lugar,
      isSolved: entries.every((e) => e.solucionado),
      interventions: entries.length,
    };
  });
}

function groupMarkersByPoint(markers: MachineMarker[]): MarkerGroup[] {
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

function buildMapHtml(markerGroups: MarkerGroup[], isDark: boolean, labels: MapLabels): string {
  const labelsJson = JSON.stringify(labels).replace(/</g, '\\u003c');
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const center = markerGroups.length > 0
    ? [markerGroups[0].latitude, markerGroups[0].longitude]
    : DEFAULT_CENTER;
  const markersJson = JSON.stringify(markerGroups).replace(/</g, '\\u003c');
  const centerJson = JSON.stringify(center);

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossorigin=""
        />
        <style>
          html, body, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: Arial, Helvetica, sans-serif;
          }

          .group-marker {
            width: 28px;
            height: 28px;
            border-radius: 14px;
            background: #1a73e8;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border: 2px solid #0b57d0;
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
          }

          .leaflet-popup-content {
            margin: 12px 14px;
            min-width: 220px;
          }

          .view-button {
            margin-top: 10px;
            border: 0;
            border-radius: 6px;
            background: #1a73e8;
            color: white;
            font-weight: 700;
            padding: 8px 14px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <script>
          const markerGroups = ${markersJson};
          const labels = ${labelsJson};
          const center = ${centerJson};
          const expansionRadius = ${EXPANSION_RADIUS};
          const map = L.map('map').setView(center, 6);

          L.tileLayer(${JSON.stringify(tileUrl)}, {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }).addTo(map);

          function getExpandedPosition(latitude, longitude, index, total) {
            const angle = (2 * Math.PI * index) / total;
            const latitudeOffset = Math.sin(angle) * expansionRadius;
            const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
            const longitudeOffset = (Math.cos(angle) * expansionRadius) / longitudeScale;
            return [latitude + latitudeOffset, longitude + longitudeOffset];
          }

          function esc(value) {
            return String(value).replace(/[&<>"']/g, function(c) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
          }

          function buildPopupHtml(marker) {
            const disabled = !marker.bastidor || !marker.bastidor.trim();
            const buttonHtml = disabled
              ? '<button class="view-button" disabled style="opacity:0.55">' + esc(labels.view) + '</button>'
              : '<button class="view-button" type="button" data-action="view-records" data-bastidor="' + encodeURIComponent(marker.bastidor) + '">' + esc(labels.view) + '</button>';

            return [
              '<strong>' + esc(labels.vin) + ':</strong> ' + esc(marker.bastidor || labels.noNumber),
              '<br />',
              '<strong>' + esc(labels.place) + ':</strong> ' + esc(marker.lugar || labels.noPlace),
              '<br />',
              '<strong>' + esc(labels.interventions) + ':</strong> ' + marker.interventions,
              '<br />',
              '<strong>' + esc(labels.status) + ':</strong> ' + (marker.isSolved ? esc(labels.done) : esc(labels.pending)),
              '<br />',
              buttonHtml,
            ].join('');
          }

          function addDetailMarker(marker, latitude, longitude) {
            const layer = L.circleMarker([latitude, longitude], {
              radius: 10,
              color: marker.isSolved ? '#2e7d32' : '#d32f2f',
              fillColor: marker.isSolved ? '#43a047' : '#ef5350',
              fillOpacity: 0.85,
              weight: 2,
            }).addTo(map);

            layer.bindPopup(buildPopupHtml(marker));
          }

          function expandGroup(group, groupMarker) {
            map.removeLayer(groupMarker);
            group.markers.forEach((marker, index) => {
              const position = getExpandedPosition(group.latitude, group.longitude, index, group.markers.length);
              addDetailMarker(marker, position[0], position[1]);
            });
          }

          document.addEventListener('click', function(event) {
            const target = event.target;
            if (!(target instanceof Element)) {
              return;
            }

            const button = target.closest('[data-action="view-records"]');
            if (!button) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            const bastidor = button.getAttribute('data-bastidor');
            if (!bastidor || !window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'view-records',
              bastidor: decodeURIComponent(bastidor),
            }));
          });

          markerGroups.forEach((group) => {
            if (group.markers.length > 1) {
              const groupMarker = L.marker([group.latitude, group.longitude], {
                icon: L.divIcon({
                  className: '',
                  html: '<div class="group-marker">' + group.markers.length + '</div>',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                }),
              }).addTo(map);

              groupMarker.bindTooltip(labels.groupTooltip.replace('{count}', String(group.markers.length)));
              groupMarker.on('click', function() {
                expandGroup(group, groupMarker);
              });
              return;
            }

            const marker = group.markers[0];
            addDetailMarker(marker, marker.latitude, marker.longitude);
          });

          if (markerGroups.length > 1) {
            map.fitBounds(markerGroups.map(function(g) { return [g.latitude, g.longitude]; }), { padding: [30, 30], maxZoom: 15 });
          } else if (markerGroups.length === 1) {
            map.setView([markerGroups[0].latitude, markerGroups[0].longitude], 14);
          }
        </script>
      </body>
    </html>
  `;
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  body: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 520,
  },
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
  webview: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
});
