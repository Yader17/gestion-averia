import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { DonutChart } from './DonutChart';
import { BarChart } from './BarChart';

type KPIDashboardProps = {
  averias: Averia[];
};

export function KPIDashboard({ averias }: KPIDashboardProps) {
  const { colors: COLORS } = useTheme();
  const styles = useThemedStyles(createStyles);
  const stats = useMemo(() => {
    const total = averias.length;
    const solucionadas = averias.filter((a) => a.solucionado).length;
    const pendientes = total - solucionadas;
    const porcentaje = total > 0 ? Math.round((solucionadas / total) * 100) : 0;

    // Count by intervención
    const byIntervencion = new Map<string, number>();
    averias.forEach((a) => {
      const key = a.intervencion || 'Sin asignar';
      byIntervencion.set(key, (byIntervencion.get(key) ?? 0) + 1);
    });

    // Count by tipo de avería
    const byTipo = new Map<string, number>();
    averias.forEach((a) => {
      byTipo.set(a.tipoAveria, (byTipo.get(a.tipoAveria) ?? 0) + 1);
    });

    return { total, solucionadas, pendientes, porcentaje, byIntervencion, byTipo };
  }, [averias]);

  const donutSegments = [
    { label: 'Solucionadas', value: stats.solucionadas, color: COLORS.success },
    { label: 'Pendientes', value: stats.pendientes, color: COLORS.error },
  ];

  const intervencionBars = Array.from(stats.byIntervencion.entries()).map(
    ([label, value], i) => ({
      label,
      value,
      color: COLORS.chart[i % COLORS.chart.length],
    })
  );

  const tipoBars = Array.from(stats.byTipo.entries()).map(
    ([label, value], i) => ({
      label,
      value,
      color: COLORS.chart[(i + 4) % COLORS.chart.length],
    })
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* KPI Summary Cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.card, styles.cardTotal]}>
          <Text style={styles.cardValue}>{stats.total}</Text>
          <Text style={styles.cardLabel}>Total Averías</Text>
        </View>
        <View style={[styles.card, styles.cardPendientes]}>
          <Text style={styles.cardValue}>{stats.pendientes}</Text>
          <Text style={styles.cardLabel}>Pendientes</Text>
        </View>
        <View style={[styles.card, styles.cardSolucionadas]}>
          <Text style={styles.cardValue}>{stats.solucionadas}</Text>
          <Text style={styles.cardLabel}>Solucionadas</Text>
        </View>
        <View style={[styles.card, styles.cardPorcentaje]}>
          <Text style={styles.cardValue}>{stats.porcentaje}%</Text>
          <Text style={styles.cardLabel}>Resolución</Text>
        </View>
      </View>

      {/* Donut Chart - Solucionadas vs Pendientes */}
      <DonutChart
        segments={donutSegments}
        title="Estado de Resolución"
      />

      {/* Bar Chart - By Intervención */}
      <BarChart
        data={intervencionBars}
        title="Averías por Intervención"
      />

      {/* Bar Chart - By Tipo */}
      <BarChart
        data={tipoBars}
        title="Averías por Tipo de Avería"
      />
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTotal: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardPendientes: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  cardSolucionadas: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  cardPorcentaje: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontWeight: '600',
  },
});
