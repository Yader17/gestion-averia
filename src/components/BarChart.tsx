import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

type BarItem = {
  label: string;
  value: number;
  color: string;
};

type BarChartProps = {
  data: BarItem[];
  title?: string;
};

export function BarChart({ data, title }: BarChartProps) {
  const styles = useThemedStyles(createStyles);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.noData}>Sin datos</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.chartArea}>
        {data
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item, i) => {
            const widthPercent = (item.value / maxValue) * 100;
            return (
              <View key={i} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${widthPercent}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{item.value}</Text>
              </View>
            );
          })}
      </View>
    </View>
  );
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartArea: {
    gap: SPACING.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  barLabel: {
    width: 100,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'right',
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  barValue: {
    width: 32,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  noData: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});
