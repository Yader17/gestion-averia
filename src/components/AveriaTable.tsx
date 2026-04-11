import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Averia } from '../types/averia';
import { TABLE_HEADERS } from '../constants/tableHeaders';
import { COLORS, SPACING, FONT_SIZES, TABLE_COLUMN_WIDTHS } from '../constants/theme';

type AveriaTableProps = {
  averias: Averia[];
  onEditAveria: (averia: Averia) => void;
  onDeleteAveria: (id: string) => void;
};

const COLUMN_KEYS = TABLE_HEADERS.map((h) => h.key);

const COLUMN_WIDTHS: Record<string, number> = {
  fecha: TABLE_COLUMN_WIDTHS.fecha,
  numeroBastidor: TABLE_COLUMN_WIDTHS.numeroBastidor,
  tipoAveria: TABLE_COLUMN_WIDTHS.tipoAveria,
  intervencion: TABLE_COLUMN_WIDTHS.intervencion,
  lugar: TABLE_COLUMN_WIDTHS.lugar,
  observacion: TABLE_COLUMN_WIDTHS.observacion,
  solucionado: TABLE_COLUMN_WIDTHS.solucionado,
};

export function AveriaTable({ averias, onEditAveria, onDeleteAveria }: AveriaTableProps) {
  const totalWidth = Object.values(COLUMN_WIDTHS).reduce((sum, w) => sum + w, 0) + 120;

  if (averias.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay averías registradas.</Text>
        <Text style={styles.emptySubtext}>
          Carga un archivo Excel o agrega una nueva avería.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ minWidth: totalWidth }}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          {TABLE_HEADERS.map((header) => (
            <View
              key={header.key}
              style={[styles.headerCell, { width: COLUMN_WIDTHS[header.key] }]}
            >
              <Text style={styles.headerText} numberOfLines={1}>
                {header.label}
              </Text>
            </View>
          ))}
          <View style={[styles.headerCell, { width: 120 }]}>
            <Text style={styles.headerText}>Acciones</Text>
          </View>
        </View>

        {/* Data Rows */}
        <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator>
          {averias.map((averia, index) => (
            <View
              key={averia.id}
              style={[
                styles.dataRow,
                {
                  backgroundColor:
                    index % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd,
                },
              ]}
            >
              {COLUMN_KEYS.map((key) => (
                <View
                  key={key}
                  style={[styles.dataCell, { width: COLUMN_WIDTHS[key] }]}
                >
                  {key === 'solucionado' ? (
                    <View
                      style={[
                        styles.solucionadoBadge,
                        {
                          backgroundColor: averia.solucionado
                            ? COLORS.solucionadoSi
                            : COLORS.solucionadoNo,
                        },
                      ]}
                    >
                      <Text style={styles.solucionadoText}>
                        {averia.solucionado ? 'SI' : 'NO'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.dataText} numberOfLines={2}>
                      {String(averia[key as keyof Averia] ?? '')}
                    </Text>
                  )}
                </View>
              ))}
              <View style={[styles.dataCell, { width: 120 }]}>
                <View style={styles.actionButtons}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => onEditAveria(averia)}
                  >
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => onDeleteAveria(averia.id)}
                  >
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBackground,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
  },
  headerText: {
    color: COLORS.headerText,
    fontWeight: '700',
    fontSize: FONT_SIZES.sm,
  },
  bodyScroll: {
    maxHeight: 500,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dataCell: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
  },
  dataText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  solucionadoBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  solucionadoText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  editButton: {
    padding: SPACING.sm,
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
  },
});
