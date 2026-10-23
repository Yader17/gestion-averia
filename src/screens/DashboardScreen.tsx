import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import { AveriaCard } from '../components/AveriaCard';
import { DonutChart } from '../components/DonutChart';
import { BarChart } from '../components/BarChart';
import { ATTENTION_WINDOW_DAYS, computeDashboardStats } from '../utils/dashboardStats';

type Props = {
  averias: Averia[];
  onOpenAveria: (averia: Averia) => void;
  onNewAveria: () => void;
  onViewAll: (filter?: 'pending' | 'resolved') => void;
};

const MIN_RECORDS_FOR_CHARTS = 3;

export function DashboardScreen({ averias, onOpenAveria, onNewAveria, onViewAll }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();
  const stats = useMemo(() => computeDashboardStats(averias), [averias]);

  if (stats.total === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="clipboard-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>{t('home_empty')}</Text>
        <Pressable style={styles.primaryButton} onPress={onNewAveria} accessibilityRole="button">
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.primaryButtonText}>{t('home_empty_cta')}</Text>
        </Pressable>
      </View>
    );
  }

  const showCharts = stats.total >= MIN_RECORDS_FOR_CHARTS;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('home_title')}
      </Text>

      <View style={styles.grid}>
        <StatCard label={t('home_total')} value={String(stats.total)} icon="layers-outline" onPress={() => onViewAll()} />
        <StatCard
          label={t('home_pending')}
          value={String(stats.pending)}
          icon="time-outline"
          tone="warning"
          onPress={() => onViewAll('pending')}
        />
        <StatCard
          label={t('home_resolved')}
          value={String(stats.resolved)}
          icon="checkmark-circle-outline"
          tone="success"
          onPress={() => onViewAll('resolved')}
        />
        <StatCard label={t('home_resolution_rate')} value={`${stats.resolutionRate}%`} icon="pie-chart-outline" />
      </View>

      {showCharts && (
        <View style={styles.chartsRow}>
          <View style={styles.chartCol}>
            <DonutChart
              title={t('home_status_chart')}
              segments={[
                { label: t('status_resolved'), value: stats.resolved, color: colors.success },
                { label: t('status_pending'), value: stats.pending, color: colors.error },
              ]}
            />
          </View>
          <View style={styles.chartCol}>
            <BarChart
              title={t('home_types_chart')}
              data={stats.topTypes.map((item, index) => ({
                ...item,
                color: colors.chart[index % colors.chart.length],
              }))}
            />
          </View>
        </View>
      )}

      <Section title={t('home_attention')} hint={t('home_attention_hint', { days: ATTENTION_WINDOW_DAYS })}>
        {stats.attention.length === 0 ? (
          <Text style={styles.muted}>{t('home_no_attention')}</Text>
        ) : (
          stats.attention.map((averia) => <AveriaCard key={averia.id} averia={averia} onPress={onOpenAveria} compact />)
        )}
      </Section>

      <Section title={t('home_latest')} actionLabel={t('common_view_all')} onAction={() => onViewAll()}>
        {stats.latest.map((averia) => (
          <AveriaCard key={averia.id} averia={averia} onPress={onOpenAveria} compact />
        ))}
      </Section>
    </ScrollView>
  );
}

function StatCard(props: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'warning' | 'success';
  onPress?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const tint = props.tone === 'warning' ? colors.warning : props.tone === 'success' ? colors.success : colors.primary;
  return (
    <Pressable
      style={styles.statCard}
      onPress={props.onPress}
      disabled={!props.onPress}
      accessibilityRole={props.onPress ? 'button' : 'text'}
      accessibilityLabel={`${props.label}: ${props.value}`}
    >
      <Ionicons name={props.icon} size={22} color={tint} />
      <Text style={[styles.statValue, { color: tint }]}>{props.value}</Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </Pressable>
  );
}

function Section(props: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {props.title}
          </Text>
          {props.hint ? <Text style={styles.muted}>{props.hint}</Text> : null}
        </View>
        {props.actionLabel && props.onAction ? (
          <Pressable onPress={props.onAction} accessibilityRole="button" style={styles.linkButton}>
            <Text style={styles.linkText}>{props.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{props.children}</View>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 1100, alignSelf: 'center' },
    heading: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    statCard: {
      flexGrow: 1,
      flexBasis: 150,
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      gap: 4,
      minHeight: 96,
    },
    statValue: { fontSize: 28, fontWeight: '800' },
    statLabel: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
    chartsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    chartCol: { flexGrow: 1, flexBasis: 300 },
    section: { gap: SPACING.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text },
    sectionBody: { gap: SPACING.sm },
    muted: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
    linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.sm },
    linkText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT_SIZES.md },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.lg },
    emptyText: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary, textAlign: 'center' },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.lg,
      minHeight: 48,
      borderRadius: 24,
    },
    primaryButtonText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.lg },
  });
