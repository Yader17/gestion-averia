import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Averia } from '../types/averia';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';

export function StatusBadge({ solved }: { solved: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.badge, solved ? styles.badgeSolved : styles.badgePending]}>
      <Ionicons
        name={solved ? 'checkmark-circle' : 'time'}
        size={14}
        color={solved ? colors.success : colors.warning}
      />
      <Text style={[styles.badgeText, { color: solved ? colors.success : colors.warning }]}>
        {solved ? t('status_resolved') : t('status_pending')}
      </Text>
    </View>
  );
}

type Props = {
  averia: Averia;
  onPress?: (averia: Averia) => void;
  onReport?: (averia: Averia) => void;
  onDelete?: (id: string) => void;
  children?: React.ReactNode; // extra content (e.g. AI "why related")
  compact?: boolean;
};

export function AveriaCard({ averia, onPress, onReport, onDelete, children, compact }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();

  const title = averia.numeroBastidor || '—';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress ? () => onPress(averia) : undefined}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${title}, ${averia.tipoAveria}, ${averia.solucionado ? t('status_resolved') : t('status_pending')}`}
        style={styles.main}
      >
        <View style={styles.rowTop}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {averia.fecha} · {averia.tipoAveria}
              {averia.intervencion ? ` · ${averia.intervencion}` : ''}
            </Text>
            {averia.creadoPorNombre ? (
              <Text style={styles.meta} numberOfLines={1}>
                {t('faults_registered_by', { name: averia.creadoPorNombre })}
              </Text>
            ) : null}
          </View>
          <StatusBadge solved={averia.solucionado} />
        </View>
        {!compact && averia.lugar ? (
          <View style={styles.place}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.placeText} numberOfLines={1}>
              {averia.lugar}
            </Text>
          </View>
        ) : null}
        {averia.observacion ? (
          <Text style={styles.notes} numberOfLines={compact ? 1 : 3}>
            {averia.observacion}
          </Text>
        ) : null}
      </Pressable>
      {children}
      {(onReport || onDelete) && (
        <View style={styles.actions}>
          {onReport && (
            <Pressable
              style={styles.actionButton}
              onPress={() => onReport(averia)}
              accessibilityRole="button"
              accessibilityLabel={t('faults_report')}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.actionText}>PDF</Text>
            </Pressable>
          )}
          {onPress && (
            <Pressable
              style={styles.actionButton}
              onPress={() => onPress(averia)}
              accessibilityRole="button"
              accessibilityLabel={t('faults_edit')}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.actionText}>{t('faults_edit')}</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              style={styles.actionButton}
              onPress={() => onDelete(averia.id)}
              accessibilityRole="button"
              accessibilityLabel={t('common_delete')}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>{t('common_delete')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    main: { padding: SPACING.md, gap: 6 },
    rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
    titleBlock: { flex: 1 },
    title: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text },
    meta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
    place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    placeText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
    notes: { fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: 20 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeSolved: { backgroundColor: COLORS.successSoft },
    badgePending: { backgroundColor: COLORS.warningSoft },
    badgeText: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
    actions: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    actionButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    actionText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
  });
