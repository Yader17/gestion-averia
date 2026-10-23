import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { Averia } from '../types/averia';

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
  const machineMarkers = useMemo(() => buildMachineMarkers(averias), [averias]);
  const markerGroups = useMemo(() => groupMarkersByPoint(machineMarkers), [machineMarkers]);
  const withLocation = machineMarkers.length;
  const html = useMemo(() => buildMapHtml(markerGroups), [markerGroups]);

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

  if (withLocation === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vista de mapa</Text>
        <Text style={styles.body}>
          No hay averías con ubicación real en este dispositivo. Importa un Excel exportado con la
          versión nueva o edita el lugar y selecciona una ubicación real.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.legendRow}>
        <Text style={styles.legendItem}>Verde: solucionada</Text>
        <Text style={styles.legendItem}>Rojo: pendiente</Text>
      </View>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        style={styles.webview}
      />
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

function buildMapHtml(markerGroups: MarkerGroup[]): string {
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
          const center = ${centerJson};
          const expansionRadius = ${EXPANSION_RADIUS};
          const map = L.map('map').setView(center, 6);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          function getExpandedPosition(latitude, longitude, index, total) {
            const angle = (2 * Math.PI * index) / total;
            const latitudeOffset = Math.sin(angle) * expansionRadius;
            const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
            const longitudeOffset = (Math.cos(angle) * expansionRadius) / longitudeScale;
            return [latitude + latitudeOffset, longitude + longitudeOffset];
          }

          function buildPopupHtml(marker) {
            const disabled = !marker.bastidor || !marker.bastidor.trim();
            const buttonHtml = disabled
              ? '<button class="view-button" disabled style="opacity:0.55">Ver registros</button>'
              : '<button class="view-button" type="button" data-action="view-records" data-bastidor="' + encodeURIComponent(marker.bastidor) + '">Ver registros</button>';

            return [
              '<strong>Nº Bastidor:</strong> ' + (marker.bastidor || 'Sin número'),
              '<br />',
              '<strong>Lugar:</strong> ' + (marker.lugar || 'Sin lugar'),
              '<br />',
              '<strong>Intervenciones:</strong> ' + marker.interventions,
              '<br />',
              '<strong>Estado:</strong> ' + (marker.isSolved ? 'Hecha' : 'Pendiente'),
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

              groupMarker.bindTooltip(group.markers.length + ' averías en este punto. Toca para expandir.');
              groupMarker.on('click', function() {
                expandGroup(group, groupMarker);
              });
              return;
            }

            const marker = group.markers[0];
            addDetailMarker(marker, marker.latitude, marker.longitude);
          });
        </script>
      </body>
    </html>
  `;
}

const styles = StyleSheet.create({
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
  webview: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
});
