import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Averia } from '../types/averia';
import { TABLE_HEADERS } from '../constants/tableHeaders';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  TABLE_COLUMN_WIDTHS,
} from '../constants/theme';

type AveriaTableProps = {
  averias: Averia[];
  onEditAveria: (averia: Averia) => void;
  onDeleteAveria: (id: string) => void;
  onGenerateReport: (averia: Averia) => void;
};

const COLUMN_KEYS = TABLE_HEADERS.map((header) => header.key);

const COLUMN_WIDTHS: Record<string, number> = {
  fecha: TABLE_COLUMN_WIDTHS.fecha,
  numeroBastidor: TABLE_COLUMN_WIDTHS.numeroBastidor,
  tipoAveria: TABLE_COLUMN_WIDTHS.tipoAveria,
  intervencion: TABLE_COLUMN_WIDTHS.intervencion,
  lugar: TABLE_COLUMN_WIDTHS.lugar,
  observacion: TABLE_COLUMN_WIDTHS.observacion,
  solucionado: TABLE_COLUMN_WIDTHS.solucionado,
};

const ACTIONS_WIDTH = 180;

export function AveriaTable({
  averias,
  onEditAveria,
  onDeleteAveria,
  onGenerateReport,
}: AveriaTableProps) {
  const totalWidth =
    Object.values(COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0) +
    ACTIONS_WIDTH;

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
          <View style={[styles.headerCell, { width: ACTIONS_WIDTH }]}>
            <Text style={styles.headerText}>Acciones</Text>
          </View>
        </View>

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

              <View style={[styles.dataCell, { width: ACTIONS_WIDTH }]}>
                <View style={styles.actionButtons}>
                  <Pressable
                    style={styles.reportButton}
                    onPress={() => onGenerateReport(averia)}
                  >
                    <Text style={styles.reportButtonText}>PDF</Text>
                  </Pressable>
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
    alignItems: 'center',
  },
  reportButton: {
    minWidth: 52,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm - 2,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center',
  },
  reportButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  editButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  deleteButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.solucionadoNo,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
  },
});