import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';

export type SectionKey = 'home' | 'faults' | 'map' | 'ai' | 'more';

type NavItem = {
  key: SectionKey;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

// Exactly five primary destinations.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', labelKey: 'nav_home', icon: 'home-outline', iconActive: 'home' },
  { key: 'faults', labelKey: 'nav_faults', icon: 'construct-outline', iconActive: 'construct' },
  { key: 'map', labelKey: 'nav_map', icon: 'map-outline', iconActive: 'map' },
  { key: 'ai', labelKey: 'nav_ai', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { key: 'more', labelKey: 'nav_more', icon: 'grid-outline', iconActive: 'grid' },
];

export const DESKTOP_BREAKPOINT = 900;

type Props = {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
};

export function BottomNavBar({ active, onChange }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}
      accessibilityRole="tablist"
      accessibilityLabel={t('nav_primary_label')}
    >
      <View style={[styles.inner, isDesktop && styles.innerDesktop]}>
        {NAV_ITEMS.map((item) => {
          const selected = item.key === active;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(item.labelKey)}
              style={(state) => [
                styles.item,
                isDesktop && styles.itemDesktop,
                (state.pressed || (state as { hovered?: boolean }).hovered) && !selected && styles.itemHover,
              ]}
            >
              <View style={[styles.indicator, selected && styles.indicatorActive]} />
              <View style={[styles.iconPill, selected && styles.iconPillActive]}>
                <Ionicons
                  name={selected ? item.iconActive : item.icon}
                  size={isDesktop ? 24 : 22}
                  color={selected ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    bar: {
      backgroundColor: COLORS.tabBar,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      ...Platform.select({
        web: { boxShadow: '0 -2px 10px rgba(0,0,0,0.08)' } as object,
        default: { elevation: 8 },
      }),
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
    },
    innerDesktop: {
      alignSelf: 'center',
      maxWidth: 720,
    },
    item: {
      flex: 1,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
      paddingBottom: 2,
    },
    itemDesktop: {
      minHeight: 64,
    },
    itemHover: {
      backgroundColor: COLORS.surfaceAlt,
    },
    indicator: {
      position: 'absolute',
      top: 0,
      width: 28,
      height: 3,
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    indicatorActive: {
      backgroundColor: COLORS.accent,
    },
    iconPill: {
      width: 52,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconPillActive: {
      backgroundColor: COLORS.primaryLight,
    },
    label: {
      fontSize: 12,
      marginTop: 2,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    labelActive: {
      color: COLORS.primary,
      fontWeight: '700',
    },
  });
