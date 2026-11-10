import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT_SIZES, SPACING } from '../constants/theme';
import { useI18n } from '../i18n/useI18n';
import { Palette } from '../theme/palettes';
import { useThemedStyles } from '../theme/ThemeContext';

export type MapStatusFilterValue = 'all' | 'pending' | 'solved';

type Props = {
  value: MapStatusFilterValue;
  onChange: (value: MapStatusFilterValue) => void;
};

export function MapStatusFilter({ value, onChange }: Props) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const options: { key: MapStatusFilterValue; label: string }[] = [
    { key: 'all', label: t('map_filter_all') },
    { key: 'pending', label: t('map_filter_pending') },
    { key: 'solved', label: t('map_filter_solved') },
  ];

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (COLORS: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: COLORS.onPrimary,
  },
});
