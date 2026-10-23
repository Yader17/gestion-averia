import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme/palettes';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n';

type Props = { visible: boolean; onStart: () => void };

const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: TranslationKey }[] = [
  { icon: 'speedometer-outline', text: 'welcome_1' },
  { icon: 'add-circle-outline', text: 'welcome_2' },
  { icon: 'map-outline', text: 'welcome_3' },
];

// First-run explanation only; the splash screen is a separate component.
export function WelcomeOnboarding({ visible, onStart }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStart}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {t('welcome_title')}
          </Text>
          {POINTS.map((point) => (
            <View key={point.text} style={styles.row}>
              <Ionicons name={point.icon} size={24} color={colors.primary} />
              <Text style={styles.text}>{t(point.text)}</Text>
            </View>
          ))}
          <Pressable style={styles.button} onPress={onStart} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('welcome_start')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 24,
      gap: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    text: { flex: 1, fontSize: 15, color: COLORS.text, lineHeight: 21 },
    button: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    buttonText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 16 },
  });
