import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';

export type MoreAction = 'kpis' | 'templates' | 'import' | 'export' | 'settings' | 'manuals';

type Props = {
  onAction: (action: MoreAction) => void;
};

type Entry = {
  action: MoreAction;
  icon: keyof typeof Ionicons.glyphMap;
  title: TranslationKey;
  desc: TranslationKey;
  destructive?: boolean;
};

type Group = { title: TranslationKey; entries: Entry[] };

// Administration/Profile groups are added when the auth backend provides roles.
const GROUPS: Group[] = [
  {
    title: 'more_group_analysis',
    entries: [{ action: 'kpis', icon: 'stats-chart-outline', title: 'more_kpis', desc: 'more_kpis_desc' }],
  },
  {
    title: 'more_group_data',
    entries: [
      { action: 'manuals', icon: 'library-outline', title: 'more_manuals', desc: 'more_manuals_desc' },
      { action: 'import', icon: 'cloud-upload-outline', title: 'more_import', desc: 'more_import_desc' },
      { action: 'export', icon: 'cloud-download-outline', title: 'more_export', desc: 'more_export_desc' },
      { action: 'templates', icon: 'document-outline', title: 'more_templates', desc: 'more_templates_desc', destructive: true },
    ],
  },
  {
    title: 'more_group_app',
    entries: [{ action: 'settings', icon: 'settings-outline', title: 'more_settings', desc: 'more_settings_desc' }],
  },
];

export function MoreScreen({ onAction }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('more_title')}
      </Text>
      {GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{t(group.title)}</Text>
          <View style={styles.card}>
            {group.entries.map((entry, index) => (
              <Pressable
                key={entry.action}
                onPress={() => onAction(entry.action)}
                accessibilityRole="button"
                accessibilityLabel={`${t(entry.title)}. ${t(entry.desc)}`}
                style={[styles.row, index > 0 && styles.rowDivider]}
              >
                <View style={[styles.iconBox, entry.destructive && { backgroundColor: colors.errorSoft }]}>
                  <Ionicons
                    name={entry.icon}
                    size={22}
                    color={entry.destructive ? colors.error : colors.primary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{t(entry.title)}</Text>
                  <Text style={styles.rowDesc}>{t(entry.desc)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 720, alignSelf: 'center' },
    heading: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
    group: { gap: SPACING.sm },
    groupTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, minHeight: 64 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: COLORS.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.text },
    rowDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  });
