import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  title?: string;
};

export function DonutChart({
  segments,
  size = 180,
  strokeWidth = 35,
  title,
}: DonutChartProps) {
  const styles = useThemedStyles(createStyles);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.noData}>Sin datos</Text>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  let currentAngle = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const angle = (segment.value / total) * 360;
      // Prevent full circle from collapsing (use 359.99)
      const sweepAngle = angle >= 360 ? 359.99 : angle;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweepAngle;
      currentAngle += angle;
      return {
        ...segment,
        path: createArc(startAngle, endAngle),
      };
    });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.chartRow}>
        <View style={styles.svgContainer}>
          <Svg width={size} height={size}>
            <G>
              {arcs.map((arc, i) => (
                <Path
                  key={i}
                  d={arc.path}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              ))}
            </G>
          </Svg>
          <View style={[styles.centerLabel, { width: size, height: size }]}>
            <Text style={styles.centerValue}>{total}</Text>
            <Text style={styles.centerText}>Total</Text>
          </View>
        </View>
        <View style={styles.legend}>
          {segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
                <Text style={styles.legendValue}>
                  {s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
                </Text>
              </View>
            ))}
        </View>
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
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  svgContainer: {
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  centerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  legend: {
    gap: SPACING.sm,
    flex: 1,
    minWidth: 120,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    flex: 1,
  },
  legendValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  noData: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});
